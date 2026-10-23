"use client";

/**
 * Payment handshake — the money changes hands in cash/EFT off-platform, so
 * once the work is confirmed each side taps their half: employer "I've paid",
 * worker "payment received" (either order). Both taps go through the
 * confirmPayment callable, which stamps the job/slot and bumps both sides'
 * payment tallies when the handshake completes. Used for single jobs (job-level
 * stamps) and per-worker inside the crew roster (pass `worker`).
 */

import Button from "@/components/Button";
import { confirmPayment } from "@/lib/jobs";
import type { AssignedWorker, Job } from "@/lib/types";

export default function PaymentHandshakeCard({
  job,
  asEmployer,
  worker,
  setBusy,
  setError,
  busy,
}: {
  job: Job;
  asEmployer: boolean;
  /** Crew slot — omit on single-worker jobs. */
  worker?: AssignedWorker;
  setBusy: (b: boolean) => void;
  setError: (s: string | null) => void;
  busy: boolean;
}) {
  const paidAt = worker ? worker.paidAt : job.paymentPaidAt;
  const receivedAt = worker ? worker.receivedAt : job.paymentReceivedAt;
  const confirmedAt = worker ? worker.paymentConfirmedAt : job.paymentConfirmedAt;
  const price = worker ? worker.agreedPrice : job.agreedPrice;
  const workerFirstName = (worker?.name ?? job.assignedWorkerName ?? "the worker").split(" ")[0];
  const mineDone = asEmployer ? !!paidAt : !!receivedAt;

  const tap = async () => {
    setError(null);
    setBusy(true);
    try {
      await confirmPayment(job.id, asEmployer ? worker?.uid : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm the payment.");
    } finally {
      setBusy(false);
    }
  };

  if (confirmedAt) {
    return (
      <div className="mt-4 rounded-xl p-4 bg-[var(--color-sage-100)]/40 border border-[var(--color-sage-400)]/60 text-sm text-[var(--color-sage-700)]">
        💵 <b>Payment confirmed</b> — R {price} · both sides confirmed on{" "}
        {new Date(confirmedAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}.
      </div>
    );
  }

  if (mineDone) {
    return (
      <div className="mt-4 rounded-xl p-4 bg-[var(--color-cream-2)] border border-[var(--color-line)] text-sm text-[var(--color-ink-soft)]">
        {asEmployer
          ? `✓ You marked R ${price} as paid — waiting for ${workerFirstName} to confirm they received it.`
          : "✓ You confirmed the payment arrived — waiting for the employer to mark it paid on their side."}
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl p-4 bg-[var(--color-cream-2)] border border-[var(--color-line)] flex items-center justify-between gap-3 flex-wrap">
      <span className="text-sm text-[var(--color-ink-soft)] min-w-0 max-w-md">
        {asEmployer
          ? `Paid ${workerFirstName} in ${job.paymentMethod === "eft" ? "EFT" : "cash"}? Confirming builds both your track records.`
          : "Got your money? Confirming builds your payment history — it powers your Work Record."}
      </span>
      <Button size="sm" variant="primary" onClick={tap} loading={busy} loadingText="Saving…">
        {asEmployer ? `💵 I've paid — R ${price}` : "💵 I've been paid"}
      </Button>
    </div>
  );
}
