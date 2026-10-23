"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/LocaleContext";
import TotpChallenge from "./TotpChallenge";
import { isMfaRequiredError } from "@/lib/mfa";
import type { MultiFactorError } from "firebase/auth";

/**
 * "Continue with Google" button. Runs the popup; existing users go straight to
 * their account, brand-new users go to /finish-signup to pick a role + confirm
 * age (which Google doesn't provide) before their profile is created.
 */
export default function GoogleButton({
  label,
  next,
}: {
  label?: string;
  /** Where existing users land after sign-in (defaults to /account). */
  next?: string;
}) {
  const { signInWithGoogle, configured } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const resolvedLabel = label ?? t("auth.google.default");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Account has two-step verification — show the code prompt to finish.
  const [mfaError, setMfaError] = useState<MultiFactorError | null>(null);

  const onClick = async () => {
    setBusy(true);
    setError(null);
    try {
      const { isNewUser } = await signInWithGoogle();
      router.push(isNewUser ? "/finish-signup" : next ?? "/account");
    } catch (err) {
      if (isMfaRequiredError(err)) {
        // An MFA-enrolled account always has a profile — never a new user.
        setMfaError(err);
        setBusy(false);
        return;
      }
      const code = (err as { code?: string })?.code ?? "";
      // The user closing the popup isn't a real error worth surfacing.
      if (
        code !== "auth/popup-closed-by-user" &&
        code !== "auth/cancelled-popup-request"
      ) {
        setError(t("auth.google.error"));
      }
    } finally {
      setBusy(false);
    }
  };

  if (mfaError) {
    return (
      <TotpChallenge
        mfaError={mfaError}
        onSuccess={() => router.push(next ?? "/account")}
        onCancel={() => setMfaError(null)}
      />
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={busy || !configured}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-md bg-[var(--color-paper)] border border-[var(--color-line)] text-[var(--color-ink)] font-medium hover:bg-[var(--color-cream-2)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ochre-300)] disabled:opacity-50 transition-colors"
      >
        <GoogleG />
        {busy ? t("auth.google.opening") : resolvedLabel}
      </button>
      {error && (
        <p className="mt-2 text-xs text-[var(--color-brick)] text-center">{error}</p>
      )}
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden focusable="false">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
