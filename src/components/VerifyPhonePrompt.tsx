"use client";

/**
 * Prompts email/Google-signed-up users to VERIFY their phone number via OTP.
 * The signup form collects a typed number, but until it's OTP-confirmed anyone
 * could have entered anything — and a reachable number is core to a gig
 * marketplace (employers phone/WhatsApp workers to coordinate jobs).
 *
 * Uses linkWithPhoneNumber so the confirmed number also becomes a sign-in
 * method (they can use phone OTP to sign in next time). Not dismissible —
 * founder decision 2026-07-08: contact completeness is required.
 *
 * Hides itself once the account already has a phone provider linked.
 */

import { useState } from "react";
import type { ConfirmationResult } from "firebase/auth";
import Input from "./Input";
import Button from "./Button";
import { useAuth } from "@/contexts/AuthContext";
import { normaliseSaPhone } from "@/lib/phone";

const RECAPTCHA_ID = "recaptcha-verify-phone";

export default function VerifyPhonePrompt() {
  const { user, profile, startPhoneLink, confirmPhoneLink } = useAuth();
  const [phone, setPhone] = useState("");
  const [stage, setStage] = useState<"enter" | "code">("enter");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!user) return null;

  // Already has an OTP-confirmed number (phone sign-ups, or linked earlier).
  const hasPhoneProvider = user.providerData.some((p) => p.providerId === "phone");
  if (hasPhoneProvider || done) {
    return done ? (
      <section className="mb-6 rounded-2xl p-5 bg-[var(--color-sage-100)]/40 border border-[var(--color-sage-400)]/50 text-sm text-[var(--color-ink-soft)]">
        ✓ Phone verified — <b className="text-[var(--color-ink)]">{sentTo}</b> is confirmed
        as yours. You can also sign in with it next time.
      </section>
    ) : null;
  }

  const displayPhone = phone || profile?.phone || "";

  const onSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const e164 = normaliseSaPhone(displayPhone);
    if (!e164) {
      setError("Enter a valid SA mobile number (e.g. 082 123 4567).");
      return;
    }
    setBusy(true);
    try {
      const conf = await startPhoneLink(e164, RECAPTCHA_ID);
      setConfirmation(conf);
      setSentTo(e164);
      setStage("code");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("credential-already-in-use") || msg.includes("account-exists")) {
        setError(
          "That number is already linked to a different Workit account. If it's yours, sign in with the phone option instead — or contact support.",
        );
      } else if (msg.includes("too-many-requests")) {
        setError("Too many attempts — please wait a few minutes and try again.");
      } else {
        setError("Couldn't send the code. Check the number and try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  const onConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!confirmation) return;
    setBusy(true);
    try {
      await confirmPhoneLink(confirmation, code.trim(), sentTo);
      setDone(true);
    } catch (err) {
      // Map the REAL Firebase error — a correct code can still fail for
      // reasons that aren't "wrong code", and mislabeling them strands users.
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("provider-already-linked")) {
        // The phone is already linked to THIS account — that's success.
        setDone(true);
      } else if (msg.includes("credential-already-in-use") || msg.includes("account-exists")) {
        setError(
          "That number is already linked to a different Workit account. If it's yours, sign in with the phone option instead — or contact support.",
        );
      } else if (msg.includes("code-expired") || msg.includes("session-expired")) {
        setError("That code has expired (they only last a few minutes). Tap Change number and send a fresh one.");
      } else if (msg.includes("requires-recent-login")) {
        setError(
          "For security, Firebase needs a fresh sign-in before linking a number. Sign out, sign back in, then verify again — it'll work.",
        );
      } else if (msg.includes("invalid-verification-code")) {
        setError("That code doesn't match — double-check the SMS. If you requested more than one code, only the newest works.");
      } else if (msg.includes("too-many-requests")) {
        setError("Too many attempts — wait a few minutes, then send a fresh code.");
      } else {
        // Surface the real code so support/debugging isn't guessing.
        const codeMatch = msg.match(/auth\/[\w-]+/);
        setError(`Couldn't verify${codeMatch ? ` (${codeMatch[0]})` : ""} — try sending a fresh code.`);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-6 rounded-2xl p-5 sm:p-6 bg-[var(--color-ochre-50)] border border-[var(--color-ochre-300)] shadow-soft">
      <h2 className="font-display text-xl text-[var(--color-ink)]">Verify your phone number</h2>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)] max-w-md">
        Jobs get arranged by phone and WhatsApp — a confirmed number means
        {profile?.role === "worker" ? " employers" : " workers"} can actually reach you.
        We&apos;ll SMS you a 6-digit code once.
      </p>

      {stage === "enter" ? (
        <form onSubmit={onSendCode} className="mt-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[14rem]">
            <Input
              label="SA mobile number"
              name="verifyPhone"
              value={displayPhone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="082 123 4567"
              inputMode="tel"
              required
            />
          </div>
          <Button type="submit" variant="primary" size="md" loading={busy} loadingText="Sending…">
            Send code
          </Button>
        </form>
      ) : (
        <form onSubmit={onConfirm} className="mt-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[10rem]">
            <Input
              label={`Code sent to ${sentTo}`}
              name="verifyPhoneCode"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="6-digit code"
              inputMode="numeric"
              minLength={6}
              maxLength={6}
              required
            />
          </div>
          <Button type="submit" variant="primary" size="md" loading={busy} loadingText="Checking…">
            Confirm
          </Button>
          <button
            type="button"
            onClick={() => {
              setStage("enter");
              setCode("");
              setError(null);
            }}
            className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] underline"
          >
            Change number
          </button>
        </form>
      )}

      {error && <p className="mt-3 text-sm text-[var(--color-brick)]">{error}</p>}
      <div id={RECAPTCHA_ID} />
    </section>
  );
}
