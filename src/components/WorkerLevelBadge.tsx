"use client";

import { nextLevel, workerLevel, type UserProfile } from "@/lib/types";

/**
 * Displays a worker's level (Newcomer → Platinum) and a small progress ring
 * to the next tier.
 */
export default function WorkerLevelBadge({
  profile,
  compact = false,
}: {
  profile: UserProfile;
  compact?: boolean;
}) {
  if (profile.role !== "worker") return null;

  const done = profile.jobsCompleted ?? 0;
  const lvl = workerLevel(done);
  const next = nextLevel(done);
  const toGo = next ? Math.max(0, next.min - done) : 0;

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 text-xs">
        <span aria-hidden>{lvl.icon}</span>
        <span className="font-medium text-[var(--color-ink)]">{lvl.short}</span>
      </span>
    );
  }

  return (
    <div className="inline-flex items-center gap-3 px-3 py-2 rounded-xl bg-[var(--color-cream-2)] border border-[var(--color-line)]">
      <span aria-hidden className="text-2xl">{lvl.icon}</span>
      <div className="text-left">
        <p className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)] leading-none">
          Worker level
        </p>
        <p className="mt-0.5 font-display text-base text-[var(--color-ink)] leading-tight">
          {lvl.label}
        </p>
        {next ? (
          <p className="mt-0.5 text-[10px] text-[var(--color-ink-muted)] leading-tight">
            {toGo} more {toGo === 1 ? "job" : "jobs"} to {next.short}
          </p>
        ) : (
          <p className="mt-0.5 text-[10px] text-[var(--color-sage-700)] leading-tight">
            Top tier · legend
          </p>
        )}
      </div>
    </div>
  );
}
