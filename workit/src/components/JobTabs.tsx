"use client";

import { useState } from "react";
import JobCard from "@/components/JobCard";
import EmptyState from "@/components/EmptyState";
import type { Job } from "@/lib/types";

export type TabConfig = {
  id: string;
  label: string;
  jobs: Job[];
  empty: string;
  emptyKind?: "no-jobs" | "no-saved" | "no-results" | "approved" | "no-messages";
  emptyAction?: React.ReactNode;
};

/**
 * Tabbed list of a user's jobs (postings or work). Shared by the account hub
 * and the dedicated /my-jobs page. Defaults to the first tab that has jobs.
 */
export default function JobTabs({ tabs }: { tabs: TabConfig[] }) {
  const initial = tabs.find((t) => t.jobs.length > 0)?.id ?? tabs[0].id;
  const [active, setActive] = useState(initial);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div>
      <div className="flex gap-2 border-b border-[var(--color-line)] mb-5 overflow-x-auto">
        {tabs.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              className={`relative px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? "text-[var(--color-ink)]"
                  : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink-soft)]"
              }`}
            >
              {t.label}
              <span className="ml-1.5 text-xs text-[var(--color-ink-muted)]">
                ({t.jobs.length})
              </span>
              {isActive && (
                <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-[var(--color-ochre-500)]" />
              )}
            </button>
          );
        })}
      </div>

      <div key={current.id} className="animate-slide-up">
        {current.jobs.length === 0 ? (
          current.emptyKind ? (
            <EmptyState
              kind={current.emptyKind}
              title={current.empty || "Nothing here yet"}
              action={current.emptyAction}
            />
          ) : current.empty ? (
            <p className="text-sm text-[var(--color-ink-muted)] italic py-6">
              {current.empty}
            </p>
          ) : null
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {current.jobs.map((j) => <JobCard key={j.id} job={j} />)}
          </div>
        )}
      </div>
    </div>
  );
}
