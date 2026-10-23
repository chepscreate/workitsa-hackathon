"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import AnimatedNumber from "@/components/AnimatedNumber";
import { subscribeAllJobs } from "@/lib/jobs";
import type { Job } from "@/lib/types";

/**
 * Public-facing marketplace stats. Aggregated client-side from /jobs which
 * is publicly readable. Used as social proof on landing + a shareable URL
 * for press / partners. No login needed.
 */
export default function StatsPage() {
  const [jobs, setJobs] = useState<Job[] | null>(null);

  useEffect(() => {
    const unsub = subscribeAllJobs((j) => setJobs(j));
    return () => unsub();
  }, []);

  const ready = jobs !== null;
  const totalJobs = jobs?.length ?? 0;
  const confirmed = jobs?.filter((j) => j.status === "confirmed") ?? [];
  const completedCount = confirmed.length;
  const gmv = confirmed.reduce((s, j) => s + (j.agreedPrice ?? 0), 0);
  const inProgress =
    jobs?.filter((j) => ["assigned", "in_progress", "completed"].includes(j.status)).length ?? 0;
  const openNow = jobs?.filter((j) => j.status === "open").length ?? 0;
  const suburbs = new Set(jobs?.map((j) => j.suburb).filter(Boolean)).size;
  const employerIds = new Set(jobs?.map((j) => j.employerId).filter(Boolean));
  const workerIds = new Set(
    jobs?.map((j) => j.assignedWorkerId).filter((x): x is string => !!x),
  );

  // Top categories (by count)
  const categoryCounts: Record<string, number> = {};
  for (const j of jobs ?? []) {
    if (!j.category) continue;
    categoryCounts[j.category] = (categoryCounts[j.category] ?? 0) + 1;
  }
  const topCategories = Object.entries(categoryCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // Sum of all ratings → average
  let starsSum = 0;
  let starsCount = 0;
  for (const j of jobs ?? []) {
    if (j.workerRating?.stars) {
      starsSum += j.workerRating.stars;
      starsCount += 1;
    }
    if (j.employerRating?.stars) {
      starsSum += j.employerRating.stars;
      starsCount += 1;
    }
  }
  const avgRating = starsCount > 0 ? starsSum / starsCount : 0;

  return (
    <>
      <Header />
      <main className="flex-1">
        <Container className="py-14 max-w-5xl">
          <Badge tone="sage">Live numbers</Badge>
          <h1 className="mt-4 font-display text-4xl sm:text-5xl tracking-tight">
            Workit by the numbers.
          </h1>
          <p className="mt-3 text-[var(--color-ink-soft)] max-w-2xl">
            A live snapshot of what&apos;s happening across the marketplace —
            updated in real time from our database. Refresh to see it move.
          </p>

          {!ready ? (
            <div className="mt-10 h-40 rounded-2xl bg-[var(--color-cream-2)] animate-pulse" />
          ) : (
            <>
              {/* Hero numbers */}
              <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <HeroStat label="Jobs completed" value={completedCount} tone="sage" />
                <HeroStat label="GMV released" value={gmv} prefix="R " tone="ochre" />
                <HeroStat label="Open right now" value={openNow} tone="ink" />
                <HeroStat label="Suburbs covered" value={suburbs} tone="ochre" />
              </div>

              {/* Secondary row */}
              <div className="mt-4 grid sm:grid-cols-4 gap-4">
                <SecStat label="Total job posts" value={totalJobs} />
                <SecStat label="Jobs in progress" value={inProgress} />
                <SecStat label="Employers" value={employerIds.size} />
                <SecStat label="Workers hired" value={workerIds.size} />
              </div>

              {/* Average rating + top categories */}
              <div className="mt-10 grid lg:grid-cols-2 gap-6">
                <div className="rounded-2xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
                  <p className="text-[10px] uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold">
                    Average rating
                  </p>
                  <div className="mt-2 flex items-baseline gap-3">
                    <span className="font-display text-6xl text-[var(--color-ochre-600)]">
                      <AnimatedNumber
                        value={avgRating}
                        format={(n) => n.toFixed(1)}
                      />
                    </span>
                    <span className="text-sm text-[var(--color-ink-muted)]">
                      across {starsCount.toLocaleString("en-ZA")} ratings
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
                    Both sides rate every confirmed job. The number above is
                    every rating, both ways, ever.
                  </p>
                </div>

                <div className="rounded-2xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
                  <p className="text-[10px] uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold">
                    Top categories
                  </p>
                  {topCategories.length === 0 ? (
                    <p className="mt-3 text-sm text-[var(--color-ink-muted)] italic">
                      Posting in every category. Be the first.
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {topCategories.map(([cat, n]) => {
                        const max = topCategories[0][1];
                        const pct = Math.round((n / max) * 100);
                        return (
                          <li key={cat} className="text-sm">
                            <div className="flex items-baseline justify-between gap-3 mb-1">
                              <span className="text-[var(--color-ink)] capitalize">
                                {cat.replace(/-/g, " ")}
                              </span>
                              <span className="text-[var(--color-ink-muted)] tabular-nums">
                                {n}
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-[var(--color-cream-2)] overflow-hidden">
                              <div
                                className="h-full bg-[var(--color-ochre-500)]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>

              {/* CTA */}
              <div className="mt-12 rounded-2xl overflow-hidden bg-gradient-to-br from-[var(--color-ochre-500)] to-[var(--color-ochre-700)] text-[var(--color-cream)] p-8 sm:p-12 shadow-lift text-center">
                <h2 className="font-display text-3xl sm:text-4xl tracking-tight">
                  Be part of the next number.
                </h2>
                <p className="mt-3 text-[var(--color-cream)]/90 max-w-xl mx-auto">
                  Post a job or sign up as a worker. Every Workit transaction
                  shows up on this page within seconds.
                </p>
                <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                  <Button href="/post-a-job" size="lg" variant="secondary">
                    Post a job
                  </Button>
                  <Button
                    href="/signup?role=worker"
                    size="lg"
                    variant="ghost"
                    className="!text-[var(--color-cream)] hover:!bg-white/10"
                  >
                    I want to work
                  </Button>
                </div>
              </div>

              <p className="mt-6 text-xs text-[var(--color-ink-muted)] text-center">
                Numbers refresh in real time as jobs are posted, accepted and
                completed. Last seen{" "}
                <Link href="/stats" className="underline">
                  /stats
                </Link>
                .
              </p>
            </>
          )}
        </Container>
      </main>
      <Footer />
    </>
  );
}

function HeroStat({
  label,
  value,
  prefix,
  tone,
}: {
  label: string;
  value: number;
  prefix?: string;
  tone: "ochre" | "sage" | "ink";
}) {
  const ring: Record<typeof tone, string> = {
    ochre: "border-l-[var(--color-ochre-500)]",
    sage: "border-l-[var(--color-sage-600)]",
    ink: "border-l-[var(--color-ink)]",
  } as Record<typeof tone, string>;
  return (
    <div
      className={`rounded-2xl bg-[var(--color-paper)] border border-[var(--color-line)] border-l-[6px] ${ring[tone]} p-5`}
    >
      <p className="text-[10px] uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold">
        {label}
      </p>
      <p className="mt-1 font-display text-4xl sm:text-5xl text-[var(--color-ink)] tabular-nums">
        {prefix}
        <AnimatedNumber value={value} />
      </p>
    </div>
  );
}

function SecStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[var(--color-cream-2)] border border-[var(--color-line)] p-4">
      <p className="text-[10px] uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl text-[var(--color-ink)] tabular-nums">
        <AnimatedNumber value={value} />
      </p>
    </div>
  );
}
