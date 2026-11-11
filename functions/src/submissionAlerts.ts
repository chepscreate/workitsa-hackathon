/**
 * Real-time "new verification submission" alert — pings the founder (email)
 * and every admin (push) the moment someone submits or re-submits their
 * documents. Review speed is a trust feature: a worker approved within hours
 * tells their friends. The Jarvis morning digest still summarises daily; this
 * closes the hours-long gap in between.
 *
 * Fires on the same signal as onUserVerificationSubmitted (submittedAt
 * changed) but is a separate trigger so review-state machinery and
 * notification concerns stay independent.
 */
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import sgMail from "@sendgrid/mail";
import { SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, APP_URL, shell } from "./mailer";
import { dispatchPush } from "./notify";

const FOUNDER_EMAIL = "tshepowayne@workitsa.co.za";

type UserDoc = {
  role?: string;
  displayName?: string;
  email?: string;
  phone?: string;
  verificationStatus?: string;
  verification?: { submittedAt?: number; reviewedAt?: number };
};

export const onVerificationSubmittedAlert = onDocumentWritten(
  {
    document: "users/{uid}",
    secrets: [SENDGRID_API_KEY, SENDGRID_FROM_EMAIL],
  },
  async (event) => {
    const before = event.data?.before.data() as UserDoc | undefined;
    const after = event.data?.after.data() as UserDoc | undefined;
    if (!after || after.role === "admin") return;

    const beforeSubmittedAt = before?.verification?.submittedAt;
    const afterSubmittedAt = after.verification?.submittedAt;
    if (!afterSubmittedAt || afterSubmittedAt === beforeSubmittedAt) return;

    const uid = event.params.uid;
    const isResubmission = Boolean(before?.verification?.submittedAt);
    const name = after.displayName ?? "A user";
    const role = after.role ?? "user";

    // Which documents are actually present? (URLs live in the PRIVATE doc.)
    const db = getFirestore();
    let docsLine = "";
    try {
      const priv = await db.doc(`users/${uid}/private/profile`).get();
      const v = (priv.data()?.verification ?? {}) as Record<string, unknown>;
      const mark = (x: unknown) => (x ? "✓" : "✗");
      docsLine = `ID photo ${mark(v.idPhotoURL)} · selfie ${mark(v.selfieVideoURL)} · address proof ${mark(v.addressProofURL)} · police clearance ${mark(v.policeClearanceURL)}`;
    } catch {
      /* private doc unreadable — alert still goes out without the breakdown */
    }

    const title = isResubmission
      ? `↻ ${name} re-submitted verification docs`
      : `🆕 ${name} submitted verification docs`;
    const body = `${role} · ${docsLine || "documents attached"} — review in the admin panel while they're still excited.`;

    // Push every admin (fire-and-forget per admin).
    try {
      const admins = await db.collection("users").where("role", "==", "admin").get();
      await Promise.allSettled(
        admins.docs.map((d) =>
          dispatchPush({
            toUid: d.id,
            title,
            body: `${role} — open the admin panel to review.`,
            href: "/admin",
            tag: `verification-submitted-${uid}`,
          }),
        ),
      );
    } catch (err) {
      logger.warn("Submission alert push failed", { err: String(err) });
    }

    // Email the founder.
    const key = SENDGRID_API_KEY.value();
    const from = SENDGRID_FROM_EMAIL.value();
    if (key && from) {
      sgMail.setApiKey(key);
      try {
        await sgMail.send({
          to: FOUNDER_EMAIL,
          from: { email: from, name: "Workit" },
          subject: title,
          text: `${body}\n\nReview: ${APP_URL}/admin`,
          html: shell(
            title,
            `<p><b>${name}</b> (${role}) ${isResubmission ? "re-submitted" : "submitted"} verification documents.</p>
             <p>${docsLine || ""}</p>
             <p>Contact: ${after.email ?? "no email"} · ${after.phone ?? "no phone"}</p>`,
            { href: `${APP_URL}/admin`, label: "Review now" },
          ),
        });
      } catch (err) {
        logger.warn("Submission alert email failed", { err: String(err) });
      }
    }

    logger.info("Verification submission alert sent", { uid, isResubmission });
  },
);
