/**
 * Admin-panel controls for the marketing automation (the "run button").
 *
 *  - `marketingStatus`  (admin)        — switches + queue counts for the panel.
 *  - `marketingRunNow`  (admin + 2FA)  — fire a channel immediately instead of
 *    waiting for its schedule. Same code path as the schedulers
 *    (runOutreachBatch / runFacebookPost), so every guardrail still applies:
 *    master switches, daily email cap, opt-out suppression, no-double-post.
 *    2FA bar matches sendBroadcast/erasure — this touches the outside world.
 *
 * Every manual run is written to the audit log.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { runOutreachBatch, sentTodayCount } from "./marketingOutreach";
import { runFacebookPost, META_PAGE_TOKEN, META_PAGE_ID } from "./facebookPoster";
import { SENDGRID_API_KEY, SENDGRID_FROM_EMAIL } from "./mailer";

type AnyDoc = Record<string, unknown>;

async function requireAdmin(uid: string | undefined): Promise<AnyDoc> {
  if (!uid) throw new HttpsError("unauthenticated", "Sign in.");
  const me = await getFirestore().collection("users").doc(uid).get();
  if (!me.exists || (me.data() as AnyDoc).role !== "admin") {
    throw new HttpsError("permission-denied", "Admins only.");
  }
  return me.data() as AnyDoc;
}

async function countByStatus(collection: string, status: string): Promise<number> {
  const agg = await getFirestore().collection(collection).where("status", "==", status).count().get();
  return agg.data().count;
}

export const marketingStatus = onCall({ timeoutSeconds: 30 }, async (req) => {
  await requireAdmin(req.auth?.uid);
  const db = getFirestore();
  const cfgSnap = await db.doc("marketing/config").get();
  const cfg = (cfgSnap.exists ? cfgSnap.data() : {}) as AnyDoc;

  const [pending, sent, optout, posted, sentToday, queuedSnap] = await Promise.all([
    countByStatus("marketingLeads", "pending"),
    countByStatus("marketingLeads", "sent"),
    countByStatus("marketingLeads", "optout"),
    countByStatus("marketingPosts", "posted"),
    sentTodayCount(),
    db.collection("marketingPosts").where("status", "==", "queued").select("mediaType").get(),
  ]);
  // Split the queue by slot: videos post 08:00, images/text 17:30.
  let queuedVideos = 0;
  let queuedImages = 0;
  queuedSnap.forEach((d) => {
    if ((d.data() as AnyDoc).mediaType === "video") queuedVideos++;
    else queuedImages++;
  });

  return {
    emailEnabled: cfg.enabled === true,
    fbEnabled: cfg.fbEnabled !== false,
    dailyCap: Number(cfg.dailyCap ?? 15),
    replyTo: String(cfg.replyTo ?? "tshepowayne2@gmail.com"),
    sentToday,
    leads: { pending, sent, optout },
    posts: { queuedImages, queuedVideos, posted },
  };
});

export const marketingRunNow = onCall(
  {
    timeoutSeconds: 540, // an email batch is sequential sends — give it room
    memory: "256MiB",
    secrets: [SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, META_PAGE_TOKEN, META_PAGE_ID],
  },
  async (req) => {
    const me = await requireAdmin(req.auth?.uid);
    // Outward-facing sends — same 2FA bar as broadcast + erasure.
    if (!req.auth?.token.firebase?.sign_in_second_factor) {
      throw new HttpsError(
        "permission-denied",
        "Set up two-step verification and sign in again to trigger a send.",
      );
    }

    const channel = String(req.data?.channel ?? "");
    if (channel !== "email" && channel !== "facebook") {
      throw new HttpsError("invalid-argument", 'channel must be "email" or "facebook".');
    }

    const result = channel === "email" ? await runOutreachBatch() : await runFacebookPost();

    await getFirestore().collection("auditLog").add({
      action: "marketingRunNow",
      channel,
      result,
      adminUid: req.auth!.uid,
      adminName: String(me.displayName ?? "Admin"),
      at: Date.now(),
    });
    logger.info(`Manual marketing run (${channel}) by admin`, { result });

    return result;
  },
);
