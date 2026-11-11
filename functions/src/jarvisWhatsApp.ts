/**
 * Jarvis over WhatsApp — talk to Jarvis from your phone, AND a public support
 * front door on the same number.
 *
 * Two senders, two completely separate paths on one Cloud API number:
 *   - OWNER (JARVIS_OWNER_WA) → the Jarvis agent (read-only, memory, actions).
 *     Hardened so it only ever acts for YOU:
 *       1. POST payloads must carry a valid X-Hub-Signature-256 (HMAC of the
 *          raw body with the app secret) — rejects forged calls.
 *       2. The sender's number must equal JARVIS_OWNER_WA before the agent runs.
 *       3. The agent is READ-ONLY (jarvisCore) — it can't change anything.
 *   - ANYONE ELSE → support handler (see handleSupportMessage): the message is
 *     saved to `supportMessages`, the sender gets a throttled auto-acknowledge,
 *     and a heads-up is forwarded to the owner. A stranger can NEVER reach the
 *     Jarvis agent — the owner-lock still gates the agent path exactly as before.
 *     This is what lets the "Chat to support" button (Help page + footer) point
 *     at this number without messages vanishing into a black hole.
 *
 * Conversation memory is kept in jarvisSessions/whatsapp (last ~20 turns) so
 * follow-up questions work.
 *
 * Secrets to set before this works (see the deploy notes):
 *   GEMINI_API_KEY, WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID,
 *   WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET, JARVIS_OWNER_WA
 */
import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createHmac, timingSafeEqual } from "crypto";
import { GEMINI_API_KEY, runJarvis, type ChatTurn } from "./jarvisCore";
import { executeAction, type PendingAction } from "./jarvisActions";
import { handleWhatsAppJobReply } from "./whatsappJobChannel";

/** How long a staged action stays confirmable before it goes stale. */
const PENDING_TTL_MS = 10 * 60 * 1000;
const AFFIRM = /^(?:yes|y|yep|yeah|yup|confirm|confirmed|do it|go ahead|proceed|approve|ok|okay|sure)\b/i;
const NEGATE = /^(?:no|n|nope|cancel|stop|don'?t|dont|nah|abort)\b/i;

const WHATSAPP_TOKEN = defineSecret("WHATSAPP_TOKEN");
const WHATSAPP_PHONE_NUMBER_ID = defineSecret("WHATSAPP_PHONE_NUMBER_ID");
const WHATSAPP_VERIFY_TOKEN = defineSecret("WHATSAPP_VERIFY_TOKEN");
const WHATSAPP_APP_SECRET = defineSecret("WHATSAPP_APP_SECRET");
/** Your WhatsApp number in full international form, digits only e.g. 27821234567. */
const JARVIS_OWNER_WA = defineSecret("JARVIS_OWNER_WA");

const FOUNDER_NAME = "Tshepo";
const MAX_HISTORY_TURNS = 20;
const GRAPH_VERSION = "v21.0";

/** Don't re-send the support auto-acknowledge to the same number more than
 *  once in this window (so a chatty customer isn't spammed mid-conversation). */
const SUPPORT_ACK_THROTTLE_MS = 6 * 60 * 60 * 1000;

const onlyDigits = (s: string) => s.replace(/\D/g, "");

/** Verify Meta's HMAC-SHA256 signature over the raw request body. */
function validSignature(rawBody: Buffer | undefined, header: string | undefined): boolean {
  if (!rawBody || !header) return false;
  const expected = "sha256=" + createHmac("sha256", WHATSAPP_APP_SECRET.value()).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(header);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function sendWhatsApp(to: string, body: string): Promise<void> {
  const phoneId = WHATSAPP_PHONE_NUMBER_ID.value();
  const token = WHATSAPP_TOKEN.value();
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: body.slice(0, 4096) },
    }),
  });
  if (!res.ok) {
    logger.error("whatsapp send failed", { status: res.status, body: await res.text() });
  }
}

/**
 * Public support message (anyone who is NOT the owner). Never touches Jarvis.
 *  1. Persist to `supportMessages` (durable record + future admin inbox).
 *  2. Auto-acknowledge the sender — throttled, so returning customers mid-chat
 *     aren't spammed. This is a reply inside WhatsApp's 24h service window, so
 *     it's free-form and free (no template needed).
 *  3. Best-effort heads-up to the owner so they see it in real time. Wrapped in
 *     its own try/catch: a business-initiated message can fail outside the
 *     owner's 24h window (would need a template) — the stored record is the
 *     source of truth, the forward is a convenience.
 */
async function handleSupportMessage(
  fromRaw: string,
  fromDigits: string,
  text: string,
  name: string | undefined,
  ownerRaw: string,
): Promise<void> {
  const db = getFirestore();
  const now = Date.now();

  // 1) Persist (one doc per inbound message — clean for a future admin list).
  try {
    await db.collection("supportMessages").add({
      waNumber: fromDigits,
      name: name ?? null,
      text: text.slice(0, 4096),
      direction: "inbound",
      handled: false,
      createdAt: now,
    });
  } catch (err) {
    logger.error("support: store failed", { err: String(err) });
  }

  // 2) Throttled auto-acknowledge to the sender.
  const stateRef = db.doc(`supportState/${fromDigits}`);
  try {
    const state = await stateRef.get();
    const lastAck = Number(state.data()?.lastAckAt ?? 0);
    if (now - lastAck > SUPPORT_ACK_THROTTLE_MS) {
      await sendWhatsApp(
        fromRaw,
        "Hi 👋 Thanks for contacting *Workit* support. We've received your "
          + "message and a real person will get back to you shortly.\n\n"
          + "For account or verification help you can also email "
          + "tshepowayne@workitsa.co.za.\n\n— The Workit Team",
      );
      await stateRef.set({ lastAckAt: now, waNumber: fromDigits }, { merge: true });
    }
  } catch (err) {
    logger.error("support: auto-ack failed", { err: String(err) });
  }

  // 3) Best-effort forward to the owner.
  try {
    await sendWhatsApp(
      ownerRaw,
      `📨 *Workit support* — new message from ${name ? `${name} ` : ""}`
        + `(+${fromDigits}):\n\n"${text.slice(0, 1000)}"\n\n`
        + "Reply via Meta Business Suite or email.",
    );
  } catch (err) {
    logger.warn("support: owner forward failed (likely outside 24h window)", { err: String(err) });
  }
}

export const jarvisWhatsApp = onRequest(
  {
    secrets: [
      GEMINI_API_KEY,
      WHATSAPP_TOKEN,
      WHATSAPP_PHONE_NUMBER_ID,
      WHATSAPP_VERIFY_TOKEN,
      WHATSAPP_APP_SECRET,
      JARVIS_OWNER_WA,
    ],
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (req, res) => {
    // --- 1) Webhook verification handshake (GET) ---
    if (req.method === "GET") {
      const mode = req.query["hub.mode"];
      const token = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];
      if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN.value()) {
        res.status(200).send(String(challenge ?? ""));
        return;
      }
      res.status(403).send("forbidden");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).send("method not allowed");
      return;
    }

    // --- 2) Reject forged calls ---
    if (!validSignature(req.rawBody, req.get("x-hub-signature-256"))) {
      logger.warn("whatsapp: bad signature");
      res.status(403).send("bad signature");
      return;
    }

    // Always 200 to Meta promptly-ish; we still process inline (short enough).
    try {
      const value = req.body?.entry?.[0]?.changes?.[0]?.value;
      const msg = value?.messages?.[0];
      // Accept text (Jarvis + support + job commands) and location (worker
      // safety check-ins). Status callbacks / other events: ack and stop.
      if (!msg || (msg.type !== "text" && msg.type !== "location")) {
        res.status(200).send("ok");
        return;
      }

      const messageId = String(msg.id ?? "");
      const fromRaw = String(msg.from ?? "");
      const from = onlyDigits(fromRaw);
      const ownerRaw = JARVIS_OWNER_WA.value();
      const owner = onlyDigits(ownerRaw);
      const text = String(msg.text?.body ?? "").trim();
      const location =
        msg.type === "location" && msg.location
          ? { lat: Number(msg.location.latitude), lng: Number(msg.location.longitude) }
          : undefined;

      // --- 3) Owner-lock: the Jarvis agent ONLY ever runs for the owner.
      //     Everyone else is a support enquiry — captured + acknowledged here,
      //     and can NEVER reach Jarvis's commands, memory, or data. BUT first we
      //     give the WhatsApp Job Channel a chance: a known opted-in worker
      //     sending a job keyword (1/ACCEPT/START/DONE/STOP) is handled there.
      //     It returns false for anything else, which falls through to support.
      //     Wrapped so a failure in the job path can never break support.
      if (!from || !owner || from !== owner) {
        if (text || location) {
          let handledAsJob = false;
          try {
            handledAsJob = await handleWhatsAppJobReply({
              messageId,
              fromRaw,
              fromDigits: from,
              text,
              location,
              send: sendWhatsApp,
            });
          } catch (err) {
            logger.error("wa job reply failed", { err: String(err) });
          }
          // Only fall through to support for actual text (never an unmatched
          // location message — that isn't a support enquiry).
          if (!handledAsJob && text) {
            const name = value?.contacts?.[0]?.profile?.name as string | undefined;
            await handleSupportMessage(fromRaw, from, text, name, ownerRaw);
          }
        }
        res.status(200).send("ok");
        return;
      }

      if (!text) {
        res.status(200).send("ok");
        return;
      }

      const sessRef = getFirestore().doc("jarvisSessions/whatsapp");
      const sess = await sessRef.get();
      const data = (sess.exists ? sess.data() : {}) ?? {};
      const history = (data.turns ?? []) as ChatTurn[];
      const pending = data.pendingAction as PendingAction | undefined;
      const pendingFresh = pending && Date.now() - Number(data.pendingAt ?? 0) < PENDING_TTL_MS;

      const clearPending = { pendingAction: FieldValue.delete(), pendingAt: FieldValue.delete() };
      const save = async (reply: string, extra: Record<string, unknown>) => {
        const turns = [...history, { role: "user", text }, { role: "assistant", text: reply }].slice(
          -MAX_HISTORY_TURNS,
        );
        await sessRef.set({ turns, updatedAt: Date.now(), ...extra }, { merge: true });
        await sendWhatsApp(msg.from, reply);
        res.status(200).send("ok");
      };

      // --- 1) Resolve an outstanding confirmation deterministically (no model) ---
      if (pendingFresh) {
        if (AFFIRM.test(text)) {
          const exec = await executeAction(pending!, { uid: `wa:${owner}`, name: FOUNDER_NAME });
          await save(exec.message, clearPending);
          return;
        }
        if (NEGATE.test(text)) {
          await save("Okay, cancelled — nothing was changed.", clearPending);
          return;
        }
        // Anything else: treat as a fresh request; the stale proposal is dropped below.
      }

      // --- 2) Normal agent turn (may stage a new action) ---
      const { reply, pendingAction } = await runJarvis({
        apiKey: GEMINI_API_KEY.value(),
        message: text,
        history: history.slice(-MAX_HISTORY_TURNS),
        adminName: FOUNDER_NAME,
        allowActions: true,
      });

      await save(
        reply,
        pendingAction ? { pendingAction, pendingAt: Date.now() } : clearPending,
      );
    } catch (err) {
      logger.error("jarvis whatsapp error", { err: String(err) });
      res.status(200).send("ok"); // 200 so Meta doesn't hammer retries
    }
  },
);
