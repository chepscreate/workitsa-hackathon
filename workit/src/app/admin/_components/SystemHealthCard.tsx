"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { getDb } from "@/lib/firebase";

/**
 * System health — is the machinery actually running?
 *
 * Every scheduled Cloud Function writes a heartbeat (opsHealth/{name}) at the
 * top of each run. This card compares the last beat against the scheduler's
 * expected cadence and shouts when one is overdue — a silently broken
 * scheduler (disabled job, failed deploy, quota) surfaces here instead of
 * being discovered days later when its work is missing.
 *
 * "never yet" is normal right after this feature ships — each row fills in
 * the first time its scheduler fires.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** What we expect of each scheduler: label, cadence text, max healthy gap.
 *  Gaps are the cadence + generous slack (weekday jobs must survive weekends). */
const SCHEDULERS: { name: string; label: string; cadence: string; maxGapMs: number }[] = [
  { name: "scheduledRecurringJobs", label: "Recurring jobs minting", cadence: "daily 05:00", maxGapMs: DAY + 2 * HOUR },
  { name: "scheduledDeletionRequestCheck", label: "POPIA deletion-request check", cadence: "daily 06:00", maxGapMs: DAY + 2 * HOUR },
  { name: "jarvisMorningDigest", label: "Jarvis morning digest", cadence: "daily 07:00", maxGapMs: DAY + 2 * HOUR },
  { name: "scheduledFacebookPostMorning", label: "Facebook clip post", cadence: "daily 08:00", maxGapMs: DAY + 2 * HOUR },
  { name: "scheduledMarketingOutreach", label: "Marketing emails (morning)", cadence: "weekdays 08:30", maxGapMs: 3 * DAY + 2 * HOUR },
  { name: "scheduledMarketingOutreachAfternoon", label: "Marketing emails (afternoon)", cadence: "weekdays 13:30", maxGapMs: 3 * DAY + 2 * HOUR },
  { name: "scheduledFacebookPost", label: "Facebook image post", cadence: "daily 17:30", maxGapMs: DAY + 2 * HOUR },
  { name: "scheduledFirestoreBackup", label: "Firestore backup", cadence: "Sundays 02:00", maxGapMs: 7 * DAY + 6 * HOUR },
  { name: "scheduledRetentionCleanup", label: "5-year retention cleanup", cadence: "monthly", maxGapMs: 32 * DAY },
];

function ago(ms: number): string {
  const d = Date.now() - ms;
  if (d < HOUR) return `${Math.max(1, Math.round(d / 60000))} min ago`;
  if (d < DAY) return `${Math.round(d / HOUR)} h ago`;
  return `${Math.round(d / DAY)} d ago`;
}

export default function SystemHealthCard() {
  const [beats, setBeats] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    getDocs(collection(getDb(), "opsHealth"))
      .then((snap) => {
        const m: Record<string, number> = {};
        snap.docs.forEach((d) => {
          const t = d.data().lastRunAt;
          if (typeof t === "number") m[d.id] = t;
        });
        setBeats(m);
      })
      .catch(() => setBeats({}));
  }, []);

  const overdueCount =
    beats === null
      ? 0
      : SCHEDULERS.filter((s) => beats[s.name] && Date.now() - beats[s.name] > s.maxGapMs).length;

  return (
    <section className="mt-6 rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] overflow-hidden">
      <header className="px-5 py-3 border-b border-[var(--color-line)] flex items-center justify-between">
        <h2 className="font-display text-lg">System health · schedulers</h2>
        <span
          className={`text-[10px] uppercase tracking-widest font-semibold ${
            overdueCount > 0 ? "text-[var(--color-brick)]" : "text-[var(--color-sage-700)]"
          }`}
        >
          {beats === null ? "checking…" : overdueCount > 0 ? `${overdueCount} overdue` : "all running"}
        </span>
      </header>
      <ul className="divide-y divide-[var(--color-line)]">
        {SCHEDULERS.map((s) => {
          const last = beats?.[s.name];
          const overdue = !!last && Date.now() - last > s.maxGapMs;
          return (
            <li key={s.name} className="px-5 py-2.5 flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 min-w-0">
                <span
                  aria-hidden
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    beats === null
                      ? "bg-[var(--color-line)]"
                      : overdue
                        ? "bg-[var(--color-brick)] animate-pulse"
                        : last
                          ? "bg-[var(--color-sage-600)]"
                          : "bg-[var(--color-ink-muted)]/40"
                  }`}
                />
                <span className="truncate text-[var(--color-ink)]">{s.label}</span>
                <span className="text-[10px] text-[var(--color-ink-muted)] whitespace-nowrap">
                  {s.cadence}
                </span>
              </span>
              <span
                className={`text-xs whitespace-nowrap tabular-nums ${
                  overdue ? "text-[var(--color-brick)] font-semibold" : "text-[var(--color-ink-muted)]"
                }`}
              >
                {beats === null ? "…" : last ? `${overdue ? "⚠ " : ""}${ago(last)}` : "never yet"}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="px-5 py-2.5 text-[10px] text-[var(--color-ink-muted)] border-t border-[var(--color-line)]">
        Heartbeats start recording from each scheduler&apos;s first run after 12 Jul — &quot;never
        yet&quot; clears within a day (backup: Sunday, retention: 1st of month).
      </p>
    </section>
  );
}
