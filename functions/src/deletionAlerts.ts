/**
 * POPIA safety-net — a daily reminder when account-deletion requests are aging.
 *
 * Erasure itself stays a MANUAL, explicit admin action (see erasure.ts — "erasure
 * should never happen as a side effect"). But the privacy policy promises
 * deletion within 30 days, so if a request sits unactioned this scheduled check
 * nudges the founder (email) + admins (push) with the list and each one's age,
 * escalating as they approach the limit. Silent when nothing is pending or every
 * request is still fresh (the real-time admin panel has those covered).
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import sgMail from "@sendgrid/mail";
import { SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, APP_URL } from "./mailer";
import { dispatchPush } from "./notify";
import { beat } from "./heartbeat";

const FOUNDER_EMAIL = "tshepowayne@workitsa.co.za";
const DAY_MS = 24 * 60 * 60 * 1000;
const NUDGE_AFTER_DAYS = 3; // brand-new requests don't email — the panel shows them
const URGENT_AFTER_DAYS = 25; // approaching the 30-day POPIA limit

type DeletionReq = {
  displayName?: string;
  reason?: string;
  requestedAt?: number;
  status?: string;
};

export const scheduledDeletionRequestCheck = onSchedule(
  {
    // 06:00 SAST daily. Cloud Scheduler has no africa-south1 region (same note as
    // retention.ts / recurring.ts); the reads still target the africa-south1 db.
    schedule: "every day 06:00",
    timeZone: "Africa/Johannesburg",
    region: "europe-west1",
    retryCount: 1,
    memory: "256MiB",
    secrets: [SENDGRID_API_KEY, SENDGRID_FROM_EMAIL],
  },
  async () => {
    beat("scheduledDeletionRequestCheck");
    const db = getFirestore();
    const snap = await db.collection("deletionRequests").where("status", "==", "pending").get();
    if (snap.empty) return;

    const now = Date.now();
    const items = snap.docs
      .map((d) => {
        const r = d.data() as DeletionReq;
        const ageDays = Math.floor((now - (r.requestedAt ?? now)) / DAY_MS);
        return { name: r.displayName ?? "user", reason: r.reason, ageDays };
      })
      .sort((a, b) => b.ageDays - a.ageDays);

    const oldest = items[0]?.ageDays ?? 0;
    if (oldest < NUDGE_AFTER_DAYS) return; // all fresh — real-time panel has it

    const urgent = items.filter((i) => i.ageDays >= URGENT_AFTER_DAYS).length;

    // Push every admin.
    try {
      const admins = await db.collection("users").where("role", "==", "admin").get();
      await Promise.allSettled(
        admins.docs.map((d) =>
          dispatchPush({
            toUid: d.id,
            title: urgent ? "⚠ Deletion requests overdue" : "Deletion requests pending",
            body: `${items.length} account${items.length === 1 ? "" : "s"} awaiting erasure (oldest ${oldest} days). Action them in the admin panel.`,
            href: "/admin",
            tag: "deletion-aging",
          }),
        ),
      );
    } catch (err) {
      logger.error("deletion-aging admin push failed", { err: String(err) });
    }

    // Email the founder (reliable channel — lands even when out of the app).
    const key = SENDGRID_API_KEY.value();
    const from = SENDGRID_FROM_EMAIL.value();
    if (!key || !from) {
      logger.warn("SendGrid not configured; deletion-aging email skipped");
      return;
    }
    sgMail.setApiKey(key);

    const lines = items
      .slice(0, 25)
      .map(
        (i) =>
          `- ${i.name} · ${i.ageDays} day${i.ageDays === 1 ? "" : "s"} old${i.ageDays >= URGENT_AFTER_DAYS ? "  ⚠ URGENT (near the 30-day limit)" : ""}${i.reason ? ` · "${i.reason}"` : ""}`,
      );
    const body = [
      `${items.length} account-deletion request${items.length === 1 ? " is" : "s are"} still pending.`,
      `POPIA requires these actioned within 30 days of the request.`,
      ``,
      ...lines,
      items.length > 25 ? `…and ${items.length - 25} more.` : ``,
      ``,
      `Erase them in the admin Deletion requests panel: ${APP_URL}/admin`,
      `(You must be signed in with 2-step verification to erase an account.)`,
    ]
      .filter((l) => l !== ``)
      .join("\n");

    try {
      await sgMail.send({
        to: FOUNDER_EMAIL,
        from: { email: from, name: "Workit · Compliance" },
        subject: urgent
          ? `[Workit] ⚠ ${urgent} deletion request${urgent === 1 ? "" : "s"} near the 30-day POPIA limit`
          : `[Workit] ${items.length} deletion request${items.length === 1 ? "" : "s"} awaiting action`,
        text: body,
        html: `<pre style="font-family:Arial,sans-serif;font-size:14px;line-height:1.55;white-space:pre-wrap;">${body
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")}</pre>`,
        trackingSettings: {
          clickTracking: { enable: false, enableText: false },
          openTracking: { enable: false },
        },
      });
      logger.info("deletion-aging reminder emailed", { count: items.length, oldest, urgent });
    } catch (err) {
      logger.error("deletion-aging email failed", { err: String(err) });
    }
  },
);
