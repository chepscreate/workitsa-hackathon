"use client";

/**
 * Active SOS queue — the safety team's live view of anyone who has pressed the
 * emergency button on a job. Renders nothing when all is calm; when an alert is
 * live it pins a loud brick banner to the top of EVERY admin tab with who,
 * where, a map pin (GPS captured at the alert) and a one-tap "Mark handled".
 *
 * The real-time page-out (founder email + admin push) is done server-side by
 * onJobEmergencyAlert; this is the in-dashboard companion to work the alert from.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { subscribeActiveEmergencies, resolveEmergency } from "@/lib/jobs";
import { useAuth } from "@/contexts/AuthContext";
import type { Job } from "@/lib/types";

function ago(ms?: number): string {
  if (!ms) return "";
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  return `${Math.round(m / 60)}h ago`;
}

export default function EmergencyAlertsPanel() {
  const { profile } = useAuth();
  const [alerts, setAlerts] = useState<Job[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => subscribeActiveEmergencies(setAlerts), []);

  if (alerts.length === 0) return null;

  const handled = async (job: Job) => {
    if (!profile) return;
    setBusyId(job.id);
    try {
      await resolveEmergency(job.id, profile.uid, profile.displayName ?? "Admin");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mb-6 rounded-2xl border-2 border-[var(--color-brick)] bg-[var(--color-brick-soft)]/40 overflow-hidden shadow-lift">
      <div className="px-4 py-2.5 bg-[var(--color-brick-solid)] text-white flex items-center gap-2">
        <span className="text-lg leading-none" aria-hidden>🚨</span>
        <span className="font-display text-lg">
          {alerts.length} active SOS {alerts.length === 1 ? "alert" : "alerts"} — act now
        </span>
      </div>
      <ul className="divide-y divide-[var(--color-brick)]/20">
        {alerts.map((job) => {
          const e = job.emergency;
          const who =
            e?.triggeredByName
            ?? (e?.triggeredByRole === "employer" ? job.employerName : job.assignedWorkerName)
            ?? "Someone";
          const where = [job.suburb, job.city].filter(Boolean).join(", ");
          const mapHref = e?.lat != null && e?.lng != null
            ? `https://www.google.com/maps?q=${e.lat},${e.lng}`
            : null;
          return (
            <li key={job.id} className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex-1 min-w-[220px]">
                <p className="text-sm">
                  <b className="text-[var(--color-brick)]">{who}</b>
                  {e?.triggeredByRole ? ` (${e.triggeredByRole})` : ""} feels unsafe on{" "}
                  <Link href={`/jobs?id=${job.id}`} className="font-medium underline underline-offset-2">
                    {job.title}
                  </Link>
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
                  {where ? `${where} · ` : ""}{ago(e?.at)}
                  {e?.accuracy != null ? ` · GPS ±${Math.round(e.accuracy)}m` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {mapHref ? (
                  <a
                    href={mapHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 rounded-pill text-xs font-medium border border-[var(--color-brick)] text-[var(--color-brick)] hover:bg-[var(--color-brick-soft)]/60"
                  >
                    📍 Open map
                  </a>
                ) : (
                  <span className="px-3 py-2 text-xs text-[var(--color-ink-muted)]">No GPS</span>
                )}
                <a
                  href="tel:10111"
                  className="px-3 py-2 rounded-pill text-xs font-medium border border-[var(--color-brick)] text-[var(--color-brick)] hover:bg-[var(--color-brick-soft)]/60"
                >
                  Call 10111
                </a>
                <button
                  type="button"
                  onClick={() => handled(job)}
                  disabled={busyId === job.id}
                  className="px-3 py-2 rounded-pill text-xs font-medium bg-[var(--color-ink)] text-[var(--color-cream)] hover:opacity-90 disabled:opacity-50"
                >
                  {busyId === job.id ? "…" : "Mark handled"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
