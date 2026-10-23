"use client";

/**
 * Admin analytics — funnels, completion/dispute rates, week-over-week trends,
 * and suburb leaderboards. Computes everything from the users + jobs arrays the
 * admin already loads (no extra reads).
 *
 * Caveat on funnels: a job only stores its CURRENT status, not its full history.
 * We infer "reached stage X" from the current status (a confirmed job was once
 * assigned and open, etc.) + maintained counters like offerCount. It's an
 * accurate floor, not a replayed event log.
 */

import { useMemo } from "react";
import type { Job, JobStatus, UserProfile } from "@/lib/types";

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

const ASSIGNED_OR_LATER: JobStatus[] = [
  "assigned",
  "in_progress",
  "completed",
  "confirmed",
  "disputed",
];

export default function AnalyticsDashboard({
  users,
  jobs,
}: {
  users: UserProfile[];
  jobs: Job[];
}) {
  const now = Date.now();

  const a = useMemo(() => compute(users, jobs, now), [users, jobs, now]);

  return (
    <div className="space-y-6">
      {/* WEEK-OVER-WEEK */}
      <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] overflow-hidden">
        <header className="px-5 py-3 border-b border-[var(--color-line)] flex items-center justify-between">
          <h2 className="font-display text-lg">Week over week</h2>
          <span className="text-[10px] uppercase tracking-widest text-[var(--color-ink-muted)]">
            Last 7 days vs the 7 before
          </span>
        </header>
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-[var(--color-line)]">
          <Wow label="Signups" current={a.wow.signups.cur} prev={a.wow.signups.prev} />
          <Wow label="Jobs posted" current={a.wow.posted.cur} prev={a.wow.posted.prev} />
          <Wow label="Jobs completed" current={a.wow.completed.cur} prev={a.wow.completed.prev} />
          <Wow label="GMV" current={a.wow.gmv.cur} prev={a.wow.gmv.prev} money />
        </div>
      </section>

      {/* RATES */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <RateTile label="Fill rate" pct={a.rates.fill} sub="posted → assigned" tone="ochre" />
        <RateTile label="Completion rate" pct={a.rates.completion} sub="assigned → confirmed" tone="sage" />
        <RateTile label="Dispute rate" pct={a.rates.dispute} sub="of assigned jobs" tone="brick" invert />
        <RateTile label="Cancellation rate" pct={a.rates.cancel} sub="of all posts" tone="brick" invert />
      </section>

      {/* FUNNELS */}
      <section className="grid lg:grid-cols-2 gap-6">
        <Funnel
          title="Job funnel"
          subtitle="Every posted job's journey"
          stages={a.jobFunnel}
        />
        <Funnel
          title="Worker funnel"
          subtitle="From sign-up to first paid job"
          stages={a.workerFunnel}
        />
      </section>

      {/* SUBURB LEADERBOARD */}
      <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] overflow-hidden">
        <header className="px-5 py-3 border-b border-[var(--color-line)] flex items-center justify-between">
          <h2 className="font-display text-lg">Suburb leaderboard</h2>
          <span className="text-[10px] uppercase tracking-widest text-[var(--color-ink-muted)]">
            Top {a.suburbs.length} by jobs posted
          </span>
        </header>
        {a.suburbs.length === 0 ? (
          <p className="p-8 text-center text-sm text-[var(--color-ink-muted)]">
            No jobs with a suburb yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-[var(--color-ink-muted)] border-b border-[var(--color-line)]">
                  <th className="px-5 py-2 font-semibold">Suburb</th>
                  <th className="px-3 py-2 font-semibold text-right">Posted</th>
                  <th className="px-3 py-2 font-semibold text-right">Completed</th>
                  <th className="px-3 py-2 font-semibold text-right">Compl. %</th>
                  <th className="px-3 py-2 font-semibold text-right">GMV</th>
                  <th className="px-5 py-2 font-semibold text-right">Workers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {a.suburbs.map((s, i) => (
                  <tr key={s.name} className="hover:bg-[var(--color-cream-2)]/40 transition-colors">
                    <td className="px-5 py-2.5">
                      <span className="text-[var(--color-ink-muted)] mr-2 tabular-nums">{i + 1}</span>
                      <span className="font-medium text-[var(--color-ink)]">{s.name}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{s.posted}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{s.completed}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[var(--color-ink-soft)]">
                      {s.posted ? Math.round((s.completed / s.posted) * 100) : 0}%
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">R {s.gmv.toLocaleString("en-ZA")}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-[var(--color-ink-soft)]">{s.workers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-[var(--color-ink-muted)]">
        Funnels are inferred from each job&apos;s current status (jobs don&apos;t store full
        history), so stage counts are an accurate floor. GMV counts confirmed jobs only.
      </p>
    </div>
  );
}

// ---------- computation ----------

type Stage = { label: string; count: number };

function compute(users: UserProfile[], jobs: Job[], now: number) {
  const curStart = now - WEEK;
  const prevStart = now - 2 * WEEK;

  const inCur = (t?: number) => !!t && t >= curStart && t < now;
  const inPrev = (t?: number) => !!t && t >= prevStart && t < curStart;
  const completedAt = (j: Job) => j.completedAt ?? j.updatedAt ?? 0;
  const isConfirmed = (j: Job) => j.status === "confirmed";

  // Week over week
  const signups = { cur: 0, prev: 0 };
  for (const u of users) {
    if (inCur(u.createdAt)) signups.cur++;
    else if (inPrev(u.createdAt)) signups.prev++;
  }
  const posted = { cur: 0, prev: 0 };
  const completed = { cur: 0, prev: 0 };
  const gmv = { cur: 0, prev: 0 };
  for (const j of jobs) {
    if (inCur(j.createdAt)) posted.cur++;
    else if (inPrev(j.createdAt)) posted.prev++;
    if (isConfirmed(j)) {
      const c = completedAt(j);
      const v = j.agreedPrice ?? j.suggestedPrice ?? 0;
      if (inCur(c)) {
        completed.cur++;
        gmv.cur += v;
      } else if (inPrev(c)) {
        completed.prev++;
        gmv.prev += v;
      }
    }
  }

  // Funnel + rates (all-time)
  const total = jobs.length;
  const withOffer = jobs.filter((j) => (j.offerCount ?? 0) > 0).length;
  const everAssigned = jobs.filter(
    (j) => ASSIGNED_OR_LATER.includes(j.status) || !!j.assignedWorkerId,
  ).length;
  const confirmed = jobs.filter(isConfirmed).length;
  const cancelled = jobs.filter((j) => j.status === "cancelled").length;
  const disputedEver = jobs.filter(
    (j) => j.status === "disputed" || !!j.dispute?.raisedAt,
  ).length;

  const jobFunnel: Stage[] = [
    { label: "Posted", count: total },
    { label: "Got an offer", count: withOffer },
    { label: "Assigned", count: everAssigned },
    { label: "Confirmed", count: confirmed },
  ];

  // Worker funnel
  const workers = users.filter((u) => u.role === "worker");
  const submitted = workers.filter((u) => !!u.verification?.submittedAt).length;
  const verified = workers.filter(
    (u) => (u.verificationStatus ?? "none") === "approved",
  ).length;
  const activeWorkers = workers.filter((u) => (u.jobsCompleted ?? 0) > 0).length;
  const workerFunnel: Stage[] = [
    { label: "Signed up", count: workers.length },
    { label: "Submitted docs", count: submitted },
    { label: "Verified", count: verified },
    { label: "Did a job", count: activeWorkers },
  ];

  const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);
  const rates = {
    fill: pct(everAssigned, total),
    completion: pct(confirmed, everAssigned),
    dispute: pct(disputedEver, everAssigned),
    cancel: pct(cancelled, total),
  };

  // Suburb leaderboard
  const map = new Map<string, { name: string; posted: number; completed: number; gmv: number }>();
  for (const j of jobs) {
    const name = (j.suburb || "Unknown").trim() || "Unknown";
    const e = map.get(name) ?? { name, posted: 0, completed: 0, gmv: 0 };
    e.posted++;
    if (isConfirmed(j)) {
      e.completed++;
      e.gmv += j.agreedPrice ?? j.suggestedPrice ?? 0;
    }
    map.set(name, e);
  }
  // workers per suburb
  const workersBySuburb = new Map<string, number>();
  for (const u of workers) {
    const name = (u.suburb || "").trim();
    if (!name) continue;
    workersBySuburb.set(name, (workersBySuburb.get(name) ?? 0) + 1);
  }
  const suburbs = Array.from(map.values())
    .sort((x, y) => y.posted - x.posted)
    .slice(0, 10)
    .map((s) => ({ ...s, workers: workersBySuburb.get(s.name) ?? 0 }));

  return {
    wow: { signups, posted, completed, gmv },
    rates,
    jobFunnel,
    workerFunnel,
    suburbs,
  };
}

// ---------- presentational ----------

function Wow({
  label,
  current,
  prev,
  money = false,
}: {
  label: string;
  current: number;
  prev: number;
  money?: boolean;
}) {
  const delta = prev === 0 ? (current > 0 ? null : 0) : Math.round(((current - prev) / prev) * 100);
  const up = current >= prev;
  const fmt = (n: number) => (money ? `R ${n.toLocaleString("en-ZA")}` : n.toLocaleString("en-ZA"));
  return (
    <div className="p-5">
      <p className="text-[10px] uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl text-[var(--color-ink)] tabular-nums">{fmt(current)}</p>
      <p className="mt-0.5 text-[11px] flex items-center gap-1">
        {delta === null ? (
          <span className="text-[var(--color-sage-700)] font-medium">↑ new</span>
        ) : delta === 0 && current === prev ? (
          <span className="text-[var(--color-ink-muted)]">no change</span>
        ) : (
          <span
            className={`font-medium ${up ? "text-[var(--color-sage-700)]" : "text-[var(--color-brick)]"}`}
          >
            {up ? "↑" : "↓"} {Math.abs(delta)}%
          </span>
        )}
        <span className="text-[var(--color-ink-muted)]">vs {fmt(prev)}</span>
      </p>
    </div>
  );
}

function RateTile({
  label,
  pct,
  sub,
  tone,
  invert = false,
}: {
  label: string;
  pct: number;
  sub: string;
  tone: "ochre" | "sage" | "brick";
  invert?: boolean;
}) {
  // For "good when low" metrics (dispute, cancel), colour high values red.
  const accent =
    tone === "brick"
      ? "border-l-[var(--color-brick)]"
      : tone === "sage"
        ? "border-l-[var(--color-sage-600)]"
        : "border-l-[var(--color-ochre-500)]";
  const valueColor = invert
    ? pct >= 15
      ? "text-[var(--color-brick)]"
      : "text-[var(--color-ink)]"
    : "text-[var(--color-ink)]";
  return (
    <div className={`rounded-2xl border border-[var(--color-line)] border-l-[6px] ${accent} bg-[var(--color-paper)] p-4`}>
      <p className="text-[10px] uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold">
        {label}
      </p>
      <p className={`mt-1 font-display text-3xl tabular-nums ${valueColor}`}>{pct}%</p>
      <p className="mt-0.5 text-[11px] text-[var(--color-ink-muted)]">{sub}</p>
    </div>
  );
}

function Funnel({
  title,
  subtitle,
  stages,
}: {
  title: string;
  subtitle: string;
  stages: Stage[];
}) {
  const top = Math.max(1, stages[0]?.count ?? 1);
  return (
    <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] overflow-hidden">
      <header className="px-5 py-3 border-b border-[var(--color-line)]">
        <h2 className="font-display text-lg">{title}</h2>
        <p className="text-[11px] text-[var(--color-ink-muted)]">{subtitle}</p>
      </header>
      <div className="p-5 space-y-3">
        {stages.map((s, i) => {
          const widthPct = Math.round((s.count / top) * 100);
          const fromPrev =
            i === 0 ? null : stages[i - 1].count > 0 ? Math.round((s.count / stages[i - 1].count) * 100) : 0;
          return (
            <div key={s.label}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-[var(--color-ink)]">{s.label}</span>
                <span className="tabular-nums text-[var(--color-ink-soft)]">
                  {s.count.toLocaleString("en-ZA")}
                  {fromPrev !== null && (
                    <span className="text-[var(--color-ink-muted)]"> · {fromPrev}%</span>
                  )}
                </span>
              </div>
              <div className="h-3 rounded-pill bg-[var(--color-cream-2)] overflow-hidden">
                <div
                  className="h-full rounded-pill bg-[var(--color-ochre-500)]"
                  style={{ width: `${Math.max(2, widthPct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
