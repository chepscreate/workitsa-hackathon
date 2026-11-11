"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Badge from "./Badge";
import { onChange, readList, clearViewed } from "@/lib/recently-viewed";
import { getJob } from "@/lib/jobs";
import { CATEGORIES, type Job } from "@/lib/types";

function categoryLabel(id: string) {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

/**
 * Horizontal scroll strip of jobs the user opened recently (localStorage).
 * Hidden when there's nothing to show. Free re-engagement loop with no
 * Firestore cost on the read side.
 */
export default function RecentlyViewedStrip() {
  const [ids, setIds] = useState<string[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    setIds(readList());
    return onChange(setIds);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (ids.length === 0) {
      setJobs([]);
      return;
    }
    (async () => {
      const results = await Promise.all(
        ids.map((id) =>
          getJob(id)
            .then((j) => j ?? null)
            .catch(() => null),
        ),
      );
      if (cancelled) return;
      // Preserve order from localStorage, drop missing/deleted jobs
      setJobs(results.filter((j): j is Job => !!j));
    })();
    return () => {
      cancelled = true;
    };
  }, [ids]);

  if (jobs.length === 0) return null;

  return (
    <section className="mt-6">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold">
          Recently viewed
        </h2>
        <button
          type="button"
          onClick={clearViewed}
          className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink-soft)] hover:underline"
        >
          Clear
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-3 px-3 snap-x">
        {jobs.map((job) => (
          <Link
            key={job.id}
            href={`/jobs?id=${job.id}`}
            className="snap-start flex-shrink-0 w-56 rounded-xl bg-[var(--color-paper)] border border-[var(--color-line)] p-4 hover:shadow-soft hover:-translate-y-0.5 transition-all"
          >
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <Badge tone={job.status === "open" ? "ochre" : "stone"}>
                {categoryLabel(job.category)}
              </Badge>
              {job.status !== "open" && (
                <span className="text-[10px] uppercase tracking-widest text-[var(--color-ink-muted)]">
                  {job.status}
                </span>
              )}
            </div>
            <p className="font-display text-base leading-tight line-clamp-2">
              {job.title}
            </p>
            <p className="mt-2 text-[11px] text-[var(--color-ink-muted)] truncate">
              {job.suburb}, {job.city}
            </p>
            <p className="mt-1 font-display text-lg text-[var(--color-ochre-600)]">
              R {job.suggestedPrice}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
