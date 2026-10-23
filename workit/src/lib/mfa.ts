"use client";

/**
 * TOTP two-factor authentication helpers (Identity Platform).
 *
 * Project-side TOTP MFA was enabled 2026-06-11 (Identity Platform upgrade +
 * `mfa.providerConfigs[totp].state=ENABLED`). These helpers wrap the
 * firebase/auth multi-factor APIs so pages don't deal with the SDK shapes.
 *
 * Policy: MFA is OPTIONAL for regular users and REQUIRED for admins — the
 * admin page refuses to render until the signed-in admin has a TOTP factor
 * (see app/admin/page.tsx). Enforcement is client-side; the real protection
 * is that Firebase itself rejects password-only sign-in for enrolled users.
 *
 * Lost authenticator: the secret key shown at enrollment doubles as the
 * backup — re-entering it in a new authenticator app restores codes. Failing
 * that, the other admin must delete the user's second factor in the Firebase
 * console (Authentication → user → multi-factor).
 */

import {
  getMultiFactorResolver,
  multiFactor,
  TotpMultiFactorGenerator,
  TotpSecret,
  type MultiFactorError,
  type MultiFactorResolver,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "./firebase";

export type TotpEnrollment = {
  secret: TotpSecret;
  /** otpauth:// URI for the QR code. */
  qrUri: string;
  /** Base32 key for manual entry (also the user's backup). */
  secretKey: string;
};

export function hasTotp(user: User | null): boolean {
  if (!user) return false;
  return multiFactor(user).enrolledFactors.some(
    (f) => f.factorId === TotpMultiFactorGenerator.FACTOR_ID,
  );
}

/**
 * Whether the user's CURRENT session passed a second factor — distinct from
 * being enrolled. Admin rules + the sensitive callables require this, so the
 * admin gate uses it: enrolling mid-session isn't enough, you must sign in
 * again with the code. Reads the ID token's `firebase.sign_in_second_factor`.
 */
export async function sessionUsedMfa(user: User | null): Promise<boolean> {
  if (!user) return false;
  try {
    const res = await user.getIdTokenResult();
    const fb = res.claims.firebase as { sign_in_second_factor?: string } | undefined;
    return !!fb?.sign_in_second_factor;
  } catch {
    return false;
  }
}

export function totpFactor(user: User) {
  return multiFactor(user).enrolledFactors.find(
    (f) => f.factorId === TotpMultiFactorGenerator.FACTOR_ID,
  );
}

/** Step 1 of enrollment — may throw auth/requires-recent-login. */
export async function startTotpEnrollment(user: User): Promise<TotpEnrollment> {
  const session = await multiFactor(user).getSession();
  const secret = await TotpMultiFactorGenerator.generateSecret(session);
  const qrUri = secret.generateQrCodeUrl(
    user.email ?? user.displayName ?? "Workit account",
    "Workit",
  );
  return { secret, qrUri, secretKey: secret.secretKey };
}

/** Step 2 — verify the 6-digit code from the authenticator app. */
export async function finishTotpEnrollment(
  user: User,
  secret: TotpSecret,
  code: string,
): Promise<void> {
  const assertion = TotpMultiFactorGenerator.assertionForEnrollment(
    secret,
    code.trim(),
  );
  await multiFactor(user).enroll(assertion, "Authenticator app");
}

/** Remove the TOTP factor — may throw auth/requires-recent-login. */
export async function unenrollTotp(user: User): Promise<void> {
  const factor = totpFactor(user);
  if (!factor) return;
  await multiFactor(user).unenroll(factor);
}

export function isMfaRequiredError(err: unknown): err is MultiFactorError {
  return (err as { code?: string })?.code === "auth/multi-factor-auth-required";
}

export function isRecentLoginError(err: unknown): boolean {
  return (err as { code?: string })?.code === "auth/requires-recent-login";
}

export function resolverFor(err: MultiFactorError): MultiFactorResolver {
  return getMultiFactorResolver(getFirebaseAuth(), err);
}

/** Complete an MFA-challenged sign-in with the 6-digit TOTP code. */
export async function resolveTotpSignIn(
  resolver: MultiFactorResolver,
  code: string,
) {
  const hint = resolver.hints.find(
    (h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID,
  );
  if (!hint) throw new Error("No authenticator factor on this account.");
  const assertion = TotpMultiFactorGenerator.assertionForSignIn(
    hint.uid,
    code.trim(),
  );
  return resolver.resolveSignIn(assertion);
}
