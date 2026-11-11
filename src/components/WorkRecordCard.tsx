"use client";

/**
 * Work Record entry point on /account (workers only) — generates/refreshes the
 * worker's shareable proof-of-work certificate via the generateWorkRecord
 * callable and opens it at /record?t={token}. Before the first completed job
 * it shows a locked teaser instead (an empty certificate helps nobody).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import { generateWorkRecord } from "@/lib/workRecord";
import type { UserProfile } from "@/lib/types";

export default function WorkRecordCard({ profile }: { profile: UserProfile }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasWork = (profile.jobsCompleted ?? 0) > 0;

  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      const token = await generateWorkRecord();
      router.push(`/record?t=${token}`);
    } catch {
      setError("Couldn't open your Work Record just now — please try again.");
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl p-5 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 max-w-md">
          <h3 className="font-display text-lg text-[var(--color-ink)]">📄 My Work Record</h3>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            {hasWork
              ? "Your verified proof-of-work certificate — every confirmed job, what you earned, your rating, and confirmed payments, on one shareable page. Show it to a landlord, lender, or employer."
              : "Complete your first job and Workit turns your history into a verified proof-of-work certificate — real evidence of income you can show a landlord, lender, or employer."}
          </p>
        </div>
        {hasWork ? (
          <Button variant="primary" size="sm" onClick={open} loading={busy} loadingText="Preparing…">
            Open my record
          </Button>
        ) : (
          <span className="px-3 py-1.5 rounded-pill text-xs font-medium bg-[var(--color-cream-2)] border border-[var(--color-line)] text-[var(--color-ink-muted)]">
            🔒 Unlocks after your first job
          </span>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-[var(--color-brick)]">{error}</p>}
    </section>
  );
}
