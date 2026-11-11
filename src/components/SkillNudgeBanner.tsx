"use client";

import { useState } from "react";
import Button from "@/components/Button";
import type { UserProfile } from "@/lib/types";

/**
 * One-time nudge for workers with no specific skills picked. Employers can
 * search the directory by skill (Hair, Plumbing, Bakkie hire…) since
 * 2026-07-06, but every pre-existing worker has an empty `skills` list — and
 * an empty list means they never show up in a skill-filtered search. Goes
 * away on its own once they've picked skills; "Not now" hides it for good
 * (localStorage, per device).
 */
const SKILL_NUDGE_DISMISSED_KEY = "workit.skillNudge.dismissed";

export default function SkillNudgeBanner({ profile }: { profile: UserProfile }) {
  const [dismissed, setDismissed] = useState(
    () =>
      typeof window !== "undefined"
      && localStorage.getItem(SKILL_NUDGE_DISMISSED_KEY) === "1",
  );

  if (dismissed || (profile.skills?.length ?? 0) > 0) return null;

  const onDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(SKILL_NUDGE_DISMISSED_KEY, "1");
    } catch {
      /* storage unavailable — hide for this session only */
    }
  };

  return (
    <div className="rounded-2xl p-5 mb-6 bg-[var(--color-ochre-50)] border border-[var(--color-ochre-300)] flex items-center justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <p className="font-medium text-[var(--color-ink)]">
          New: employers can now search workers by specific skill
        </p>
        <p className="text-sm text-[var(--color-ink-soft)]">
          Your profile doesn&apos;t list any yet — pick yours (like Hair,
          Plumbing or Bakkie hire) so you show up when they search.
        </p>
      </div>
      <div className="flex gap-2">
        <Button href="/profile" size="sm" variant="primary">
          Add my skills
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Not now
        </Button>
      </div>
    </div>
  );
}
