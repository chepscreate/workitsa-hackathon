/**
 * Verification decision notifications — the "communication back" loop.
 *
 * When an admin reviews a submission (approve / reject / request changes),
 * the user gets told IMMEDIATELY — push notification + email — including the
 * admin's reviewer note (e.g. "Your ID photo is blurry, please re-upload").
 * Without this, a user only discovered the decision by reopening the app.
 *
 * Fires on users/{uid} writes when verificationStatus actually transitions.
 * Read-only side effects (push + email) — writes nothing back, no loop risk.
 */
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, APP_URL, SUPPORT_EMAIL, send, shell } from "./mailer";
import { dispatchPush } from "./notify";
import { buildWelcomeEmail, loadSocialLinks } from "./welcomeContent";

type UserDoc = {
  role?: string;
  email?: string;
  displayName?: string;
  verificationStatus?: string;
  verification?: { reviewerNote?: string };
};

const MESSAGES: Record<
  string,
  (note: string | undefined, name: string, role?: string) => { title: string; body: string; emailBody: string; cta: string }
> = {
  changes_requested: (note, name) => ({
    title: "One quick fix needed on your verification",
    body: note ? note.slice(0, 130) : "Please check your verification and resubmit.",
    emailBody: `<p>Hi ${name},</p><p>Thanks for submitting your Workit verification — we're nearly there, but one thing needs fixing before we can approve you:</p><p style="padding:12px 16px;background:#faf4ec;border-left:3px solid #d97742;font-weight:600;">${note ?? "Please review your submitted documents."}</p><p>Fix it on your verification page and resubmit — it goes straight back to the front of the review queue.</p>`,
    cta: "Fix my verification",
  }),
  // Approval copy is role-aware — employers/businesses verify too (since
  // 2026-07-08) and were getting the "you're now a verified worker" email.
  approved: (_note, name, role) =>
    role === "worker"
      ? {
          title: "You're verified ✅",
          body: "Your Workit verification is approved — you can now accept jobs. Welcome!",
          emailBody: `<p>Hi ${name},</p><p>Great news — your verification has been <b>approved</b>. You're now a verified Workit worker: employers see the ✓ badge on your profile, and you can accept jobs and send offers.</p><p>Set yourself as <b>available now</b> and add your skills to get matched faster.</p>`,
          cta: "Find work near me",
        }
      : {
          title: "Your Workit account is approved ✅",
          body: "Your identity is verified and your account is active — you can now post jobs and hire.",
          emailBody: `<p>Hi ${name},</p><p>Great news — your identity verification has been <b>approved</b> and your account is active. You can now post jobs and hire trusted, ID-verified workers near you.</p><p>Workers see a ✓ ID-verified badge on your jobs — it helps them accept faster.</p>`,
          cta: "Post your first job",
        },
  rejected: (note, name) => ({
    title: "Update on your Workit verification",
    body: note ? note.slice(0, 130) : "Your verification wasn't approved. See the note on your verification page.",
    emailBody: `<p>Hi ${name},</p><p>Unfortunately we couldn't approve your verification this time.</p>${note ? `<p style="padding:12px 16px;background:#faf4ec;border-left:3px solid #a93226;font-weight:600;">${note}</p>` : ""}<p>You're welcome to fix the issue and resubmit — resubmissions go back into the review queue automatically.</p>`,
    cta: "Review and resubmit",
  }),
};

const CTA_PATH: Record<string, string> = {
  changes_requested: "/verification",
  approved: "/find-work",
  rejected: "/verification",
};

export const onVerificationDecision = onDocumentWritten(
  {
    document: "users/{uid}",
    secrets: [SENDGRID_API_KEY, SENDGRID_FROM_EMAIL],
  },
  async (event) => {
    const before = event.data?.before.data() as UserDoc | undefined;
    const after = event.data?.after.data() as UserDoc | undefined;
    if (!after) return;

    const prev = before?.verificationStatus ?? "none";
    const next = after.verificationStatus ?? "none";
    if (prev === next) return; // not a decision transition
    const make = MESSAGES[next];
    if (!make) return; // none/pending transitions are silent

    const uid = event.params.uid;
    const name = (after.displayName ?? "there").split(" ")[0];
    const note = after.verification?.reviewerNote;
    const msg = make(note, name, after.role);
    const href =
      next === "approved" && after.role !== "worker"
        ? "/post-a-job"
        : CTA_PATH[next] ?? "/account";

    // Push (silently no-ops if the user has no registered devices).
    try {
      await dispatchPush({ toUid: uid, title: msg.title, body: msg.body, href });
    } catch (err) {
      logger.warn("Verification decision push failed", { uid, err: String(err) });
    }

    // Email — the reliable channel for users who haven't enabled push.
    const email = after.email;
    if (email) {
      try {
        if (next === "approved") {
          // Approval is the welcome moment: send the full "how to use Workit"
          // manual + social links instead of a one-line "you're approved".
          // Founder gets a BCC copy (his ask 2026-07-10) — a record of who was
          // let onto the platform.
          const social = await loadSocialLinks();
          const w = buildWelcomeEmail({ role: after.role, name, social });
          await send({ to: email, subject: w.subject, text: w.text, html: w.html, bcc: SUPPORT_EMAIL });
        } else {
          await send({
            to: email,
            subject: msg.title.replace(" ✅", ""),
            text: `${msg.body}\n\nOpen: ${APP_URL}${href}`,
            html: shell(msg.title, msg.emailBody, { href: `${APP_URL}${href}`, label: msg.cta }),
          });
        }
      } catch (err) {
        logger.warn("Verification decision email failed", { uid, err: String(err) });
      }
    }
    logger.info(`Verification decision notified: ${prev} → ${next}`, { uid });
  },
);
