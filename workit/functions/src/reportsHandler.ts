/**
 * Reacts to new entries in the `reports` collection.
 *
 * Mostly the admin handles reports manually through the Moderation tab.
 * The exception is CSAM — child sexual abuse material — which has a
 * zero-tolerance, no-debate path:
 *
 *   1. The reported user is auto-suspended IMMEDIATELY (accountStatus set
 *      to "suspended" so they can't post or accept anything else).
 *   2. If the report targets a job, the job is hard-removed
 *      (moderationStatus = "removed").
 *   3. A high-severity entry is added to /moderation so the admin can't miss it.
 *   4. An admin email goes out to ADMIN_EMAIL with the report ID, target,
 *      reporter, and reason text — so the admin sees it on their phone
 *      regardless of whether they're in the dashboard.
 *
 * Other report reasons are left for human review in the Moderation tab.
 */

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import sgMail from "@sendgrid/mail";

const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");
const SENDGRID_FROM_EMAIL = defineSecret("SENDGRID_FROM_EMAIL");

const ADMIN_EMAIL = "tshepowayne@workitsa.co.za";
const APP_URL = "https://workitsa.co.za";

type ReportDoc = {
  reporterId?: string;
  reporterName?: string;
  targetType?: "job" | "user" | "message" | "offer";
  targetId?: string;
  targetParentId?: string;
  targetUserUid?: string;
  reason?: string;
  description?: string;
};

async function emailAdmin(subject: string, body: string): Promise<void> {
  const key = SENDGRID_API_KEY.value();
  const from = SENDGRID_FROM_EMAIL.value();
  if (!key || !from) {
    logger.warn("SendGrid not configured; skipping admin alert email");
    return;
  }
  sgMail.setApiKey(key);
  await sgMail.send({
    to: ADMIN_EMAIL,
    from: { email: from, name: "Workit Alerts" },
    subject,
    text: body,
    html: `<pre style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;white-space:pre-wrap;">${body}</pre>`,
  });
}

export const onReportCreated = onDocumentCreated(
  {
    document: "reports/{reportId}",
    secrets: [SENDGRID_API_KEY, SENDGRID_FROM_EMAIL],
  },
  async (event) => {
    const report = event.data?.data() as ReportDoc | undefined;
    if (!report) return;
    const db = getFirestore();
    const reportId = event.params.reportId;

    // ---------- CSAM zero-tolerance path ----------
    if (report.reason === "csam") {
      logger.error("CSAM report received — auto-suspending and alerting", {
        reportId,
        targetType: report.targetType,
        targetId: report.targetId,
      });

      const actions: Promise<unknown>[] = [];

      // 1) Suspend the reported user immediately, if we know who.
      if (report.targetUserUid) {
        actions.push(
          db.doc(`users/${report.targetUserUid}`).update({
            accountStatus: "suspended",
          }),
        );
      }

      // 2) Hard-remove any job that was reported.
      if (report.targetType === "job" && report.targetId) {
        actions.push(
          db.doc(`jobs/${report.targetId}`).update({
            moderationStatus: "removed",
            moderationReason: "CSAM report — auto-removed",
          }),
        );
      }

      // 3) Add to /moderation queue as critical so it can't be missed.
      actions.push(
        db.collection("moderation").add({
          kind: "user_report",
          targetType: report.targetType ?? "user",
          targetId: report.targetUserUid ?? report.targetId ?? reportId,
          reason: `CSAM REPORT — auto-actioned. Reporter: ${report.reporterName ?? "unknown"}. Detail: ${report.description ?? "(none)"}`,
          severity: "high",
          createdAt: Date.now(),
          autoActioned: true,
        }),
      );

      // 4) Email admin so they see it on their phone immediately.
      const body = [
        "CSAM REPORT — auto-suspended target user and removed content.",
        "",
        `Report ID: ${reportId}`,
        `Target type: ${report.targetType}`,
        `Target ID: ${report.targetId}`,
        `Target user UID: ${report.targetUserUid ?? "(unknown)"}`,
        `Reporter: ${report.reporterName} (${report.reporterId})`,
        "",
        "Reporter description:",
        report.description ?? "(none)",
        "",
        `Open in admin: ${APP_URL}/admin`,
        "",
        "ACTION REQUIRED:",
        "- Verify the report and finalise the ban via the Moderation tab.",
        "- Forward evidence to SAPS: commercialcrime@saps.gov.za",
        "- Preserve the Storage paths before deletion if you intend to escalate.",
      ].join("\n");
      actions.push(
        emailAdmin(
          `[Workit URGENT] CSAM report on ${report.targetType} — action taken`,
          body,
        ).catch((err) => logger.error("Failed to send CSAM admin email", err)),
      );

      await Promise.allSettled(actions);
      return;
    }

    // ---------- Non-CSAM reports: just alert the admin politely ----------
    // Email is best-effort; the Moderation tab is the primary surface.
    try {
      const body = [
        `New report on Workit.`,
        "",
        `Reason: ${report.reason}`,
        `Target type: ${report.targetType}`,
        `Target ID: ${report.targetId}`,
        `Reporter: ${report.reporterName} (${report.reporterId})`,
        "",
        "Description:",
        report.description ?? "(none)",
        "",
        `Open in admin: ${APP_URL}/admin`,
      ].join("\n");
      await emailAdmin(`[Workit] New ${report.reason} report`, body);
    } catch (err) {
      logger.warn("Non-CSAM admin email failed (non-fatal)", err);
    }
  },
);
