"use client";

import { useEffect, useMemo, useState } from "react";
import AnimatedNumber from "@/components/AnimatedNumber";
import Badge from "@/components/Badge";
import { isEmployerSide, type Job, type UserProfile } from "@/lib/types";
import type { AdminSection } from "./AdminShell";

/**
 * Growth dashboard — the founder's steering panel toward the 20,000-user target.
 *
 * Three levers the marketplace lives or dies on:
 *  1. Worker : employer ratio  — is supply balanced against demand? (target 70/30)
 *  2. Fill-rate                — of jobs posted, how many actually get a worker?
 *  3. Time-to-fill             — how long from "posted" to "first hire"?
 *
 * Plus progress bars against the launch target (20k total = 14k workers + 6k
 * employers) and a short rule-based "what to do next" list.
 *
 * All numbers are derived live from the streamed `users` + `jobs` (same source
 * as Overview/Analytics) — no extra reads.
 */

// Launch target (Gauteng, ~6 months). Mirrors growth/workit-growth-20k.html.
const TARGET_TOTAL = 20_000;
const TARGET_WORKERS = 14_000; // 70%
const TARGET_EMPLOYERS = 6_000; // 30%
// Healthy supply:demand mix — workers should be ~70% of the two-sided base.
const TARGET_WORKER_SHARE = 0.7;

export default function GrowthDashboard({
  users,
  jobs,
  onJumpTo,
}: {
  users: UserProfile[];
  jobs: Job[];
  onJumpTo?: (section: AdminSection) => void;
}) {
  // Ticking clock so age-based metrics (stale jobs, "had a fair chance") stay fresh.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const m = useMemo(() => computeGrowth(users, jobs, now), [users, jobs, now]);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-[var(--color-ink)]">Growth</h1>
          <p className="text-sm text-[var(--color-ink-muted)]">
            Steering toward {TARGET_TOTAL.toLocaleString("en-ZA")}{" "}users — ratio, fill-rate &amp; time-to-fill.
          </p>
        </div>
        <span className="hidden sm:flex items-center gap-2 text-xs uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold">
          <span className="relative flex w-2.5 h-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-sage-600)] opacity-60" />
            <span className="relative inline-flex rounded-full w-2.5 h-2.5 bg-[var(--color-sage-600)]" />
          </span>
          Live
        </span>
      </div>

      {/* KPI ROW */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi
          label="Total users"
          value={m.totalUsers}
          sub={`${pct(m.totalUsers, TARGET_TOTAL)}% of ${TARGET_TOTAL.toLocaleString("en-ZA")} target`}
          tone="ink"
        />
        <Kpi
          label="Worker : employer"
          value={m.employers > 0 ? `${m.ratio.toFixed(1)} : 1` : m.workers > 0 ? "—" : "0 : 0"}
          sub={`${m.workers.toLocaleString("en-ZA")} workers · ${m.employers.toLocaleString("en-ZA")} employers`}
          tone={m.ratioTone}
        />
        <Kpi
          label="Fill-rate"
          value={m.fillRate === null ? "—" : `${m.fillRate}%`}
          sub={
            m.maturePosted > 0
              ? `${m.matureFilled}/${m.maturePosted} jobs (48h+ old) hired`
              : "Not enough jobs yet"
          }
          tone={m.fillRate === null ? "ink" : m.fillRate >= 70 ? "sage" : m.fillRate >= 45 ? "ochre" : "brick"}
        />
        <Kpi
          label="Time to fill"
          value={m.medianFillMs === null ? "—" : fmtDuration(m.medianFillMs)}
          sub={
            m.fillSamples > 0
              ? `median · ${m.fillSamples} ${m.fillSamples === 1 ? "hire" : "hires"} measured`
              : "No hires measured yet"
          }
          tone="sage"
        />
      </section>

      {/* PROGRESS TO 20K */}
      <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] overflow-hidden">
        <header className="px-5 py-3 border-b border-[var(--color-line)] flex items-center justify-between">
          <h2 className="font-display text-lg">Progress to {TARGET_TOTAL.toLocaleString("en-ZA")}</h2>
          <span className="text-[10px] uppercase tracking-widest text-[var(--color-ink-muted)]">
            Gauteng launch · ~6-month target
          </span>
        </header>
        <div className="p-5 space-y-4">
          <ProgressBar label="Total users" value={m.totalUsers} target={TARGET_TOTAL} color="var(--color-ink)" />
          <ProgressBar label="Workers (supply)" value={m.workers} target={TARGET_WORKERS} color="var(--color-ochre-500)" />
          <ProgressBar label="Employers (demand)" value={m.employers} target={TARGET_EMPLOYERS} color="var(--color-sage-600)" />
        </div>
      </section>

      {/* BALANCE + FILL FUNNEL */}
      <section className="grid lg:grid-cols-2 gap-6">
        {/* Supply / demand balance */}
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] overflow-hidden">
          <header className="px-5 py-3 border-b border-[var(--color-line)] flex items-center justify-between">
            <h2 className="font-display text-lg">Supply &amp; demand balance</h2>
            <span className="text-[10px] uppercase tracking-widest text-[var(--color-ink-muted)]">
              Target 70 / 30
            </span>
          </header>
          <div className="p-5">
            {m.workers + m.employers === 0 ? (
              <p className="text-center text-sm text-[var(--color-ink-muted)] py-6">
                No marketplace users yet.
              </p>
            ) : (
              <>
                {/* Stacked balance bar with a 70% target marker */}
                <div className="relative h-7 rounded-full overflow-hidden bg-[var(--color-cream-2)] flex">
                  <div
                    className="h-full flex items-center justify-center text-[10px] font-semibold text-white transition-all duration-700"
                    style={{ width: `${m.workerShare}%`, background: "var(--color-ochre-500)" }}
                  >
                    {m.workerShare >= 12 ? `${m.workerShare}%` : ""}
                  </div>
                  <div
                    className="h-full flex items-center justify-center text-[10px] font-semibold text-white transition-all duration-700"
                    style={{ width: `${100 - m.workerShare}%`, background: "var(--color-sage-600)" }}
                  >
                    {100 - m.workerShare >= 12 ? `${100 - m.workerShare}%` : ""}
                  </div>
                  {/* 70% target marker */}
                  <span
                    className="absolute top-0 bottom-0 w-0.5 bg-[var(--color-ink)]"
                    style={{ left: `${TARGET_WORKER_SHARE * 100}%` }}
                    title="Target: 70% workers"
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--color-ink-muted)]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--color-ochre-500)" }} />
                    Workers {m.workers.toLocaleString("en-ZA")}
                  </span>
                  <span className="flex items-center gap-1.5">
                    Employers {m.employers.toLocaleString("en-ZA")}
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--color-sage-600)" }} />
                  </span>
                </div>
                <p className="mt-4 text-sm text-[var(--color-ink)] leading-relaxed">
                  {m.balanceMessage}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Fill funnel */}
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] overflow-hidden">
          <header className="px-5 py-3 border-b border-[var(--color-line)] flex items-center justify-between">
            <h2 className="font-display text-lg">Fill funnel</h2>
            <span className="text-[10px] uppercase tracking-widest text-[var(--color-ink-muted)]">
              All jobs ever posted
            </span>
          </header>
          <div className="p-5 space-y-4">
            {m.totalPosted === 0 ? (
              <p className="text-center text-sm text-[var(--color-ink-muted)] py-6">
                No jobs posted yet.
              </p>
            ) : (
              <>
                {m.funnel.map((step, i) => {
                  const p = m.totalPosted > 0 ? Math.round((step.value / m.totalPosted) * 100) : 0;
                  return (
                    <div key={step.label}>
                      <div className="flex items-baseline justify-between">
                        <p className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold">
                          {step.label}
                        </p>
                        <p className="text-sm text-[var(--color-ink)] tabular-nums">
                          {step.value.toLocaleString("en-ZA")}
                          {i > 0 && <span className="text-[var(--color-ink-muted)] text-[11px] ml-1">({p}%)</span>}
                        </p>
                      </div>
                      <div className="mt-1 h-2.5 rounded-full bg-[var(--color-cream-2)] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${p}%`, background: step.color }}
                        />
                      </div>
                    </div>
                  );
                })}
                {(m.openUnfilled > 0 || m.staleUnfilled > 0) && (
                  <div className="pt-1 flex flex-wrap gap-2">
                    {m.openUnfilled > 0 && <Badge tone="ochre">{m.openUnfilled} open, no hire yet</Badge>}
                    {m.staleUnfilled > 0 && <Badge tone="brick">{m.staleUnfilled} stale (3d+ no hire)</Badge>}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* SIGN-UP FUNNEL — people, not jobs: signed up → submitted → approved */}
      <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] overflow-hidden">
        <header className="px-5 py-3 border-b border-[var(--color-line)] flex items-center justify-between">
          <h2 className="font-display text-lg">Sign-up funnel</h2>
          <span className="text-[10px] uppercase tracking-widest text-[var(--color-ink-muted)]">
            All accounts · one-step signup live 12 Jul
          </span>
        </header>
        <div className="p-5 space-y-4">
          {m.suSignedUp === 0 ? (
            <p className="text-center text-sm text-[var(--color-ink-muted)] py-6">
              No sign-ups yet.
            </p>
          ) : (
            <>
              {m.signupFunnel.map((step, i) => {
                const p = m.suSignedUp > 0 ? Math.round((step.value / m.suSignedUp) * 100) : 0;
                const prev = i > 0 ? m.signupFunnel[i - 1].value : 0;
                const conv = i > 0 && prev > 0 ? Math.round((step.value / prev) * 100) : null;
                return (
                  <div key={step.label}>
                    <div className="flex items-baseline justify-between">
                      <p className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold">
                        {step.label}
                      </p>
                      <p className="text-sm text-[var(--color-ink)] tabular-nums">
                        {step.value.toLocaleString("en-ZA")}
                        {conv !== null && (
                          <span className="text-[var(--color-ink-muted)] text-[11px] ml-1">
                            ({conv}% of previous step)
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="mt-1 h-2.5 rounded-full bg-[var(--color-cream-2)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${p}%`, background: step.color }}
                      />
                    </div>
                  </div>
                );
              })}
              {m.suNeverSubmitted > 0 && (
                <div className="pt-1 flex items-center gap-2 flex-wrap">
                  <Badge tone="brick">
                    {m.suNeverSubmitted} signed up but never submitted docs
                  </Badge>
                  {onJumpTo && (
                    <button
                      type="button"
                      onClick={() => onJumpTo("verification")}
                      className="text-xs underline text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                    >
                      chase them in missing docs →
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* TIME-TO-FILL DISTRIBUTION */}
      <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] overflow-hidden">
        <header className="px-5 py-3 border-b border-[var(--color-line)] flex items-center justify-between">
          <h2 className="font-display text-lg">Time to fill · post → first hire</h2>
          <span className="text-[10px] uppercase tracking-widest text-[var(--color-ink-muted)]">
            {m.fillSamples > 0 ? `${m.fillSamples} measured` : "awaiting data"}
          </span>
        </header>
        <div className="p-5">
          {m.fillSamples === 0 ? (
            <p className="text-center text-sm text-[var(--color-ink-muted)] py-6">
              No hires measured yet. This fills in as jobs get their first worker.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-6 mb-5">
                <Stat label="Median" value={fmtDuration(m.medianFillMs!)} />
                <Stat label="Average" value={fmtDuration(m.avgFillMs!)} />
                <Stat label="Fastest" value={fmtDuration(m.minFillMs!)} />
              </div>
              <div className="space-y-2.5">
                {m.fillBuckets.map((b) => {
                  const p = m.fillSamples > 0 ? Math.round((b.count / m.fillSamples) * 100) : 0;
                  return (
                    <div key={b.label} className="flex items-center gap-3">
                      <span className="w-20 text-[11px] text-[var(--color-ink-muted)] text-right flex-shrink-0">
                        {b.label}
                      </span>
                      <div className="flex-1 h-4 rounded-full bg-[var(--color-cream-2)] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${p}%`, background: "var(--color-ochre-500)" }}
                        />
                      </div>
                      <span className="w-16 text-[11px] text-[var(--color-ink)] tabular-nums flex-shrink-0">
                        {b.count} ({p}%)
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 text-[11px] text-[var(--color-ink-muted)]">
                Measured from job-post to first worker hired. Jobs filled before this metric shipped
                aren&apos;t counted, so the sample grows over time.
              </p>
            </>
          )}
        </div>
      </section>

      {/* WEEKLY FILL-RATE TREND */}
      <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] overflow-hidden">
        <header className="px-5 py-3 border-b border-[var(--color-line)] flex items-center justify-between">
          <h2 className="font-display text-lg">Weekly fill-rate</h2>
          <span className="text-[10px] uppercase tracking-widest text-[var(--color-ink-muted)]">
            Last 8 weeks
          </span>
        </header>
        <div className="p-5">
          {m.weekly.every((w) => w.posted === 0) ? (
            <p className="text-center text-sm text-[var(--color-ink-muted)] py-6">
              No jobs in the last 8 weeks.
            </p>
          ) : (
            <div className="flex items-end justify-between gap-2 h-40">
              {m.weekly.map((w) => {
                const rate = w.posted > 0 ? Math.round((w.filled / w.posted) * 100) : 0;
                return (
                  <div key={w.label} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <span className="text-[10px] text-[var(--color-ink)] tabular-nums">
                      {w.posted > 0 ? `${rate}%` : "—"}
                    </span>
                    <div
                      className="w-full max-w-[44px] rounded-t-md transition-all duration-700"
                      style={{
                        height: `${w.posted > 0 ? Math.max(4, rate) : 2}%`,
                        background: w.posted > 0 ? "var(--color-sage-600)" : "var(--color-cream-2)",
                      }}
                      title={`${w.filled}/${w.posted} jobs filled`}
                    />
                    <span className="text-[10px] text-[var(--color-ink-muted)]">{w.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* WHAT TO DO NEXT */}
      {m.actions.length > 0 && (
        <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] overflow-hidden">
          <header className="px-5 py-3 border-b border-[var(--color-line)] flex items-center justify-between">
            <h2 className="font-display text-lg">What to do next</h2>
            <span className="text-[10px] uppercase tracking-widest text-[var(--color-ink-muted)]">
              Auto-generated
            </span>
          </header>
          <ul className="divide-y divide-[var(--color-line)]">
            {m.actions.map((a, i) => (
              <li key={i} className="px-5 py-3 flex items-start gap-3">
                <span
                  className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    a.tone === "good"
                      ? "bg-[var(--color-sage-600)]"
                      : a.tone === "warn"
                        ? "bg-[var(--color-ochre-500)]"
                        : "bg-[var(--color-brick-solid)]"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--color-ink)]">{a.text}</p>
                  {a.jump && onJumpTo && (
                    <button
                      type="button"
                      onClick={() => onJumpTo(a.jump!.href)}
                      className="mt-0.5 text-[11px] text-[var(--color-ochre-600)] hover:text-[var(--color-ochre-700)]"
                    >
                      {a.jump.label} →
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Computation
// ---------------------------------------------------------------------------

type FunnelStep = { label: string; value: number; color: string };
type Action = { text: string; tone: "good" | "warn" | "bad"; jump?: { label: string; href: AdminSection } };

function computeGrowth(users: UserProfile[], jobs: Job[], now: number) {
  const DAY = 24 * 60 * 60 * 1000;

  // ---- Users: workers vs employers (admins excluded from the marketplace mix) ----
  const workers = users.filter((u) => u.role === "worker").length;
  const employers = users.filter((u) => u.role !== "admin" && isEmployerSide(u.role)).length;
  const totalUsers = users.filter((u) => u.role !== "admin").length;
  const ratio = employers > 0 ? workers / employers : 0;
  const base = workers + employers;
  const workerShare = base > 0 ? Math.round((workers / base) * 100) : 0;

  // Ratio health: ideal band is ~2–4 workers per employer (70/30 ≈ 2.3).
  const ratioTone: "sage" | "ochre" | "brick" =
    employers === 0
      ? "ochre"
      : ratio >= 2 && ratio <= 4
        ? "sage"
        : ratio < 1.2 || ratio > 6
          ? "brick"
          : "ochre";

  // Recommendation to hit the 70/30 mix.
  const targetEmployers = Math.round(workers * (1 - TARGET_WORKER_SHARE) / TARGET_WORKER_SHARE); // workers*3/7
  const targetWorkers = Math.round(employers * TARGET_WORKER_SHARE / (1 - TARGET_WORKER_SHARE)); // employers*7/3
  let balanceMessage: string;
  if (base === 0) {
    balanceMessage = "No marketplace users yet.";
  } else if (employers === 0) {
    balanceMessage = `${workers} workers and no employers. Demand is the whole gap — every push right now should recruit employers (people with jobs to post).`;
  } else if (workerShare > 75) {
    balanceMessage = `Supply-heavy: ${workerShare}% workers. Recruit roughly ${Math.max(0, targetEmployers - employers)} more employers to balance demand against your worker base.`;
  } else if (workerShare < 60) {
    balanceMessage = `Demand-heavy: only ${workerShare}% workers. Recruit roughly ${Math.max(0, targetWorkers - workers)} more workers so jobs get filled fast.`;
  } else {
    balanceMessage = `Healthy mix at ${workerShare}% workers / ${100 - workerShare}% employers — close to the 70/30 target. Keep both sides growing together.`;
  }

  // ---- Sign-up funnel (people, not jobs): where the acquisition pipe leaks ----
  const nonAdmin = users.filter((u) => u.role !== "admin");
  const suSignedUp = nonAdmin.length;
  const suSubmitted = nonAdmin.filter((u) => u.verification?.submittedAt).length;
  const suApproved = nonAdmin.filter((u) => u.accountStatus === "approved").length;
  const signupFunnel: FunnelStep[] = [
    { label: "Signed up", value: suSignedUp, color: "var(--color-ochre-500)" },
    { label: "Submitted docs", value: suSubmitted, color: "var(--color-sage-600)" },
    { label: "Approved", value: suApproved, color: "var(--color-sage-700)" },
  ];
  // The leak the one-step signup (2026-07-12) exists to fix: accounts stuck
  // pending with nothing submitted.
  const suNeverSubmitted = nonAdmin.filter(
    (u) => !u.verification?.submittedAt && (u.accountStatus ?? "approved") === "pending",
  ).length;

  // ---- Jobs: fill-rate + funnel ----
  const isFilled = (j: Job) =>
    !!j.assignedAt ||
    !!j.assignedWorkerId ||
    (j.assignedWorkerIds?.length ?? 0) > 0 ||
    ["assigned", "in_progress", "completed", "confirmed"].includes(j.status);
  const isDone = (j: Job) => j.status === "confirmed" || j.status === "completed";

  const totalPosted = jobs.length;
  const filledCount = jobs.filter(isFilled).length;
  const completedCount = jobs.filter(isDone).length;

  const funnel: FunnelStep[] = [
    { label: "Posted", value: totalPosted, color: "var(--color-ochre-500)" },
    { label: "Filled (hired)", value: filledCount, color: "var(--color-sage-600)" },
    { label: "Completed", value: completedCount, color: "var(--color-sage-700)" },
  ];

  // Steering fill-rate: jobs that have had a fair chance (48h+ old), excluding
  // jobs cancelled before any hire (employer changed their mind — not a match failure).
  const mature = jobs.filter(
    (j) => (j.createdAt ?? 0) <= now - 2 * DAY && !(j.status === "cancelled" && !isFilled(j)),
  );
  const maturePosted = mature.length;
  const matureFilled = mature.filter(isFilled).length;
  const fillRate = maturePosted > 0 ? Math.round((matureFilled / maturePosted) * 100) : null;

  const openUnfilled = jobs.filter((j) => j.status === "open" && !isFilled(j)).length;
  const staleUnfilled = jobs.filter(
    (j) => j.status === "open" && !isFilled(j) && (j.createdAt ?? now) < now - 3 * DAY,
  ).length;

  // ---- Time-to-fill (post → first hire) ----
  const durations = jobs
    .filter((j) => j.assignedAt && j.createdAt && j.assignedAt >= j.createdAt)
    .map((j) => j.assignedAt! - j.createdAt!);
  const fillSamples = durations.length;
  const sorted = [...durations].sort((a, b) => a - b);
  const medianFillMs = fillSamples > 0 ? median(sorted) : null;
  const avgFillMs = fillSamples > 0 ? Math.round(durations.reduce((s, d) => s + d, 0) / fillSamples) : null;
  const minFillMs = fillSamples > 0 ? sorted[0] : null;

  const HOUR = 60 * 60 * 1000;
  const fillBuckets = [
    { label: "< 1 h", count: durations.filter((d) => d < HOUR).length },
    { label: "1–6 h", count: durations.filter((d) => d >= HOUR && d < 6 * HOUR).length },
    { label: "6–24 h", count: durations.filter((d) => d >= 6 * HOUR && d < 24 * HOUR).length },
    { label: "1–3 days", count: durations.filter((d) => d >= DAY && d < 3 * DAY).length },
    { label: "3 days +", count: durations.filter((d) => d >= 3 * DAY).length },
  ];

  // ---- Weekly fill-rate trend (last 8 weeks, by post date) ----
  const WEEK = 7 * DAY;
  const weekly: Array<{ label: string; posted: number; filled: number }> = [];
  for (let w = 7; w >= 0; w--) {
    const end = now - w * WEEK;
    const start = end - WEEK;
    const inWeek = jobs.filter((j) => (j.createdAt ?? 0) >= start && (j.createdAt ?? 0) < end);
    weekly.push({
      label: w === 0 ? "now" : `-${w}w`,
      posted: inWeek.length,
      filled: inWeek.filter(isFilled).length,
    });
  }

  // ---- What to do next ----
  const actions: Action[] = [];
  if (base > 0 && employers === 0) {
    actions.push({ tone: "bad", text: "You have workers but zero employers — there's nothing for them to do. Recruiting employers is priority #1." , jump: { label: "See all users", href: "users" } });
  } else if (base > 0 && (workerShare > 78 || ratio > 6)) {
    actions.push({ tone: "warn", text: `Supply is running ahead of demand (${workerShare}% workers). Focus growth spend on employers until the ratio settles near 70/30.` });
  } else if (base > 0 && workerShare < 55) {
    actions.push({ tone: "warn", text: `Demand is ahead of supply (only ${workerShare}% workers). Recruit more verified workers so jobs fill quickly.`, jump: { label: "Verification queue", href: "verification" } });
  }
  if (fillRate !== null && fillRate < 50 && maturePosted >= 5) {
    actions.push({ tone: "bad", text: `Fill-rate is ${fillRate}% — over half of jobs that have had a fair chance never got a worker. Check matching, worker coverage and pricing.` });
  } else if (fillRate !== null && fillRate >= 75 && maturePosted >= 5) {
    actions.push({ tone: "good", text: `Fill-rate is healthy at ${fillRate}%. The marketplace is matching well — push more demand in.` });
  }
  if (staleUnfilled > 0) {
    actions.push({ tone: "warn", text: `${staleUnfilled} open ${staleUnfilled === 1 ? "job has" : "jobs have"} sat 3+ days with no hire. Consider nudging nearby workers or reviewing the price.` });
  }
  if (medianFillMs !== null && medianFillMs > 24 * HOUR && fillSamples >= 5) {
    actions.push({ tone: "warn", text: `Median time-to-fill is ${fmtDuration(medianFillMs)}. Faster fills keep employers coming back — aim for under a few hours.` });
  }
  if (totalUsers > 0) {
    const remaining = TARGET_TOTAL - totalUsers;
    if (remaining > 0) {
      actions.push({ tone: "good", text: `${pct(totalUsers, TARGET_TOTAL)}% of the way to ${TARGET_TOTAL.toLocaleString("en-ZA")} — ${remaining.toLocaleString("en-ZA")} users to go (target ${TARGET_WORKERS.toLocaleString("en-ZA")} workers + ${TARGET_EMPLOYERS.toLocaleString("en-ZA")} employers).` });
    } else {
      actions.push({ tone: "good", text: `Target of ${TARGET_TOTAL.toLocaleString("en-ZA")} users reached 🎉 — set the next milestone.` });
    }
  }

  return {
    totalUsers, workers, employers, ratio, ratioTone, base, workerShare, balanceMessage,
    totalPosted, filledCount, completedCount, funnel,
    suSignedUp, suSubmitted, suApproved, signupFunnel, suNeverSubmitted,
    maturePosted, matureFilled, fillRate, openUnfilled, staleUnfilled,
    fillSamples, medianFillMs, avgFillMs, minFillMs, fillBuckets,
    weekly, actions,
  };
}

function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

function pct(value: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((value / target) * 100));
}

function fmtDuration(ms: number): string {
  const m = Math.max(0, ms);
  const min = m / 60000;
  if (min < 1) return "< 1 min";
  if (min < 90) return `${Math.round(min)} min`;
  const h = min / 60;
  if (h < 36) return `${h < 10 ? h.toFixed(1) : Math.round(h)} h`;
  const d = h / 24;
  return `${d < 10 ? d.toFixed(1) : Math.round(d)} days`;
}

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number | string;
  sub?: string;
  tone: "ochre" | "sage" | "ink" | "brick";
}) {
  const accent: Record<string, string> = {
    ochre: "border-l-[var(--color-ochre-500)]",
    sage: "border-l-[var(--color-sage-600)]",
    ink: "border-l-[var(--color-ink)]",
    brick: "border-l-[var(--color-brick)]",
  };
  return (
    <div className={`rounded-2xl border border-[var(--color-line)] border-l-[6px] ${accent[tone]} bg-[var(--color-paper)] p-4`}>
      <p className="text-[10px] uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold">
        {label}
      </p>
      <p className="mt-1 font-display text-3xl text-[var(--color-ink)] tabular-nums">
        {typeof value === "number" ? <AnimatedNumber value={value} /> : value}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-[var(--color-ink-muted)]">{sub}</p>}
    </div>
  );
}

function ProgressBar({
  label,
  value,
  target,
  color,
}: {
  label: string;
  value: number;
  target: number;
  color: string;
}) {
  const p = pct(value, target);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold">{label}</p>
        <p className="text-sm text-[var(--color-ink)] tabular-nums">
          {value.toLocaleString("en-ZA")}
          <span className="text-[var(--color-ink-muted)] text-[11px] ml-1">
            / {target.toLocaleString("en-ZA")} ({p}%)
          </span>
        </p>
      </div>
      <div className="mt-1 h-3 rounded-full bg-[var(--color-cream-2)] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${p}%`, background: color }} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold">{label}</p>
      <p className="mt-0.5 font-display text-xl text-[var(--color-ink)]">{value}</p>
    </div>
  );
}
