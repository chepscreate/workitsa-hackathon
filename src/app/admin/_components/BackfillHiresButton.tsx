"use client";

import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { getFunctionsInstance } from "@/lib/firebase";
import Button from "@/components/Button";

/**
 * One-time backfill: set each employer's `employerJobsHired` to their true
 * lifetime confirmed-hire count, so the worker-facing trust panel is accurate
 * for employers who hired before the counter trigger shipped. Idempotent.
 */
export default function BackfillHiresButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      const fn = httpsCallable<unknown, { ok: boolean; jobs: number; employersUpdated: number }>(
        getFunctionsInstance(),
        "backfillEmployerHires",
      );
      const res = await fn({});
      setResult(`Done — scanned ${res.data.jobs} jobs, set hire counts on ${res.data.employersUpdated} employers.`);
    } catch (err: unknown) {
      setResult(
        err && typeof err === "object" && "message" in err
          ? `Error: ${String((err as { message: unknown }).message)}`
          : "Error running backfill.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 rounded-2xl border border-[var(--color-ochre-300)] bg-[var(--color-ochre-50)] p-4">
      <p className="text-sm font-medium text-[var(--color-ink)]">
        Maintenance · backfill employer hire counts
      </p>
      <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
        Sets each employer&apos;s &ldquo;workers hired&rdquo; total from past confirmed jobs (the
        live counter only counts forward). Safe to run again — idempotent.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <Button size="sm" variant="secondary" onClick={run} loading={busy} loadingText="Backfilling…">
          Run backfill
        </Button>
        {result && <span className="text-xs text-[var(--color-ink-soft)]">{result}</span>}
      </div>
    </div>
  );
}
