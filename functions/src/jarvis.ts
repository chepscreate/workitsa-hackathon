/**
 * Jarvis — admin dashboard chat (onCall).
 *
 * SECURITY
 *  - onCall verifies the caller's Firebase auth token.
 *  - We re-check that users/{uid}.role === "admin" before any model call.
 *  - The Gemini key lives only as the GEMINI_API_KEY secret (see jarvisCore).
 *
 * The agent itself (read-only tools + loop) lives in jarvisCore.ts so the
 * digest and WhatsApp surfaces can share exactly the same brain.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { GEMINI_API_KEY, runJarvis, type ChatTurn } from "./jarvisCore";
import { executeAction, type PendingAction, type JarvisActionType } from "./jarvisActions";

const MAX_HISTORY_TURNS = 20;

type AnyDoc = Record<string, unknown>;

/** Re-check the caller is a signed-in admin; returns their display name. */
async function requireAdmin(uid: string | undefined): Promise<string> {
  if (!uid) throw new HttpsError("unauthenticated", "Sign in as an admin to use Jarvis.");
  const me = await getFirestore().collection("users").doc(uid).get();
  if (!me.exists || (me.data() as AnyDoc).role !== "admin") {
    throw new HttpsError("permission-denied", "Jarvis is for admins only.");
  }
  return String((me.data() as AnyDoc).displayName ?? "");
}

const VALID_ACTION_TYPES = new Set<JarvisActionType>([
  "account_approve",
  "account_reject",
  "account_suspend",
  "account_reinstate",
  "verification_approve",
  "verification_approve_gold",
  "verification_reject",
  "dispute_force_completed",
  "dispute_cancelled_no_fault",
  "dispute_cancelled_with_warning",
  "dispute_dismissed",
]);

export const jarvisChat = onCall(
  { secrets: [GEMINI_API_KEY], timeoutSeconds: 120, memory: "512MiB" },
  async (req) => {
    // --- auth: must be a signed-in admin ---
    const adminName = await requireAdmin(req.auth?.uid);

    // --- input ---
    const message = String(req.data?.message ?? "").trim();
    if (!message) throw new HttpsError("invalid-argument", "Say something to Jarvis.");
    if (message.length > 4000) {
      throw new HttpsError("invalid-argument", "That message is too long.");
    }
    const rawHistory = Array.isArray(req.data?.history) ? req.data.history : [];
    const history: ChatTurn[] = rawHistory
      .filter(
        (t: AnyDoc) =>
          t &&
          (t.role === "user" || t.role === "assistant") &&
          typeof t.text === "string" &&
          t.text.trim().length > 0,
      )
      .slice(-MAX_HISTORY_TURNS)
      .map((t: AnyDoc) => ({ role: t.role as "user" | "assistant", text: String(t.text) }));

    const key = GEMINI_API_KEY.value();
    if (!key) {
      throw new HttpsError("failed-precondition", "Jarvis isn't configured yet (missing API key).");
    }

    try {
      const { reply, pendingAction } = await runJarvis({
        apiKey: key,
        message,
        history,
        adminName,
        allowActions: true,
      });
      return { reply, pendingAction: pendingAction ?? null };
    } catch (err) {
      logger.error("jarvis chat failed", { err: String(err) });
      throw new HttpsError("internal", "Jarvis hit an error. Try again in a moment.");
    }
  },
);

/**
 * Execute an action the admin has confirmed in the dashboard. The client sends
 * back the staged action object; we re-verify admin identity and re-validate
 * live state inside executeAction before any write. (A tampered payload can only
 * trigger an action this admin could already perform in /admin anyway.)
 */
export const jarvisConfirmAction = onCall(
  { secrets: [GEMINI_API_KEY], timeoutSeconds: 60, memory: "256MiB" },
  async (req) => {
    const adminName = await requireAdmin(req.auth?.uid);
    const a = req.data?.action as Partial<PendingAction> | undefined;
    if (!a || typeof a.type !== "string" || !VALID_ACTION_TYPES.has(a.type as JarvisActionType)) {
      throw new HttpsError("invalid-argument", "No valid action to confirm.");
    }
    const pending: PendingAction = {
      type: a.type as JarvisActionType,
      targetUid: a.targetUid ? String(a.targetUid) : undefined,
      targetName: a.targetName ? String(a.targetName) : undefined,
      targetJobId: a.targetJobId ? String(a.targetJobId) : undefined,
      note: a.note ? String(a.note) : undefined,
      summary: String(a.summary ?? ""),
    };
    try {
      const res = await executeAction(pending, { uid: req.auth!.uid, name: adminName });
      return res;
    } catch (err) {
      logger.error("jarvisConfirmAction failed", { err: String(err) });
      throw new HttpsError("internal", "Couldn't complete that action.");
    }
  },
);
