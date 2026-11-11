/**
 * Jarvis morning digest.
 *
 *  - jarvisMorningDigest: scheduled 07:00 SAST. Asks Jarvis to write a short
 *    founder-facing brief and emails it to you.
 *  - jarvisDigestNow: admin-only onCall so you can fire a brief on demand to
 *    test it (returns the brief text too, so the dashboard could show it).
 *
 * Reuses the shared agent (jarvisCore) and the SendGrid secrets from mailer.ts.
 * The scheduled function lives in europe-west1 because Cloud Scheduler has no
 * africa-south1 region — it still reads the africa-south1 database fine.
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import sgMail from "@sendgrid/mail";
import { GEMINI_API_KEY, runJarvis } from "./jarvisCore";
import { SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, APP_URL } from "./mailer";
import { beat } from "./heartbeat";

const FOUNDER_EMAIL = "tshepowayne@workitsa.co.za";
const FOUNDER_NAME = "Tshepo";

const DIGEST_PROMPT =
  "Write my morning brief. First call get_metrics, then check the queues that have anything " +
  "waiting (pending approvals, pending verifications, open disputes, open reports) and the last " +
  "24 hours of signups and jobs. Then write a warm, short brief (max ~10 lines) for me as the " +
  "founder: open with one headline sentence on overall health, then a tight bullet list of what " +
  "needs my attention today (skip empty queues), then one line on growth/activity. If everything " +
  "is quiet, say so cheerfully. Plain text, no markdown headers.";

const secrets = [GEMINI_API_KEY, SENDGRID_API_KEY, SENDGRID_FROM_EMAIL];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Build the brief with Jarvis and email it. Returns the brief text. */
async function buildAndSendDigest(): Promise<string> {
  const key = GEMINI_API_KEY.value();
  if (!key) throw new Error("GEMINI_API_KEY not set");

  const { reply: brief } = await runJarvis({
    apiKey: key,
    message: DIGEST_PROMPT,
    adminName: FOUNDER_NAME,
    // digest stays read-only — no actions
  });

  const sgKey = SENDGRID_API_KEY.value();
  const from = SENDGRID_FROM_EMAIL.value();
  if (!sgKey || !from) {
    logger.warn("SendGrid not configured; digest built but not emailed");
    return brief;
  }
  sgMail.setApiKey(sgKey);

  const dateLine = new Date().toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Africa/Johannesburg",
  });

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f1612;background:#faf4ec;border-radius:12px;">
      <p style="font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:#b85a2a;margin:0 0 4px;">Jarvis · Morning brief</p>
      <h1 style="font-size:20px;margin:0 0 16px;color:#1f1612;">${escapeHtml(dateLine)}</h1>
      <div style="font-size:15px;line-height:1.6;color:#4a3a30;white-space:pre-wrap;">${escapeHtml(brief)}</div>
      <p style="margin-top:24px;"><a href="${APP_URL}/admin" style="display:inline-block;padding:11px 20px;border-radius:999px;background:#d97742;color:#faf4ec;text-decoration:none;font-weight:600;">Open the admin dashboard</a></p>
      <hr style="border:none;border-top:1px solid #e5d9c4;margin:28px 0 14px;">
      <p style="font-size:11px;color:#7a6a5e;margin:0;">Automated brief from Jarvis · Workit ops · <a href="${APP_URL}" style="color:#b85a2a;">workitsa.co.za</a>. Figures are read live from Firestore at send time.</p>
    </div>`;

  await sgMail.send({
    to: FOUNDER_EMAIL,
    from: { email: from, name: "Workit · Jarvis" },
    subject: `Jarvis morning brief — ${dateLine}`,
    text: brief,
    html,
    trackingSettings: {
      clickTracking: { enable: false, enableText: false },
      openTracking: { enable: false },
    },
  });

  logger.info("Jarvis morning digest sent");
  return brief;
}

export const jarvisMorningDigest = onSchedule(
  {
    schedule: "every day 07:00",
    timeZone: "Africa/Johannesburg",
    region: "europe-west1", // Cloud Scheduler has no africa-south1
    secrets,
    memory: "512MiB",
    timeoutSeconds: 120,
    retryCount: 1,
  },
  async () => {
    beat("jarvisMorningDigest");
    try {
      await buildAndSendDigest();
    } catch (err) {
      logger.error("Jarvis morning digest failed", { err: String(err) });
      throw err; // allow the retry
    }
  },
);

export const jarvisDigestNow = onCall({ secrets, timeoutSeconds: 120, memory: "512MiB" }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in as an admin.");
  const me = await getFirestore().collection("users").doc(req.auth.uid).get();
  if (!me.exists || (me.data() as Record<string, unknown>).role !== "admin") {
    throw new HttpsError("permission-denied", "Admins only.");
  }
  try {
    const brief = await buildAndSendDigest();
    return { ok: true, brief };
  } catch (err) {
    logger.error("jarvisDigestNow failed", { err: String(err) });
    throw new HttpsError("internal", "Couldn't build the digest. Try again.");
  }
});
