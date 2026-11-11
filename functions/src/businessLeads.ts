/**
 * Notify a business when a worker expresses interest (Phase 3 "hireable").
 *
 * Trigger: a new doc at users/{businessUid}/leads/{leadId} (created by the
 * worker from the business profile). We email the business + send a push, with a
 * link to the worker's profile so they can view + invite them to a job.
 */
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { send, shell, SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, APP_URL } from "./mailer";
import { dispatchPush } from "./notify";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const onBusinessLeadCreated = onDocumentCreated(
  {
    document: "users/{businessUid}/leads/{leadId}",
    secrets: [SENDGRID_API_KEY, SENDGRID_FROM_EMAIL],
  },
  async (event) => {
    const lead = event.data?.data() as Record<string, unknown> | undefined;
    if (!lead) return;

    const businessUid = event.params.businessUid;
    const workerName = String(lead.workerName ?? "A worker");
    const workerUid = String(lead.workerUid ?? "");
    const message = lead.message ? String(lead.message) : "";
    const href = `/u?id=${workerUid}`;
    const profileUrl = `${APP_URL}${href}`;

    const db = getFirestore();

    // Abuse hardening (security audit): only notify actual businesses, and only
    // once per worker→business pair — otherwise leads on arbitrary users become
    // an email-spam amplifier. Junk/duplicate leads are deleted outright.
    const targetSnap = await db.doc(`users/${businessUid}`).get();
    const targetRole = targetSnap.exists
      ? String((targetSnap.data() as Record<string, unknown>).role ?? "")
      : "";
    if (targetRole !== "business") {
      logger.warn("lead on non-business target — deleting", { businessUid, workerUid });
      await event.data?.ref.delete().catch(() => {});
      return;
    }
    if (workerUid) {
      const dupes = await db
        .collection(`users/${businessUid}/leads`)
        .where("workerUid", "==", workerUid)
        .get();
      // This doc is already in the collection; >1 means a prior lead exists.
      if (dupes.size > 1) {
        logger.info("duplicate lead — deleting, no notification", { businessUid, workerUid });
        await event.data?.ref.delete().catch(() => {});
        return;
      }
    }

    // Push notification (best-effort).
    try {
      await dispatchPush({
        toUid: businessUid,
        title: "A worker is interested",
        body: `${workerName} wants to work with you. Tap to view their profile.`,
        href,
        tag: `lead-${workerUid}`,
      });
    } catch (err) {
      logger.warn("business lead push failed", { err: String(err) });
    }

    // Email (best-effort).
    try {
      const bizSnap = await getFirestore().doc(`users/${businessUid}`).get();
      const email = bizSnap.exists ? String((bizSnap.data() as Record<string, unknown>).email ?? "") : "";
      if (!email) return;
      await send({
        to: email,
        subject: `${workerName} is interested in working with you`,
        text:
          `${workerName} expressed interest in your business on Workit.\n\n` +
          (message ? `Their note: ${message}\n\n` : "") +
          `View their profile: ${profileUrl}`,
        html: shell(
          "A worker is interested",
          `<p><b>${esc(workerName)}</b> would like to work with you on Workit.</p>` +
            (message
              ? `<p style="background:#f3ead9;padding:12px;border-radius:8px;margin:12px 0;">${esc(message)}</p>`
              : "") +
            `<p>Open their profile to see their ratings and history, then invite them to a job.</p>`,
          { href: profileUrl, label: "View worker profile" },
        ),
      });
    } catch (err) {
      logger.warn("business lead email failed", { err: String(err) });
    }
  },
);
