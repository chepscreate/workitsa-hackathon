/**
 * Custom auth emails (password reset + email verification).
 *
 * Firebase's built-in auth-email templates are locked once a custom email domain
 * is configured, so instead of letting the client SDK trigger Firebase's emails
 * we generate the action links with the Admin SDK and send our own fully-branded
 * emails through SendGrid (same authenticated domain as all other Workit mail).
 *
 * The generated links default to the project's <project>.firebaseapp.com action
 * handler. We rewrite that origin to workitsa.co.za — Firebase Hosting serves the
 * identical /__/auth/action handler on the connected custom domain (verified
 * returning 200), so the branded link works the same.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getAuth } from "firebase-admin/auth";
import {
  send,
  shell,
  SENDGRID_API_KEY,
  SENDGRID_FROM_EMAIL,
  APP_URL,
} from "./mailer";

/** Rewrite the default firebaseapp.com action-handler origin to our domain. */
function brandLink(link: string): string {
  return link.replace(/^https:\/\/[^/]+(\/__\/auth\/action)/, `${APP_URL}$1`);
}

const secrets = [SENDGRID_API_KEY, SENDGRID_FROM_EMAIL];

export const requestPasswordReset = onCall({ secrets }, async (req) => {
  const email = String(req.data?.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new HttpsError("invalid-argument", "A valid email is required.");
  }
  try {
    const link = brandLink(await getAuth().generatePasswordResetLink(email));
    await send({
      to: email,
      subject: "Reset your Workit password",
      text:
        `We got a request to reset your Workit password. Open this link within ` +
        `an hour to choose a new one:\n\n${link}\n\n` +
        `Didn't ask for this? You can safely ignore this email — your password won't change.`,
      html: shell(
        "Reset your password",
        `<p>We got a request to reset the password for your Workit account.</p>
         <p>Click below to choose a new one — this link expires in about an hour.
         If you didn't ask for this, you can safely ignore this email; your
         password won't change.</p>`,
        { href: link, label: "Reset password" },
      ),
    });
  } catch (err) {
    // Never reveal whether an account exists — prevents email enumeration.
    logger.warn("password reset not sent", {
      reason: err instanceof Error ? err.message : "unknown",
    });
  }
  // Always report success so the response can't be used to probe for accounts.
  return { ok: true };
});

export const requestEmailVerification = onCall({ secrets }, async (req) => {
  if (!req.auth) {
    throw new HttpsError("unauthenticated", "Sign in to verify your email.");
  }
  const user = await getAuth().getUser(req.auth.uid);
  if (!user.email) {
    throw new HttpsError("failed-precondition", "No email on this account.");
  }
  if (user.emailVerified) return { ok: true, alreadyVerified: true };

  const link = brandLink(await getAuth().generateEmailVerificationLink(user.email));
  await send({
    to: user.email,
    subject: "Verify your email for Workit",
    text:
      `Welcome to Workit! Confirm your email address to activate your account:\n\n` +
      `${link}\n\nIf you didn't create a Workit account, you can ignore this email.`,
    html: shell(
      "Verify your email",
      `<p>Welcome to Workit! 🎉</p>
       <p>Confirm this is your email address to finish setting up your account.</p>`,
      { href: link, label: "Verify email" },
    ),
  });
  return { ok: true };
});
