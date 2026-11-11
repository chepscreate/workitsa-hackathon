/**
 * adminEmailUser — lets the admin email a specific Workit user from the
 * founder's address (tshepowayne@workitsa.co.za) straight out of the admin
 * panel (e.g. "you're missing your verification documents" reminders).
 *
 * Safety rails:
 *  - Admin-gated (role check server-side).
 *  - Takes a UID, NOT an email address — the recipient is looked up from the
 *    user doc, so this can never be used as an open relay to outside addresses.
 *  - Every send is written to the audit log.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import sgMail from "@sendgrid/mail";
import { SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, APP_URL, shell } from "./mailer";
import { requireCan } from "./perms";
import { buildWelcomeEmail, loadSocialLinks } from "./welcomeContent";

const FOUNDER_EMAIL = "tshepowayne@workitsa.co.za";
const FOUNDER_NAME = "Tshepo from Workit";

type AnyDoc = Record<string, unknown>;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const adminEmailUser = onCall(
  { timeoutSeconds: 30, secrets: [SENDGRID_API_KEY, SENDGRID_FROM_EMAIL] },
  async (req) => {
    if (!req.auth) throw new HttpsError("unauthenticated", "Sign in.");
    // RBAC phase 2: the docs-reminder email is queue work — approvals or
    // verification roles qualify.
    await requireCan(req.auth, "approvals.manage", "verification.review");
    const db = getFirestore();
    const me = await db.collection("users").doc(req.auth.uid).get();

    const toUid = String(req.data?.toUid ?? "").trim();
    const subject = String(req.data?.subject ?? "").trim();
    const body = String(req.data?.body ?? "").trim();
    if (!toUid) throw new HttpsError("invalid-argument", "toUid required.");
    if (subject.length < 3 || subject.length > 150) {
      throw new HttpsError("invalid-argument", "Subject must be 3–150 characters.");
    }
    if (body.length < 10 || body.length > 5000) {
      throw new HttpsError("invalid-argument", "Body must be 10–5000 characters.");
    }

    const target = await db.collection("users").doc(toUid).get();
    if (!target.exists) throw new HttpsError("not-found", "No such user.");
    const email = String((target.data() as AnyDoc).email ?? "").trim();
    if (!email) throw new HttpsError("failed-precondition", "That user has no email address.");

    const key = SENDGRID_API_KEY.value();
    if (!key) throw new HttpsError("failed-precondition", "SendGrid not configured.");
    sgMail.setApiKey(key);

    // Plain personal note wrapped in the branded shell; newlines → paragraphs.
    const html = shell(
      subject,
      esc(body)
        .split(/\n{2,}/)
        .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
        .join(""),
      { href: `${APP_URL}/verification`, label: "Open my verification page" },
    );

    await sgMail.send({
      to: email,
      from: { email: FOUNDER_EMAIL, name: FOUNDER_NAME },
      replyTo: { email: FOUNDER_EMAIL, name: FOUNDER_NAME },
      // BCC the founder so every send lands in the real mailbox as a record —
      // SendGrid delivery bypasses Outlook entirely, so the Sent folder never
      // sees these. (Skipped when emailing the founder themselves: SendGrid
      // rejects a bcc that duplicates the to-address.)
      ...(email.toLowerCase() !== FOUNDER_EMAIL
        ? { bcc: { email: FOUNDER_EMAIL, name: FOUNDER_NAME } }
        : {}),
      subject,
      text: `${body}\n\n${APP_URL}/verification`,
      html,
    });

    await db.collection("auditLog").add({
      action: "user_email_sent",
      adminUid: req.auth.uid,
      adminName: String((me.data() as AnyDoc | undefined)?.displayName ?? "Admin"),
      targetUid: toUid,
      targetName: String((target.data() as AnyDoc).displayName ?? "user"),
      note: subject,
      at: Date.now(),
    });
    logger.info("Admin emailed user", { toUid, subject });

    return { ok: true, to: email };
  },
);

/**
 * sendWelcomeEmail — sends the "how to use Workit" welcome manual (+ social
 * links) to a user on demand from the admin panel. Same rails as above:
 * UID-only (no open relay), admin-gated, BCC'd to the founder, audit-logged.
 * The identical email also fires automatically on approval
 * (verificationAlerts.ts) — this callable is for re-sends and for welcoming
 * users who were approved before the welcome email existed.
 */
export const sendWelcomeEmail = onCall(
  { timeoutSeconds: 30, secrets: [SENDGRID_API_KEY, SENDGRID_FROM_EMAIL] },
  async (req) => {
    if (!req.auth) throw new HttpsError("unauthenticated", "Sign in.");
    await requireCan(req.auth, "approvals.manage", "verification.review");
    const db = getFirestore();
    const me = await db.collection("users").doc(req.auth.uid).get();

    const toUid = String(req.data?.toUid ?? "").trim();
    if (!toUid) throw new HttpsError("invalid-argument", "toUid required.");

    const target = await db.collection("users").doc(toUid).get();
    if (!target.exists) throw new HttpsError("not-found", "No such user.");
    const t = target.data() as AnyDoc;
    const email = String(t.email ?? "").trim();
    if (!email) throw new HttpsError("failed-precondition", "That user has no email address.");

    const key = SENDGRID_API_KEY.value();
    if (!key) throw new HttpsError("failed-precondition", "SendGrid not configured.");
    sgMail.setApiKey(key);

    const social = await loadSocialLinks();
    const name = String(t.displayName ?? "there").split(" ")[0];
    const { subject, html, text } = buildWelcomeEmail({
      role: typeof t.role === "string" ? t.role : undefined,
      name,
      social,
    });

    await sgMail.send({
      to: email,
      from: { email: FOUNDER_EMAIL, name: FOUNDER_NAME },
      replyTo: { email: FOUNDER_EMAIL, name: FOUNDER_NAME },
      ...(email.toLowerCase() !== FOUNDER_EMAIL
        ? { bcc: { email: FOUNDER_EMAIL, name: FOUNDER_NAME } }
        : {}),
      subject,
      text,
      html,
    });

    await db.collection("auditLog").add({
      action: "welcome_email_sent",
      adminUid: req.auth.uid,
      adminName: String((me.data() as AnyDoc | undefined)?.displayName ?? "Admin"),
      targetUid: toUid,
      targetName: String(t.displayName ?? "user"),
      note: subject,
      at: Date.now(),
    });
    logger.info("Welcome email sent", { toUid });

    return { ok: true, to: email };
  },
);
