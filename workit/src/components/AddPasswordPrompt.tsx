"use client";

/**
 * Prompts phone-signed-up users to add an email + password so they can sign
 * in with email next time and skip the SMS dance. Hides itself once the user
 * already has an email/password provider linked, or if they dismiss it.
 *
 * Order of events when they fill it in:
 *   1. linkWithCredential() attaches email+password to the existing user
 *   2. The email is mirrored to the Firestore profile
 *   3. sendEmailVerification() fires the verification email
 *   4. User can sign in with email+password immediately, even before
 *      verifying — verification is for the email field itself, not for
 *      enabling the password.
 */

import { useState } from "react";
import Input from "./Input";
import Button from "./Button";
import { useAuth } from "@/contexts/AuthContext";

export default function AddPasswordPrompt() {
  const { user, linkEmailPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [open, setOpen] = useState(false);

  if (!user) return null;

  // Detect: account was created with phone only, no password credential yet.
  const providers = user.providerData.map((p) => p.providerId);
  const hasPhone = providers.includes("phone");
  const hasPassword = providers.includes("password");
  if (!hasPhone || hasPassword) return null;

  if (done) {
    return (
      <section className="rounded-2xl p-5 bg-[var(--color-sage-100)]/40 border border-[var(--color-sage-400)]/50 text-sm text-[var(--color-ink-soft)]">
        ✓ Email + password added. Check your inbox for a verification link from
        Workit so we know the address is yours. You can now sign in with{" "}
        <b className="text-[var(--color-ink)]">{email}</b> next time you visit.
      </section>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await linkEmailPassword(email.trim(), password);
      setDone(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not add password.";
      if (msg.includes("auth/email-already-in-use")) {
        setError("That email is already linked to another Workit account.");
      } else if (msg.includes("auth/weak-password")) {
        setError("Password is too weak — pick something harder to guess.");
      } else if (msg.includes("auth/invalid-email")) {
        setError("That doesn't look like a valid email address.");
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  // No dismiss — founder decision 2026-07-08: every account needs a reachable,
  // verified email (review decisions + POPIA notices go there). The card stays
  // until the email is linked.
  if (!open) {
    return (
      <section className="rounded-2xl p-5 bg-[var(--color-ochre-50)] border border-[var(--color-ochre-300)] text-sm flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <p className="font-medium text-[var(--color-ink)]">
            Add your email address
          </p>
          <p className="mt-1 text-[var(--color-ink-soft)]">
            We send important account updates (like your verification result) by
            email — and you&apos;ll be able to sign in without waiting for an SMS.
            Your phone stays linked too.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="px-4 py-2 rounded-pill bg-[var(--color-ink)] text-[var(--color-cream)] text-sm font-medium hover:opacity-90"
          >
            Add email
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
      <h2 className="font-display text-xl text-[var(--color-ink)]">
        Add an email + password
      </h2>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
        Use this email and password to sign in faster next time. Your phone
        stays linked — you can still use SMS if you ever forget.
      </p>
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <Input
          label="Email address"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
        <Input
          label="New password"
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <Input
          label="Confirm password"
          name="confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Type it again"
          autoComplete="new-password"
          minLength={8}
          required
        />
        {error && <p className="text-sm text-[var(--color-brick)]">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" size="md" loading={busy} loadingText="Saving…">
            Save and send verification email
          </Button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-5 py-2.5 rounded-pill text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
          >
            Cancel
          </button>
        </div>
        <p className="text-xs text-[var(--color-ink-muted)]">
          We&apos;ll email you a one-tap verification link. You can sign in
          with the email + password right away — verification just confirms
          the address is yours.
        </p>
      </form>
    </section>
  );
}
