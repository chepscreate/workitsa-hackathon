/**
 * Instant founder alerts for events that can't wait for the morning digest.
 *
 * Reports already alert via reportsHandler.ts (incl. the CSAM hard path). This
 * adds the other "wake me up" event: a job going into dispute. Email goes to
 * the founder so it lands on their phone even when they're out of the dashboard.
 */
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import sgMail from "@sendgrid/mail";
import { SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, APP_URL } from "./mailer";
import { dispatchPush } from "./notify";

const FOUNDER_EMAIL = "tshepowayne@workitsa.co.za";

type JobDoc = {
  title?: string;
  status?: string;
  employerName?: string;
  assignedWorkerName?: string;
  agreedPrice?: number;
  suggestedPrice?: number;
  suburb?: string;
  dispute?: {
    reason?: string;
    raisedByName?: string;
    raisedByRole?: string;
    description?: string;
  };
};

export const onJobDisputedAlert = onDocumentUpdated(
  { document: "jobs/{jobId}", secrets: [SENDGRID_API_KEY, SENDGRID_FROM_EMAIL] },
  async (event) => {
    const before = event.data?.before.data() as JobDoc | undefined;
    const after = event.data?.after.data() as JobDoc | undefined;
    if (!before || !after) return;
    // Only fire on the transition INTO disputed.
    if (before.status === "disputed" || after.status !== "disputed") return;

    const key = SENDGRID_API_KEY.value();
    const from = SENDGRID_FROM_EMAIL.value();
    if (!key || !from) {
      logger.warn("SendGrid not configured; skipping dispute alert");
      return;
    }
    sgMail.setApiKey(key);

    const d = after.dispute ?? {};
    const price = after.agreedPrice ?? after.suggestedPrice;
    const body = [
      `A job has been put into dispute and is now frozen.`,
      ``,
      `Job: ${after.title ?? "(untitled)"}`,
      `Where: ${after.suburb ?? "—"}`,
      `Employer: ${after.employerName ?? "—"}`,
      `Worker: ${after.assignedWorkerName ?? "—"}`,
      price != null ? `Agreed price: R ${price}` : ``,
      ``,
      `Raised by: ${d.raisedByName ?? "—"} (${d.raisedByRole ?? "—"})`,
      `Reason: ${d.reason ?? "—"}`,
      ``,
      `What they said:`,
      d.description ?? "(none)",
      ``,
      `Resolve it in the Disputes tab: ${APP_URL}/admin`,
    ]
      .filter((line) => line !== ``)
      .join("\n");

    try {
      await sgMail.send({
        to: FOUNDER_EMAIL,
        from: { email: from, name: "Workit · Jarvis" },
        subject: `[Workit] Dispute opened — ${after.title ?? "a job"}`,
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
      logger.info("Dispute alert emailed", { jobId: event.params.jobId });
    } catch (err) {
      logger.error("Dispute alert email failed", { err: String(err) });
    }
  },
);

// ---------- SOS / EMERGENCY ----------

type EmergencyShape = {
  triggeredBy?: string;
  triggeredByName?: string;
  triggeredByRole?: string;
  at?: number;
  lat?: number;
  lng?: number;
  accuracy?: number;
  status?: string;
};

type EmergencyJobDoc = JobDoc & {
  city?: string;
  emergency?: EmergencyShape;
  emergencyTriggeredAt?: number;
};

/**
 * The lifeline: when a worker (or employer) raises an SOS from an active job,
 * page the safety team in real time — founder email + push to every admin —
 * with who, which job, where (a Google Maps pin from the GPS captured at the
 * moment of the alert), and the SAPS reminder. Fires once per fresh alert; the
 * admin resolving it (status → resolved) does NOT re-fire.
 */
export const onJobEmergencyAlert = onDocumentUpdated(
  { document: "jobs/{jobId}", secrets: [SENDGRID_API_KEY, SENDGRID_FROM_EMAIL] },
  async (event) => {
    const before = event.data?.before.data() as EmergencyJobDoc | undefined;
    const after = event.data?.after.data() as EmergencyJobDoc | undefined;
    if (!after) return;

    const e = after.emergency;
    const at = e?.at ?? after.emergencyTriggeredAt;
    const prevAt = before?.emergency?.at ?? before?.emergencyTriggeredAt;
    // Only on a NEW active alert (a fresh timestamp). Resolving keeps `at`.
    const isNew = !!at && at !== prevAt && (e?.status ?? "active") === "active";
    if (!isNew) return;

    const who = e?.triggeredByName
      ?? (e?.triggeredByRole === "employer" ? after.employerName : after.assignedWorkerName)
      ?? "Someone";
    const where = [after.suburb, after.city].filter(Boolean).join(", ") || "location unknown";
    const mapLink =
      e?.lat != null && e?.lng != null
        ? `https://www.google.com/maps?q=${e.lat},${e.lng}`
        : null;
    const jobId = event.params.jobId;

    // 1) Push every admin (instant, on their phone if they've enabled it).
    try {
      const admins = await getFirestore().collection("users").where("role", "==", "admin").get();
      await Promise.allSettled(
        admins.docs.map((d) =>
          dispatchPush({
            toUid: d.id,
            title: "🚨 SOS raised on Workit",
            body: `${who} feels unsafe — ${after.title ?? "a job"} · ${where}. Open now.`,
            href: "/admin",
            tag: `sos-${jobId}`,
          }),
        ),
      );
    } catch (err) {
      logger.error("SOS admin push failed", { jobId, err: String(err) });
    }

    // 2) Email the founder (reliable channel — lands even when out of the app).
    const key = SENDGRID_API_KEY.value();
    const from = SENDGRID_FROM_EMAIL.value();
    if (!key || !from) {
      logger.warn("SendGrid not configured; SOS email skipped", { jobId });
      return;
    }
    sgMail.setApiKey(key);

    const body = [
      `🚨 SOS — someone on an active job has pressed the emergency button.`,
      ``,
      `Who: ${who}${e?.triggeredByRole ? ` (${e.triggeredByRole})` : ""}`,
      `Job: ${after.title ?? "(untitled)"}`,
      `Where: ${where}`,
      `Employer: ${after.employerName ?? "—"}`,
      `Worker: ${after.assignedWorkerName ?? "—"}`,
      mapLink ? `Location pin: ${mapLink}` : `Location: not shared by the device.`,
      e?.accuracy != null ? `(GPS accuracy ~${Math.round(e.accuracy)} m)` : ``,
      ``,
      `They have been prompted to call SAPS (10111). Check on them now.`,
      `Open the job in the admin Safety queue: ${APP_URL}/admin`,
    ]
      .filter((line) => line !== ``)
      .join("\n");

    try {
      await sgMail.send({
        to: FOUNDER_EMAIL,
        from: { email: from, name: "Workit · Safety" },
        subject: `[Workit] 🚨 SOS — ${who} on ${after.title ?? "a job"}`,
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
      logger.info("SOS alert emailed", { jobId });
    } catch (err) {
      logger.error("SOS alert email failed", { jobId, err: String(err) });
    }
  },
);
