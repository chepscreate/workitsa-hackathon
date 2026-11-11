"use client";

/**
 * Admin heatmap tab — GPS heat layer + a clickable suburb breakdown, across
 * three layers: where the JOBS are, where the WORKERS are, and where the
 * EMPLOYERS/businesses are.
 *
 * PRIVACY: jobs plot their exact employer-set pin (job.lat/lng). People plot
 * their PUBLIC ~1km-rounded home location (approxLat/approxLng) only — never
 * exact coordinates — and this tab is admin-only. No live tracking; this is a
 * density view of where the marketplace's supply + demand sit.
 *
 * Click a suburb to zoom the map + (for the jobs layer) see the job list.
 */

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Badge from "@/components/Badge";
import type { Job, UserProfile } from "@/lib/types";

const HeatMap = dynamic(() => import("@/components/HeatMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[480px] rounded-2xl bg-[var(--color-cream-2)] animate-pulse" />
  ),
});

type Layer = "jobs" | "workers" | "employers";
type Point = { lat: number; lng: number; weight?: number };

type SuburbStat = {
  suburb: string;
  city?: string;
  total: number;
  open: number; // jobs layer only
  points: Point[];
  jobs: Job[]; // jobs layer only
};

const hasPin = (x: { lat?: number; lng?: number }) =>
  typeof x.lat === "number" && typeof x.lng === "number";

export default function HeatmapTab({ jobs, users }: { jobs: Job[]; users: UserProfile[] }) {
  const [layer, setLayer] = useState<Layer>("jobs");
  const [selected, setSelected] = useState<string | null>(null);

  // People for the active people-layer, normalised to {lat,lng} from the public
  // ~1km-rounded home location so the rest of the code treats them like jobs.
  const peoplePins = useMemo(() => {
    const wantWorker = layer === "workers";
    if (layer === "jobs") return [];
    return users
      .filter((u) =>
        wantWorker ? u.role === "worker" : u.role === "employer" || u.role === "business",
      )
      .map((u) => ({
        suburb: u.suburb,
        city: u.city,
        lat: u.approxLat,
        lng: u.approxLng,
      }));
  }, [layer, users]);

  const totalForLayer =
    layer === "jobs"
      ? jobs.length
      : users.filter((u) =>
          layer === "workers"
            ? u.role === "worker"
            : u.role === "employer" || u.role === "business",
        ).length;

  const allPoints: Point[] = useMemo(() => {
    if (layer === "jobs") {
      return jobs
        .filter(hasPin)
        .map((j) => ({ lat: j.lat as number, lng: j.lng as number, weight: j.status === "open" ? 1 : 0.4 }));
    }
    return peoplePins
      .filter(hasPin)
      .map((p) => ({ lat: p.lat as number, lng: p.lng as number, weight: 1 }));
  }, [layer, jobs, peoplePins]);

  const suburbs: SuburbStat[] = useMemo(() => {
    const map = new Map<string, SuburbStat>();
    const add = (
      suburb: string | undefined,
      city: string | undefined,
      pin: { lat?: number; lng?: number },
      opts: { open?: boolean; job?: Job },
    ) => {
      const key = (suburb || "Unknown").trim();
      const existing =
        map.get(key) ?? { suburb: key, city, total: 0, open: 0, points: [], jobs: [] };
      existing.total += 1;
      if (opts.open) existing.open += 1;
      if (hasPin(pin)) existing.points.push({ lat: pin.lat as number, lng: pin.lng as number, weight: opts.open ? 1 : 0.4 });
      if (opts.job) existing.jobs.push(opts.job);
      map.set(key, existing);
    };
    if (layer === "jobs") {
      for (const j of jobs) add(j.suburb, j.city, j, { open: j.status === "open", job: j });
    } else {
      for (const p of peoplePins) add(p.suburb, p.city, p, {});
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [layer, jobs, peoplePins]);

  const totalPinned = allPoints.length;
  const totalUnpinned = totalForLayer - totalPinned;
  const selectedStat = selected ? suburbs.find((s) => s.suburb === selected) ?? null : null;
  const focus = selectedStat && selectedStat.points.length > 0 ? selectedStat.points : undefined;

  const noun = layer === "jobs" ? "jobs" : layer === "workers" ? "workers" : "employers";
  const openCount = jobs.filter((j) => j.status === "open").length;

  const switchLayer = (l: Layer) => {
    setLayer(l);
    setSelected(null);
  };

  return (
    <div className="mt-6 space-y-4">
      {/* Layer toggle */}
      <div className="flex flex-wrap gap-2">
        {(["jobs", "workers", "employers"] as Layer[]).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => switchLayer(l)}
            className={`px-4 py-2 rounded-pill text-sm capitalize transition-colors ${
              layer === l
                ? "bg-[var(--color-ink)] text-[var(--color-cream)]"
                : "bg-[var(--color-paper)] border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:bg-[var(--color-cream-2)]"
            }`}
          >
            {l === "jobs" ? "Jobs" : l === "workers" ? "Workers" : "Employers"}
          </button>
        ))}
      </div>

      {/* KPI row */}
      <div className="grid sm:grid-cols-4 gap-3">
        <Stat label={`${noun[0].toUpperCase()}${noun.slice(1)} total`} value={totalForLayer} />
        <Stat label="On the map" value={totalPinned} tone="sage" />
        {layer === "jobs" ? (
          <Stat label="Open right now" value={openCount} tone="ochre" />
        ) : (
          <Stat label="No location yet" value={Math.max(0, totalUnpinned)} tone="ochre" />
        )}
        <Stat label="Suburbs covered" value={suburbs.length} />
      </div>

      {totalPinned === 0 ? (
        <div className="rounded-xl p-10 bg-[var(--color-paper)] border border-dashed border-[var(--color-line)] text-center text-[var(--color-ink-muted)]">
          {layer === "jobs"
            ? "No jobs with a GPS pin yet. Once employers pin job locations, they'll show up here."
            : `No ${noun} with a saved location yet. People appear here once they pin their home area on their profile.`}
        </div>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start">
          {/* Map */}
          <div>
            <HeatMap points={allPoints} focus={focus} />
            <p className="text-xs text-[var(--color-ink-muted)] mt-2">
              {layer === "jobs"
                ? totalUnpinned > 0
                  ? `${totalUnpinned} job${totalUnpinned === 1 ? "" : "s"} not plotted (suburb only, no GPS pin).`
                  : "Job pins are the employer-set location."
                : "People are shown at their ~1 km-rounded home area (never exact) — admin-only density."}
            </p>
          </div>

          {/* Suburb breakdown */}
          <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] overflow-hidden">
            <header className="px-4 py-3 border-b border-[var(--color-line)] flex items-center justify-between">
              <h3 className="font-display text-base">Suburbs</h3>
              {selected && (
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-xs text-[var(--color-ochre-600)] hover:text-[var(--color-ochre-700)]"
                >
                  All suburbs
                </button>
              )}
            </header>
            <ul className="max-h-[420px] overflow-y-auto divide-y divide-[var(--color-line)]">
              {suburbs.map((s) => {
                const active = s.suburb === selected;
                return (
                  <li key={s.suburb}>
                    <button
                      type="button"
                      onClick={() => setSelected(active ? null : s.suburb)}
                      className={`w-full text-left px-4 py-3 flex items-center justify-between gap-2 transition-colors ${
                        active ? "bg-[var(--color-ochre-50)]" : "hover:bg-[var(--color-cream-2)]/60"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-[var(--color-ink)] truncate">
                          {s.suburb}
                        </span>
                        {s.city && (
                          <span className="block text-[11px] text-[var(--color-ink-muted)] truncate">
                            {s.city}
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-1.5 flex-shrink-0">
                        {layer === "jobs" && s.open > 0 && <Badge tone="sage">{s.open} open</Badge>}
                        <span className="text-sm font-display text-[var(--color-ink)]">{s.total}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {/* Selected suburb detail — job list (jobs layer only) */}
      {selectedStat && layer === "jobs" && (
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-5 shadow-soft animate-slide-up">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <h3 className="font-display text-xl">
              {selectedStat.suburb}
              {selectedStat.city ? `, ${selectedStat.city}` : ""}
            </h3>
            <div className="flex items-center gap-2">
              <Badge tone="ochre">{selectedStat.total} total</Badge>
              {selectedStat.open > 0 && <Badge tone="sage">{selectedStat.open} open</Badge>}
            </div>
          </div>
          <ul className="divide-y divide-[var(--color-line)]">
            {selectedStat.jobs.slice(0, 25).map((j) => (
              <li key={j.id} className="py-2 flex items-center justify-between gap-3">
                <Link
                  href={`/jobs?id=${j.id}`}
                  target="_blank"
                  className="text-sm text-[var(--color-ink)] hover:underline truncate"
                >
                  {j.title}
                </Link>
                <span className="flex items-center gap-2 flex-shrink-0 text-xs text-[var(--color-ink-muted)]">
                  <Badge tone={j.status === "open" ? "sage" : "stone"}>{j.status}</Badge>
                  R {j.suggestedPrice}
                </span>
              </li>
            ))}
          </ul>
          {selectedStat.jobs.length > 25 && (
            <p className="text-xs text-[var(--color-ink-muted)] mt-2">
              + {selectedStat.jobs.length - 25} more in {selectedStat.suburb}.
            </p>
          )}
        </div>
      )}

      {/* Selected suburb detail — count only (people layers; no individual PII) */}
      {selectedStat && layer !== "jobs" && (
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-5 shadow-soft animate-slide-up">
          <h3 className="font-display text-xl">
            {selectedStat.suburb}
            {selectedStat.city ? `, ${selectedStat.city}` : ""}
          </h3>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            <b className="text-[var(--color-ink)]">{selectedStat.total}</b> {noun} with a home area here.
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "ink",
}: {
  label: string;
  value: number;
  tone?: "ink" | "sage" | "ochre";
}) {
  const color =
    tone === "sage"
      ? "text-[var(--color-sage-700)]"
      : tone === "ochre"
        ? "text-[var(--color-ochre-600)]"
        : "text-[var(--color-ink)]";
  return (
    <div className="rounded-2xl p-4 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
      <p className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold">
        {label}
      </p>
      <p className={`mt-1 font-display text-2xl ${color}`}>{value}</p>
    </div>
  );
}
