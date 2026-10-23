"use client";

import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { getFunctionsInstance } from "@/lib/firebase";
import Button from "@/components/Button";

/**
 * One-click "send the welcome manual" button for the admin review cards.
 * The same email (role-aware how-to guide + social links) fires automatically
 * when a user is approved — this is for re-sends and for users approved before
 * the welcome email existed. Sends via the sendWelcomeEmail callable
 * (FROM tshepowayne@workitsa.co.za, BCC'd to the founder, audit-logged).
 */
export default function WelcomeEmailButton({ uid }: { uid: string }) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const onSend = async () => {
    setBusy(true);
    setError(null);
    try {
      const fn = httpsCallable<{ toUid: string }, { ok: boolean; to: string }>(
        getFunctionsInstance(),
        "sendWelcomeEmail",
      );
      const res = await fn({ toUid: uid });
      setSentTo(res.data.to);
    } catch (err) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Could not send.",
      );
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };

  if (sentTo) {
    return (
      <p className="text-xs text-[var(--color-sage-700)]">
        ✓ Welcome manual sent to {sentTo}
      </p>
    );
  }

  if (!confirm) {
    return (
      <Button size="sm" variant="outline" onClick={() => setConfirm(true)}>
        👋 Send welcome manual
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-[var(--color-ink-muted)]">
        Send the “how to use Workit” guide + social links from
        tshepowayne@workitsa.co.za?
      </p>
      {error && <p className="text-sm text-[var(--color-brick)]">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={() => setConfirm(false)} disabled={busy}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" onClick={onSend} loading={busy} loadingText="Sending…">
          Send welcome
        </Button>
      </div>
    </div>
  );
}
