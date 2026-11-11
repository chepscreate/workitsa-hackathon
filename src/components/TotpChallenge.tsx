"use client";

import { useState } from "react";
import Button from "./Button";
import Input from "./Input";
import { resolveTotpSignIn, resolverFor } from "@/lib/mfa";
import type { MultiFactorError, UserCredential } from "firebase/auth";

/**
 * Inline second-step prompt shown when sign-in throws
 * auth/multi-factor-auth-required. Used by the email form on /signin and by
 * GoogleButton — both hand over the raw MultiFactorError and get the
 * completed UserCredential back via onSuccess.
 */
export default function TotpChallenge({
  mfaError,
  onSuccess,
  onCancel,
}: {
  mfaError: MultiFactorError;
  onSuccess: (cred: UserCredential) => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length < 6) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const cred = await resolveTotpSignIn(resolverFor(mfaError), code);
      onSuccess(cred);
    } catch (err) {
      const c = (err as { code?: string })?.code ?? "";
      setError(
        c === "auth/invalid-verification-code"
          ? "That code didn't match. Check your authenticator app and try again."
          : "Couldn't verify the code. Please try again.",
      );
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5 animate-slide-up">
      <div className="flex items-center gap-3">
        <span className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--color-cream-2)] border border-[var(--color-line)] flex items-center justify-center text-lg">
          🔐
        </span>
        <div>
          <p className="font-medium text-[var(--color-ink)]">Two-step verification</p>
          <p className="text-sm text-[var(--color-ink-muted)]">
            Enter the 6-digit code from your authenticator app.
          </p>
        </div>
      </div>
      <Input
        label="Verification code"
        name="totp-code"
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="123456"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        error={error ?? undefined}
        autoFocus
      />
      <div className="flex gap-3">
        <Button type="submit" variant="primary" className="flex-1" loading={busy} loadingText="Verifying…">
          Verify
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
