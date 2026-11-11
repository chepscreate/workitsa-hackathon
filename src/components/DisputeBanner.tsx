"use client";

import type { Dispute, DisputeReason } from "@/lib/types";

const REASON_LABELS: Record<DisputeReason, string> = {
  no_show: "Worker / employer didn't show up",
  quality: "Work quality issue",
  unsafe: "Unsafe situation",
  payment: "Payment disagreement",
  scope_changed: "Scope of work changed",
  other: "Other",
};

export default function DisputeBanner({ dispute }: { dispute: Dispute }) {
  return (
    <section className="mt-6 rounded-2xl p-6 bg-[var(--color-brick-soft)] border border-[var(--color-brick)]">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--color-brick-solid)] text-white flex items-center justify-center font-display"
        >
          !
        </span>
        <div className="flex-1">
          <p className="font-display text-lg text-[var(--color-brick)]">
            Dispute under review
          </p>
          <p className="mt-1 text-sm text-[var(--color-ink)]">
            <b>{dispute.raisedByName}</b> ({dispute.raisedByRole}) raised:{" "}
            <span className="italic">{REASON_LABELS[dispute.reason]}</span>
          </p>
          <p className="mt-2 text-sm text-[var(--color-ink-soft)] whitespace-pre-wrap">
            &ldquo;{dispute.description}&rdquo;
          </p>
          <p className="mt-3 text-xs text-[var(--color-ink-muted)]">
            Raised {new Date(dispute.raisedAt).toLocaleString()} · the job is
            frozen until a Workit admin resolves it. Please don&apos;t accept
            payment or take further action.
          </p>
        </div>
      </div>
    </section>
  );
}
