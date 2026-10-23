/**
 * Shared SendGrid mailer — used by the Firestore-triggered notification emails
 * (email.ts) and the custom auth emails (authEmails.ts).
 *
 * Secrets (set once): SENDGRID_API_KEY, SENDGRID_FROM_EMAIL.
 */
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import sgMail from "@sendgrid/mail";

export const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");
export const SENDGRID_FROM_EMAIL = defineSecret("SENDGRID_FROM_EMAIL");

export const APP_URL = "https://workitsa.co.za";
/** Where replies + unsubscribe requests go. */
export const SUPPORT_EMAIL = "tshepowayne@workitsa.co.za";
/** Postal line in the footer — improves spam score + good practice. */
export const POSTAL_LINE = "Furthersky Solutions, Gauteng, South Africa";

export async function send(opts: {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Optional copy (e.g. the founder on account-approval emails). Skipped
   *  automatically when it duplicates `to` — SendGrid rejects that. */
  bcc?: string;
}): Promise<void> {
  const key = SENDGRID_API_KEY.value();
  const from = SENDGRID_FROM_EMAIL.value();
  if (!key || !from) {
    logger.warn("SendGrid not configured; skipping email", { to: opts.to });
    return;
  }
  sgMail.setApiKey(key);

  // Gmail/Yahoo (Feb 2024 bulk-sender rules) and most spam filters strongly
  // favour mail that carries a List-Unsubscribe header and a Reply-To.
  const unsubMailto = `mailto:${SUPPORT_EMAIL}?subject=unsubscribe`;
  const unsubUrl = `${APP_URL}/account`;

  await sgMail.send({
    to: opts.to,
    from: { email: from, name: "Workit" },
    replyTo: { email: SUPPORT_EMAIL, name: "Workit Support" },
    ...(opts.bcc && opts.bcc.toLowerCase() !== opts.to.toLowerCase()
      ? { bcc: opts.bcc }
      : {}),
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    headers: {
      "List-Unsubscribe": `<${unsubMailto}>, <${unsubUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    // Transactional mail: open/click tracking pixels and rewritten links are a
    // classic spam-trigger. Turn them off so the mail stays clean.
    trackingSettings: {
      clickTracking: { enable: false, enableText: false },
      openTracking: { enable: false },
    },
    mailSettings: {
      bypassListManagement: { enable: false },
    },
  });
}

export function shell(
  title: string,
  body: string,
  cta?: { href: string; label: string },
): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f1612;background:#faf4ec;border-radius:12px;">
      <h1 style="font-size:22px;margin:0 0 16px;color:#b85a2a;">${title}</h1>
      <div style="font-size:15px;line-height:1.55;color:#4a3a30;">${body}</div>
      ${
        cta
          ? `<p style="margin-top:24px;"><a href="${cta.href}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#d97742;color:#faf4ec;text-decoration:none;font-weight:600;">${cta.label}</a></p>`
          : ""
      }
      <hr style="border:none;border-top:1px solid #e5d9c4;margin:32px 0 16px;">
      <p style="font-size:12px;color:#7a6a5e;margin:0 0 6px;">Workit · South Africa's people-first work marketplace · <a href="${APP_URL}" style="color:#b85a2a;">workitsa.co.za</a></p>
      <p style="font-size:11px;color:#7a6a5e;margin:0;">${POSTAL_LINE}. You're getting this because you have a Workit account. <a href="${APP_URL}/account" style="color:#b85a2a;">Manage email preferences</a>.</p>
    </div>
  `;
}
