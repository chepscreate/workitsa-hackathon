/**
 * Two-way WhatsApp support — admin reply path.
 *
 * The inbound side lives in jarvisWhatsApp.ts (non-owner messages → stored in
 * `supportMessages` + auto-ack + owner forward). This file is the OUTBOUND
 * side: an admin-only callable that sends a reply back to the customer via the
 * WhatsApp Cloud API, logs it as an outbound `supportMessages` doc, and marks
 * that thread's inbound messages handled.
 *
 * WhatsApp's 24-hour rule: a free-form text can only be sent within 24h of the
 * customer's last message ("customer service window"). Outside it, Meta rejects
 * the send (error 131047) and a pre-approved template would be required — we
 * surface that to the admin instead of silently failing, so they can fall back
 * to email.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const WHATSAPP_TOKEN = defineSecret("WHATSAPP_TOKEN");
const WHATSAPP_PHONE_NUMBER_ID = defineSecret("WHATSAPP_PHONE_NUMBER_ID");
const GRAPH_VERSION = "v21.0";

type AnyDoc = Record<string, unknown>;

export const replyToSupport = onCall(
  { secrets: [WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID], timeoutSeconds: 60 },
  async (req) => {
    if (!req.auth) throw new HttpsError("unauthenticated", "Sign in.");
    const db = getFirestore();
    const me = await db.collection("users").doc(req.auth.uid).get();
    if (!me.exists || (me.data() as AnyDoc).role !== "admin") {
      throw new HttpsError("permission-denied", "Admins only.");
    }
    const adminName = String((me.data() as AnyDoc).displayName ?? "Admin");

    const toNumber = String(req.data?.toNumber ?? "").replace(/\D/g, "");
    const text = String(req.data?.text ?? "").trim();
    if (!toNumber) throw new HttpsError("invalid-argument", "toNumber required.");
    if (text.length < 1) throw new HttpsError("invalid-argument", "Empty reply.");
    if (text.length > 4096) throw new HttpsError("invalid-argument", "Reply too long.");

    // --- Send via the Cloud API ---
    const phoneId = WHATSAPP_PHONE_NUMBER_ID.value();
    const token = WHATSAPP_TOKEN.value();
    let res: Response;
    try {
      res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: toNumber,
          type: "text",
          text: { body: text },
        }),
      });
    } catch (err) {
      logger.error("replyToSupport: network error", { err: String(err) });
      throw new HttpsError("unavailable", "Couldn't reach WhatsApp. Try again.");
    }

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as AnyDoc;
      const metaErr = (errBody.error ?? {}) as AnyDoc;
      const code = Number(metaErr.code ?? 0);
      logger.warn("replyToSupport: send rejected", { status: res.status, code, metaErr });
      // 131047 / 131051: outside the 24h customer-service window.
      if (code === 131047 || code === 131051) {
        throw new HttpsError(
          "failed-precondition",
          "This person hasn't messaged in over 24 hours, so WhatsApp won't deliver "
            + "a free reply right now. Reply by email instead, or wait for them to "
            + "message again.",
        );
      }
      throw new HttpsError("internal", String(metaErr.message ?? "WhatsApp rejected the message."));
    }

    const now = Date.now();
    // --- Log the outbound message ---
    try {
      await db.collection("supportMessages").add({
        waNumber: toNumber,
        text,
        direction: "outbound",
        adminUid: req.auth.uid,
        adminName,
        handled: true,
        createdAt: now,
      });
    } catch (err) {
      logger.error("replyToSupport: log failed", { err: String(err) });
    }

    // --- Mark this thread's inbound messages handled (clears the unread badge) ---
    try {
      const inbound = await db
        .collection("supportMessages")
        .where("waNumber", "==", toNumber)
        .where("direction", "==", "inbound")
        .where("handled", "==", false)
        .get();
      if (!inbound.empty) {
        const batch = db.batch();
        inbound.docs.forEach((d) => batch.update(d.ref, { handled: true }));
        await batch.commit();
      }
    } catch (err) {
      // Non-fatal: a missing composite index just means the badge clears lazily.
      logger.warn("replyToSupport: mark-handled skipped", { err: String(err) });
    }

    return { ok: true, sentAt: now };
  },
);

/** Mark a thread handled WITHOUT replying (admin dealt with it elsewhere). */
export const resolveSupportThread = onCall({ timeoutSeconds: 30 }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in.");
  const db = getFirestore();
  const me = await db.collection("users").doc(req.auth.uid).get();
  if (!me.exists || (me.data() as AnyDoc).role !== "admin") {
    throw new HttpsError("permission-denied", "Admins only.");
  }
  const toNumber = String(req.data?.toNumber ?? "").replace(/\D/g, "");
  if (!toNumber) throw new HttpsError("invalid-argument", "toNumber required.");

  const inbound = await db
    .collection("supportMessages")
    .where("waNumber", "==", toNumber)
    .where("direction", "==", "inbound")
    .where("handled", "==", false)
    .get();
  if (!inbound.empty) {
    const batch = db.batch();
    inbound.docs.forEach((d) => batch.update(d.ref, { handled: true }));
    await batch.commit();
  }
  return { ok: true, cleared: inbound.size };
});
