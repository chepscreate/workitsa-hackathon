"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Badge from "@/components/Badge";
import Avatar from "@/components/Avatar";
import AnimatedNumber from "@/components/AnimatedNumber";
import { CATEGORIES, type Job, type UserProfile } from "@/lib/types";
import type { AdminSection } from "./AdminShell";

/**
 * Live smart dashboard — the admin landing tab.
 *
 * "Live": users + jobs stream from Firestore (parent page), and a 30s clock
 * keeps relative times / time-window KPIs fresh without a reload.
 *
 * "Smart": on top of the raw numbers it computes week-on-week deltas, a 30-day
 * job funnel, a "happening now" panel (in-flight jobs, live tracking,
 * available-now workers, emergencies) and a rule-based insights feed that
 * turns the data into plain-English observations with jump links.
 */
export default function OverviewDashboard({
  users,
  jobs,
  onJumpTo,
}: {
  users: UserProfile[];
  jobs: Job[];
  onJumpTo: (section: AdminSection) => void;
}) {
  // Ticking clock so "x min ago", the LIVE pulse and day-window KPIs stay
  // current while the tab sits open. 30s is plenty.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const DAY = 24 * 60 * 60 * 1000;
  const todayStart = startOfDay(now);
  const weekStart = todayStart - 6 * DAY;
  const prevWeekStart = weekStart - 7 * DAY;

  // ---------- KPIs + week-on-week deltas ----------
  const usersByDay = users.filter((u) => (u.createdAt ?? 0) >= todayStart).length;
  const usersByWeek = users.filter((u) => (u.createdAt ?? 0) >= weekStart).length;
  const usersPrevWeek = users.filter(
    (u) => (u.createdAt ?? 0) >= prevWeekStart && (u.createdAt ?? 0) < weekStart,
  ).length;

  const openJobs = jobs.filter((j) => j.status === "open").length;
  const activeJobs = jobs.filter((j) => ["assigned", "in_progress", "completed"].includes(j.status)).length;
  const postedThisWeek = jobs.filter((j) => (j.createdAt ?? 0) >= weekStart).length;
  const postedPrevWeek = jobs.filter(
    (j) => (j.createdAt ?? 0) >= prevWeekStart && (j.createdAt ?? 0) < weekStart,
  ).length;

  const confirmedAt = (j: Job) => j.completedAt ?? j.updatedAt ?? 0;
  const confirmedThisWeek = jobs.filter(
    (j) => j.status === "confirmed" && confirmedAt(j) >= weekStart,
  );
  const confirmedPrevWeek = jobs.filter(
    (j) => j.status === "confirmed" && confirmedAt(j) >= prevWeekStart && confirmedAt(j) < weekStart,
  );
  const gmvThisWeek = confirmedThisWeek.reduce((s, j) => s + (j.agreedPrice ?? 0), 0);
  const gmvPrevWeek = confirmedPrevWeek.reduce((s, j) => s + (j.agreedPrice ?? 0), 0);

  const pendingApprovals = users.filter((u) => (u.accountStatus ?? "approved") === "pending").length;
  // Workers (required) + employers/businesses who opted into identity
  // verification — anyone who submitted but isn't promoted/reviewed yet.
  const pendingVerifications = users.filter(
    (u) =>
      u.role !== "admin"
      && u.verification?.submittedAt
      && (u.verificationStatus ?? "none") === "none",
  ).length;
  const resubmittedVerifications = users.filter((u) => {
    if (u.role !== "worker") return false;
    const sub = u.verification?.submittedAt ?? 0;
    const rev = u.verification?.reviewedAt ?? 0;
    const resub = u.verification?.resubmittedAt ?? 0;
    return sub > 0 && rev > 0 && (resub > rev || sub > rev);
  }).length;
  const openDisputes = jobs.filter((j) => j.status === "disputed").length;

  // ---------- Happening now ----------
  const liveJobs = jobs
    .filter((j) => j.status === "in_progress" || (j.status === "assigned" && j.enRouteAt))
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  const awaitingConfirm = jobs.filter((j) => j.status === "completed").length;
  const urgentOpen = jobs.filter((j) => j.status === "open" && j.urgent).length;
  // Worker self-flag auto-expires after 8h — respect that here.
  const availableWorkers = users.filter(
    (u) =>
      u.role === "worker"
      && u.availableNow
      && (u.availableNowAt ?? 0) >= now - 8 * 60 * 60 * 1000
      && (u.accountStatus ?? "approved") === "approved",
  );
  const emergencies = jobs
    .filter((j) => (j.emergencyTriggeredAt ?? 0) >= now - 24 * 60 * 60 * 1000)
    .sort((a, b) => (b.emergencyTriggeredAt ?? 0) - (a.emergencyTriggeredAt ?? 0));

  // ---------- 30-day funnel ----------
  const last30 = jobs.filter((j) => (j.createdAt ?? 0) >= todayStart - 29 * DAY);
  const funnelPosted = last30.length;
  const funnelOffers = last30.filter((j) => (j.offerCount ?? 0) > 0 || j.assignedWorkerId || (j.assignedWorkerIds?.length ?? 0) > 0).length;
  const funnelAssigned = last30.filter(
    (j) => j.assignedWorkerId || (j.assignedWorkerIds?.length ?? 0) > 0 || ["assigned", "in_progress", "completed", "confirmed"].includes(j.status),
  ).length;
  const funnelConfirmed = last30.filter((j) => j.status === "confirmed").length;
  const funnel = [
    { label: "Posted", value: funnelPosted, color: "var(--color-ochre-500)" },
    { label: "Got offers", value: funnelOffers, color: "var(--color-sage-600)" },
    { label: "Assigned", value: funnelAssigned, color: "var(--color-ink)" },
    { label: "Confirmed done", value: funnelConfirmed, color: "var(--color-sage-700)" },
  ];

  // ---------- Smart insights (rule-based) ----------
  const insights = buildInsights({
    now,
    users,
    jobs,
    usersByWeek,
    usersPrevWeek,
    postedThisWeek,
    postedPrevWeek,
    openJobs,
    availableWorkers: availableWorkers.length,
    pendingVerifications,
    funnelPosted,
    funnelOffers,
    funnelConfirmed,
  });

  // ---------- Attention list ----------
  const attention: Array<{
    label: string;
    count: number;
    href: AdminSection;
    tone: "brick" | "ochre" | "sage";
  }> = [];
  if (openDisputes > 0) attention.push({ label: "Open disputes", count: openDisputes, href: "disputes", tone: "brick" });
  if (pendingApprovals > 0) attention.push({ label: "Accounts waiting approval", count: pendingApprovals, href: "approvals", tone: "ochre" });
  if (pendingVerifications > 0) attention.push({ label: "New verifications", count: pendingVerifications, href: "verification", tone: "ochre" });
  if (resubmittedVerifications > 0) attention.push({ label: "Workers re-submitted after rejection", count: resubmittedVerifications, href: "verification", tone: "brick" });

  // ---------- 30-day trend buckets ----------
  // Pre-compute daily counts for signups, posts, completions, disputes.
  const DAYS = 30;
  const dayStart = (ms: number) => startOfDay(ms);
  const buckets: number[][] = [
    new Array(DAYS).fill(0), // signups
    new Array(DAYS).fill(0), // jobs posted
    new Array(DAYS).fill(0), // jobs confirmed (completed)
    new Array(DAYS).fill(0), // disputes raised
  ];
  const oldest = todayStart - (DAYS - 1) * DAY;
  const idxFor = (at: number) => Math.floor((dayStart(at) - oldest) / DAY);
  for (const u of users) {
    const t = u.createdAt ?? 0;
    if (t >= oldest) {
      const i = idxFor(t);
      if (i >= 0 && i < DAYS) buckets[0][i] += 1;
    }
  }
  for (const j of jobs) {
    const created = j.createdAt ?? 0;
    if (created >= oldest) {
      const i = idxFor(created);
      if (i >= 0 && i < DAYS) buckets[1][i] += 1;
    }
    if (j.status === "confirmed") {
      const at = j.completedAt ?? j.updatedAt ?? j.createdAt ?? 0;
      if (at >= oldest) {
        const i = idxFor(at);
        if (i >= 0 && i < DAYS) buckets[2][i] += 1;
      }
    }
    if (j.dispute?.raisedAt && j.dispute.raisedAt >= oldest) {
      const i = idxFor(j.dispute.raisedAt);
      if (i >= 0 && i < DAYS) buckets[3][i] += 1;
    }
  }
  const trends: Array<{
    label: string;
    values: number[];
    color: string;
  }> = [
    { label: "Signups", values: buckets[0], color: "var(--color-ochre-500)" },
    { label: "Jobs posted", values: buckets[1], color: "var(--color-sage-600)" },
    { label: "Jobs completed", values: buckets[2], color: "var(--color-ink)" },
    { label: "Disputes raised", values: buckets[3], color: "var(--color-brick)" },
  ];

  // Recent activity (merge users + jobs, sort, take top 12)
  type Event = { at: number; kind: "signup" | "post" | "complete" | "dispute"; subject: string; meta?: string; href?: string };
  const events: Event[] = [
    ...users.map<Event>((u) => ({
      at: u.createdAt ?? 0,
      kind: "signup",
      subject: u.displayName || "New user",
      meta: u.role,
      href: `/u?id=${u.uid}`,
    })),
    ...jobs.flatMap<Event>((j) => {
      const arr: Event[] = [{ at: j.createdAt ?? 0, kind: "post", subject: j.title, meta: `${j.suburb} · R ${j.suggestedPrice}`, href: `/jobs?id=${j.id}` }];
      if (j.status === "confirmed") arr.push({ at: j.completedAt ?? j.updatedAt ?? j.createdAt ?? 0, kind: "complete", subject: j.title, meta: `R ${j.agreedPrice ?? j.suggestedPrice}`, href: `/jobs?id=${j.id}` });
      if (j.status === "disputed") arr.push({ at: j.dispute?.raisedAt ?? j.updatedAt ?? 0, kind: "dispute", subject: j.title, meta: j.dispute?.raisedByName ?? "", href: `/jobs?id=${j.id}` });
      return arr;
    }),
  ]
    .filter((e) => e.at > 0)
    .sort((a, b) => b.at - a.at)
    .slice(0, 12);

  return (
    <div className="space-y-6">
      {/* EMERGENCY BANNER — anything triggered in the last 24h outranks all */}
      {emergencies.length > 0 && (
        <section className="rounded-2xl border-2 border-[var(--color-brick-solid)] bg-[var(--color-brick-solid)]/10 p-4">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-[var(--color-brick-solid)] animate-ping flex-shrink-0" />
            <p className="font-display text-lg text-[var(--color-brick)]">
              Emergency button pressed — {emergencies.length === 1 ? "1 job" : `${emergencies.length} jobs`} in the last 24h
            </p>
          </div>
          <ul className="mt-2 space-y-1">
            {emergencies.slice(0, 3).map((j) => (
              <li key={j.id}>
                <Link href={`/jobs?id=${j.id}`} target="_blank" className="text-sm text-[var(--color-ink)] underline">
                  {j.title}
                </Link>
                <span className="text-xs text-[var(--color-ink-muted)] ml-2">
                  {j.suburb} · {relativeTime(j.emergencyTriggeredAt ?? 0, now)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* LIVE HEADER */}
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold">
          <span className="relative flex w-2.5 h-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-sage-600)] opacity-60" />
            <span className="relative inline-flex rounded-full w-2.5 h-2.5 bg-[var(--color-sage-600)]" />
          </span>
          Live — streaming from Firestore
        </p>
        <span className="text-[11px] text-[var(--color-ink-muted)] tabular-nums">
          {new Date(now).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })} SAST
        </span>
      </div>

      {/* KPI ROW — with week-on-week deltas */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi
          label="Signups today"
          value={usersByDay}
          sub={`${usersByWeek} in last 7 days`}
          tone="ochre"
          delta={pctChange(usersByWeek, usersPrevWeek)}
        />
        <Kpi
          label="Open jobs"
          value={openJobs}
          sub={`${activeJobs} in progress`}
          tone="sage"
          delta={pctChange(postedThisWeek, postedPrevWeek)}
          deltaLabel="posts WoW"
        />
        <Kpi
          label="Completed this week"
          value={confirmedThisWeek.length}
          sub={`R ${gmvThisWeek.toLocaleString("en-ZA")} GMV`}
          tone="ink"
          delta={pctChange(gmvThisWeek, gmvPrevWeek)}
          deltaLabel="GMV WoW"
        />
        <Kpi
          label="Need attention"
          value={pendingApprovals + pendingVerifications + openDisputes}
          sub={openDisputes > 0 ? `${openDisputes} disputed` : "All clear"}
          tone={openDisputes > 0 ? "brick" : "sage"}
        />
      </section>

      {/* HAPPENING NOW */}
      <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] overflow-hidden">
        <header className="px-5 py-3 border-b border-[var(--color-line)] flex items-center justify-between">
          <h2 className="font-display text-lg">Happening now</h2>
          <div className="flex items-center gap-2">
            {urgentOpen > 0 && <Badge tone="brick">🔥 {urgentOpen} urgent open</Badge>}
            {awaitingConfirm > 0 && <Badge tone="ochre">{awaitingConfirm} awaiting confirmation</Badge>}
          </div>
        </header>
        <div className="grid lg:grid-cols-3 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-[var(--color-line)]">
          {/* In-flight jobs */}
          <div className="lg:col-span-2">
            {liveJobs.length === 0 ? (
              <p className="p-8 text-center text-sm text-[var(--color-ink-muted)]">
                No jobs in motion right now.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--color-line)]">
                {liveJobs.slice(0, 5).map((j) => {
                  const crew = (j.assignedWorkers ?? []).filter((w) => w.status !== "removed");
                  const workerLabel = crew.length > 1
                    ? `${crew.length} workers`
                    : j.assignedWorkerName || crew[0]?.name || "Worker";
                  const enRoute = j.status === "assigned";
                  return (
                    <li key={j.id} className="px-5 py-3 hover:bg-[var(--color-cream-2)]/40 transition-colors">
                      <Link href={`/jobs?id=${j.id}`} target="_blank" className="flex items-center gap-3">
                        <span
                          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 animate-pulse ${
                            enRoute ? "bg-[var(--color-ochre-500)]" : "bg-[var(--color-sage-600)]"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[var(--color-ink)] truncate font-medium">{j.title}</p>
                          <p className="text-[11px] text-[var(--color-ink-muted)] truncate">
                            {workerLabel} · {enRoute ? "on the way" : "working"} · {j.suburb} · R {j.agreedPrice ?? j.suggestedPrice}
                          </p>
                        </div>
                        {j.workerLocationSharing && (
                          <Badge tone="sage">📍 live tracking</Badge>
                        )}
                        <span className="text-[10px] text-[var(--color-ink-muted)] flex-shrink-0">
                          {relativeTime(enRoute ? (j.enRouteAt ?? j.updatedAt ?? 0) : (j.updatedAt ?? 0), now)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {/* Available-now workers */}
          <div className="p-5">
            <p className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold">
              Workers available now
            </p>
            <p className="mt-1 font-display text-2xl text-[var(--color-ink)]">
              <AnimatedNumber value={availableWorkers.length} />
            </p>
            {availableWorkers.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {availableWorkers.slice(0, 5).map((w) => (
                  <li key={w.uid}>
                    <Link href={`/u?id=${w.uid}`} target="_blank" className="flex items-center gap-2 group">
                      <Avatar name={w.displayName} photoURL={w.photoURL} size="sm" />
                      <span className="text-sm text-[var(--color-ink)] truncate group-hover:underline">
                        {w.displayName || "Worker"}
                      </span>
                      <span className="text-[10px] text-[var(--color-ink-muted)] ml-auto flex-shrink-0">
                        {w.suburb || w.city || ""}
                      </span>
                    </Link>
                  </li>
                ))}
                {availableWorkers.length > 5 && (
                  <li className="text-[11px] text-[var(--color-ink-muted)]">
                    +{availableWorkers.length - 5} more
                  </li>
                )}
              </ul>
            ) : (
              <p className="mt-2 text-[11px] text-[var(--color-ink-muted)]">
                Nobody has the &ldquo;available now&rdquo; flag on.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* SMART INSIGHTS + FUNNEL */}
      <section className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] overflow-hidden">
          <header className="px-5 py-3 border-b border-[var(--color-line)] flex items-center justify-between">
            <h2 className="font-display text-lg">Smart insights</h2>
            <span className="text-[10px] uppercase tracking-widest text-[var(--color-ink-muted)]">
              Auto-generated
            </span>
          </header>
          {insights.length === 0 ? (
            <p className="p-8 text-center text-sm text-[var(--color-ink-muted)]">
              Not enough data yet — insights appear as the marketplace moves.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--color-line)]">
              {insights.map((ins, i) => (
                <li key={i} className="px-5 py-3 flex items-start gap-3">
                  <span
                    className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      ins.tone === "good"
                        ? "bg-[var(--color-sage-600)]"
                        : ins.tone === "warn"
                          ? "bg-[var(--color-ochre-500)]"
                          : "bg-[var(--color-brick-solid)]"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--color-ink)]">{ins.text}</p>
                    {ins.action && (
                      <button
                        type="button"
                        onClick={() => onJumpTo(ins.action!.href)}
                        className="mt-0.5 text-[11px] text-[var(--color-ochre-600)] hover:text-[var(--color-ochre-700)]"
                      >
                        {ins.action.label} →
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Funnel */}
        <div className="lg:col-span-2 rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] overflow-hidden">
          <header className="px-5 py-3 border-b border-[var(--color-line)] flex items-center justify-between">
            <h2 className="font-display text-lg">Job funnel</h2>
            <span className="text-[10px] uppercase tracking-widest text-[var(--color-ink-muted)]">
              Last 30 days
            </span>
          </header>
          <div className="p-5 space-y-4">
            {funnel.map((step, i) => {
              const pctOfPosted = funnelPosted > 0 ? Math.round((step.value / funnelPosted) * 100) : 0;
              return (
                <div key={step.label}>
                  <div className="flex items-baseline justify-between">
                    <p className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold">
                      {step.label}
                    </p>
                    <p className="text-sm text-[var(--color-ink)] tabular-nums">
                      {step.value}
                      {i > 0 && funnelPosted > 0 && (
                        <span className="text-[var(--color-ink-muted)] text-[11px] ml-1">({pctOfPosted}%)</span>
                      )}
                    </p>
                  </div>
                  <div className="mt-1 h-2.5 rounded-full bg-[var(--color-cream-2)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pctOfPosted}%`, background: step.color }}
                    />
                  </div>
                </div>
              );
            })}
            {funnelPosted === 0 && (
              <p className="text-center text-sm text-[var(--color-ink-muted)]">
                No jobs posted in the last 30 days.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* TRENDS — last 30 days */}
      <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] overflow-hidden">
        <header className="px-5 py-3 border-b border-[var(--color-line)] flex items-center justify-between">
          <h2 className="font-display text-lg">Trends · last 30 days</h2>
          <span className="text-[10px] uppercase tracking-widest text-[var(--color-ink-muted)]">
            Day-by-day
          </span>
        </header>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-[var(--color-line)]">
          {trends.map((t) => {
            const total = t.values.reduce((s, n) => s + n, 0);
            const peak = Math.max(...t.values);
            return (
              <div key={t.label} className="p-5">
                <p className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold">
                  {t.label}
                </p>
                <p className="mt-1 font-display text-2xl text-[var(--color-ink)]">
                  {total}
                </p>
                <p className="text-[11px] text-[var(--color-ink-muted)]">
                  peak {peak}/day
                </p>
                <div className="mt-3">
                  <Sparkline values={t.values} color={t.color} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* TWO COLUMN: attention + activity */}
      <section className="grid lg:grid-cols-5 gap-6">
        {/* Attention */}
        <div className="lg:col-span-2 rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] overflow-hidden">
          <header className="px-5 py-3 border-b border-[var(--color-line)] flex items-center justify-between">
            <h2 className="font-display text-lg">Attention</h2>
            <span className="text-[10px] uppercase tracking-widest text-[var(--color-ink-muted)]">
              Action needed
            </span>
          </header>
          <ul className="divide-y divide-[var(--color-line)]">
            {attention.length === 0 ? (
              <li className="p-8 text-center text-sm text-[var(--color-ink-muted)]">
                <span className="text-2xl block mb-2">🎉</span>
                Inbox zero. Nothing waiting on you.
              </li>
            ) : (
              attention.map((a) => (
                <li key={a.label}>
                  <button
                    type="button"
                    onClick={() => onJumpTo(a.href)}
                    className="w-full flex items-center justify-between gap-4 px-5 py-4 hover:bg-[var(--color-cream-2)]/60 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                          a.tone === "brick"
                            ? "bg-[var(--color-brick-solid)] animate-pulse"
                            : a.tone === "ochre"
                              ? "bg-[var(--color-ochre-500)]"
                              : "bg-[var(--color-sage-600)]"
                        }`}
                      />
                      <span className="text-sm text-[var(--color-ink)] truncate">{a.label}</span>
                    </div>
                    <span className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`font-display text-xl ${
                          a.tone === "brick" ? "text-[var(--color-brick)]" : "text-[var(--color-ink)]"
                        }`}
                      >
                        {a.count}
                      </span>
                      <span className="text-[var(--color-ink-muted)]">→</span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Activity feed */}
        <div className="lg:col-span-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] overflow-hidden">
          <header className="px-5 py-3 border-b border-[var(--color-line)] flex items-center justify-between">
            <h2 className="font-display text-lg">Recent activity</h2>
            <span className="text-[10px] uppercase tracking-widest text-[var(--color-ink-muted)]">
              Live · last 12 events
            </span>
          </header>
          {events.length === 0 ? (
            <p className="p-8 text-center text-sm text-[var(--color-ink-muted)]">
              No activity yet. Once users sign up and post jobs they&apos;ll appear here.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--color-line)]">
              {events.map((e, i) => (
                <li key={i} className="px-5 py-3 hover:bg-[var(--color-cream-2)]/40 transition-colors">
                  <Link href={e.href ?? "#"} target="_blank" className="flex items-center gap-3">
                    <EventDot kind={e.kind} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--color-ink)] truncate">
                        <span className="text-[var(--color-ink-muted)] mr-1">{eventVerb(e.kind)}</span>
                        <span className="font-medium">{e.subject}</span>
                      </p>
                      {e.meta && (
                        <p className="text-[11px] text-[var(--color-ink-muted)] truncate">
                          {e.meta}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-[var(--color-ink-muted)] flex-shrink-0">
                      {relativeTime(e.at, now)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* RECENT SIGNUPS */}
      <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] overflow-hidden">
        <header className="px-5 py-3 border-b border-[var(--color-line)] flex items-center justify-between">
          <h2 className="font-display text-lg">Newest accounts</h2>
          <button
            type="button"
            onClick={() => onJumpTo("users")}
            className="text-xs text-[var(--color-ochre-600)] hover:text-[var(--color-ochre-700)]"
          >
            View all users →
          </button>
        </header>
        <ul className="divide-y divide-[var(--color-line)]">
          {users.slice(0, 6).map((u) => (
            <li key={u.uid} className="flex items-center gap-4 px-5 py-3">
              <Avatar name={u.displayName} photoURL={u.photoURL} size="sm" />
              <div className="flex-1 min-w-0">
                <Link
                  href={`/u?id=${u.uid}`}
                  target="_blank"
                  className="text-sm text-[var(--color-ink)] hover:underline truncate inline-block max-w-full"
                >
                  {u.displayName || "Unnamed"}
                </Link>
                <p className="text-[11px] text-[var(--color-ink-muted)] truncate">
                  {u.email || u.phone || "—"}
                </p>
              </div>
              <Badge tone={u.role === "worker" ? "sage" : "ochre"}>{u.role}</Badge>
              <Badge tone={(u.accountStatus ?? "approved") === "approved" ? "sage" : "stone"}>
                {u.accountStatus ?? "legacy"}
              </Badge>
              <span className="hidden sm:inline text-[10px] text-[var(--color-ink-muted)] w-20 text-right flex-shrink-0">
                {relativeTime(u.createdAt ?? 0, now)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ---------- Smart insight rules ----------

type Insight = {
  text: string;
  tone: "good" | "warn" | "bad";
  action?: { label: string; href: AdminSection };
};

function buildInsights(d: {
  now: number;
  users: UserProfile[];
  jobs: Job[];
  usersByWeek: number;
  usersPrevWeek: number;
  postedThisWeek: number;
  postedPrevWeek: number;
  openJobs: number;
  availableWorkers: number;
  pendingVerifications: number;
  funnelPosted: number;
  funnelOffers: number;
  funnelConfirmed: number;
}): Insight[] {
  const out: Insight[] = [];
  const DAY = 24 * 60 * 60 * 1000;

  // Growth: signups week-on-week
  if (d.usersPrevWeek >= 3 || d.usersByWeek >= 3) {
    const pct = pctChange(d.usersByWeek, d.usersPrevWeek);
    if (pct !== null && Math.abs(pct) >= 15) {
      out.push({
        tone: pct > 0 ? "good" : "warn",
        text: `Signups are ${pct > 0 ? "up" : "down"} ${Math.abs(pct)}% week-on-week (${d.usersByWeek} vs ${d.usersPrevWeek}).`,
      });
    }
  }

  // Demand: job posts week-on-week
  if (d.postedPrevWeek >= 3 || d.postedThisWeek >= 3) {
    const pct = pctChange(d.postedThisWeek, d.postedPrevWeek);
    if (pct !== null && Math.abs(pct) >= 15) {
      out.push({
        tone: pct > 0 ? "good" : "warn",
        text: `Job posts are ${pct > 0 ? "up" : "down"} ${Math.abs(pct)}% week-on-week (${d.postedThisWeek} vs ${d.postedPrevWeek}).`,
      });
    }
  }

  // Liquidity: open jobs with zero offers for 3+ days
  const staleOpen = d.jobs.filter(
    (j) => j.status === "open" && (j.offerCount ?? 0) === 0 && (j.createdAt ?? 0) < d.now - 3 * DAY,
  );
  if (staleOpen.length > 0) {
    const oldestDays = Math.floor((d.now - Math.min(...staleOpen.map((j) => j.createdAt ?? d.now))) / DAY);
    out.push({
      tone: "warn",
      text: `${staleOpen.length} open ${staleOpen.length === 1 ? "job has" : "jobs have"} had no offers for 3+ days (oldest: ${oldestDays} days). Workers may not be seeing them.`,
    });
  }

  // Marketplace balance: demand vs available supply
  if (d.openJobs >= 5 && d.availableWorkers > 0 && d.openJobs / d.availableWorkers >= 4) {
    out.push({
      tone: "warn",
      text: `${d.openJobs} open jobs but only ${d.availableWorkers} ${d.availableWorkers === 1 ? "worker" : "workers"} flagged available now — supply is the bottleneck.`,
    });
  }

  // Offer coverage in the 30-day funnel
  if (d.funnelPosted >= 5) {
    const offerRate = Math.round((d.funnelOffers / d.funnelPosted) * 100);
    if (offerRate < 60) {
      out.push({
        tone: "bad",
        text: `Only ${offerRate}% of jobs posted in the last 30 days received an offer — matchmaking needs attention.`,
      });
    } else if (offerRate >= 85) {
      out.push({
        tone: "good",
        text: `${offerRate}% of jobs posted in the last 30 days received at least one offer — healthy liquidity.`,
      });
    }
    const confirmRate = Math.round((d.funnelConfirmed / d.funnelPosted) * 100);
    if (confirmRate >= 50) {
      out.push({
        tone: "good",
        text: `${confirmRate}% of jobs posted in the last 30 days were completed and confirmed.`,
      });
    }
  }

  // Busiest category + suburb this week
  const weekJobs = d.jobs.filter((j) => (j.createdAt ?? 0) >= d.now - 7 * DAY);
  if (weekJobs.length >= 3) {
    const topCat = topBy(weekJobs.map((j) => j.category));
    if (topCat) {
      const label = CATEGORIES.find((c) => c.id === topCat.key)?.label ?? topCat.key;
      out.push({
        tone: "good",
        text: `${label} is the busiest category this week (${topCat.count} of ${weekJobs.length} posts).`,
      });
    }
    const topArea = topBy(weekJobs.map((j) => j.suburb || j.city).filter(Boolean));
    if (topArea && topArea.count >= 2) {
      out.push({
        tone: "good",
        text: `Most job activity this week is in ${topArea.key} (${topArea.count} posts).`,
      });
    }
  }

  // Verification queue ageing
  if (d.pendingVerifications > 0) {
    const oldestSubmit = Math.min(
      ...d.users
        .filter(
          (u) =>
            u.role === "worker"
            && u.verification?.submittedAt
            && (u.verificationStatus ?? "none") === "none",
        )
        .map((u) => u.verification!.submittedAt!),
    );
    const days = Math.floor((d.now - oldestSubmit) / DAY);
    if (days >= 2) {
      out.push({
        tone: days >= 5 ? "bad" : "warn",
        text: `The oldest unreviewed worker verification has been waiting ${days} days. Slow reviews cost worker trust.`,
        action: { label: "Review verifications", href: "verification" },
      });
    }
  }

  // Dispute rate over 30 days
  const finished30 = d.jobs.filter(
    (j) =>
      (j.status === "confirmed" || j.status === "disputed")
      && (j.completedAt ?? j.dispute?.raisedAt ?? j.updatedAt ?? 0) >= d.now - 30 * DAY,
  );
  const disputed30 = finished30.filter((j) => j.status === "disputed" || j.dispute).length;
  if (finished30.length >= 10) {
    const rate = Math.round((disputed30 / finished30.length) * 100);
    out.push({
      tone: rate > 10 ? "bad" : "good",
      text: `Dispute rate is ${rate}% over the last 30 days (${disputed30} of ${finished30.length} finished jobs).`,
      ...(rate > 10 ? { action: { label: "Open disputes", href: "disputes" as AdminSection } } : {}),
    });
  }

  return out.slice(0, 7);
}

function topBy(values: string[]): { key: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: { key: string; count: number } | null = null;
  for (const [key, count] of counts) {
    if (!best || count > best.count) best = { key, count };
  }
  return best;
}

/** Percent change, or null when the previous period is empty (no meaningful %). */
function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function Kpi({
  label,
  value,
  sub,
  tone,
  delta,
  deltaLabel = "WoW",
}: {
  label: string;
  value: number | string;
  sub?: string;
  tone: "ochre" | "sage" | "ink" | "brick";
  /** Week-on-week % change; null/undefined hides the chip. */
  delta?: number | null;
  deltaLabel?: string;
}) {
  const accent: Record<typeof tone, string> = {
    ochre: "border-l-[var(--color-ochre-500)]",
    sage: "border-l-[var(--color-sage-600)]",
    ink: "border-l-[var(--color-ink)]",
    brick: "border-l-[var(--color-brick)]",
  } as Record<typeof tone, string>;
  return (
    <div className={`rounded-2xl border border-[var(--color-line)] border-l-[6px] ${accent[tone]} bg-[var(--color-paper)] p-4`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold">
          {label}
        </p>
        {typeof delta === "number" && (
          <span
            className={`text-[10px] font-semibold tabular-nums flex-shrink-0 px-1.5 py-0.5 rounded-full ${
              delta > 0
                ? "text-[var(--color-sage-700)] bg-[var(--color-sage-600)]/10"
                : delta < 0
                  ? "text-[var(--color-brick)] bg-[var(--color-brick-solid)]/10"
                  : "text-[var(--color-ink-muted)] bg-[var(--color-cream-2)]"
            }`}
            title={`${deltaLabel}: this week vs last week`}
          >
            {delta > 0 ? "▲" : delta < 0 ? "▼" : "•"} {Math.abs(delta)}%
          </span>
        )}
      </div>
      <p className="mt-1 font-display text-3xl text-[var(--color-ink)] tabular-nums">
        {typeof value === "number" ? <AnimatedNumber value={value} /> : value}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-[var(--color-ink-muted)]">{sub}</p>}
    </div>
  );
}

function EventDot({ kind }: { kind: "signup" | "post" | "complete" | "dispute" }) {
  const map = {
    signup: { bg: "bg-[var(--color-ochre-300)]", icon: "👤" },
    post: { bg: "bg-[var(--color-sage-400)]", icon: "📝" },
    complete: { bg: "bg-[var(--color-sage-600)]", icon: "✓" },
    dispute: { bg: "bg-[var(--color-brick-solid)]", icon: "!" },
  } as const;
  const m = map[kind];
  return (
    <span
      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${m.bg} text-white`}
    >
      {m.icon}
    </span>
  );
}

function eventVerb(kind: "signup" | "post" | "complete" | "dispute"): string {
  return {
    signup: "Joined:",
    post: "Posted:",
    complete: "Completed:",
    dispute: "Disputed:",
  }[kind];
}

/**
 * Tiny SVG sparkline — area-fill under a line. No external library.
 * Values can be any non-negative numbers; the chart auto-scales to its max.
 */
function Sparkline({
  values,
  color = "var(--color-ink)",
  height = 48,
}: {
  values: number[];
  color?: string;
  height?: number;
}) {
  const W = 240;
  const H = height;
  const pad = 2;
  const max = Math.max(1, ...values);
  const n = values.length;
  const stepX = (W - pad * 2) / Math.max(1, n - 1);
  const points = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = H - pad - (v / max) * (H - pad * 2);
    return [x, y] as const;
  });
  const linePath = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L ${(pad + (n - 1) * stepX).toFixed(1)} ${H - pad} L ${pad} ${H - pad} Z`;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full h-12"
      aria-hidden
    >
      <path d={areaPath} fill={color} opacity={0.15} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      {/* Today marker — last point */}
      {points.length > 0 && (() => {
        const last = points[points.length - 1];
        return <circle cx={last[0]} cy={last[1]} r={2.5} fill={color} />;
      })()}
    </svg>
  );
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function relativeTime(ts: number, now: number): string {
  if (!ts) return "";
  const diff = Math.max(0, now - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}
