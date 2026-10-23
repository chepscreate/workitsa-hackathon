"use client";

import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { getFunctionsInstance } from "@/lib/firebase";
import Button from "@/components/Button";

/**
 * One-time maintenance: move existing users' sensitive verification payload
 * into the private subcollection. Safe to run more than once (idempotent).
 */
export default function DataMigrationButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      const fn = httpsCallable<unknown, { ok: boolean; scanned: number; moved: number }>(
        getFunctionsInstance(),
        "migrateVerificationToPrivate",
      );
      const res = await fn({});
      setResult(`Done — scanned ${res.data.scanned} users, moved ${res.data.moved} to private storage.`);
    } catch (err: unknown) {
      setResult(
        err && typeof err === "object" && "message" in err
          ? `Error: ${String((err as { message: unknown }).message)}`
          : "Error running migration.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 rounded-2xl border border-[var(--color-ochre-300)] bg-[var(--color-ochre-50)] p-4">
      <p className="text-sm font-medium text-[var(--color-ink)]">
        Maintenance · move sensitive verification data to private storage
      </p>
      <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
        One-time security migration. Safe to run again — it only moves anything left over.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <Button size="sm" variant="secondary" onClick={run} loading={busy} loadingText="Migrating…">
          Run migration
        </Button>
        {result && <span className="text-xs text-[var(--color-ink-soft)]">{result}</span>}
      </div>
    </div>
  );
}
