"use client";

import Link from "next/link";
import Badge from "@/components/Badge";
import Avatar from "@/components/Avatar";
import ReputationBadges from "@/components/ReputationBadges";
import { StarsRead } from "@/components/Stars";
import { computeBadges, isAvailableNow, skillLabel, type UserProfile } from "@/lib/types";
import { formatDistance } from "@/lib/geo";

/**
 * Directory card for one worker (used on /workers). Shows the trust signals,
 * the worker's declared specific skills, up to three showcase photos, and a
 * live "Available now" pulse when their self-flag is inside its 8h window.
 * The whole card links to the public profile where the employer can invite
 * them to a job.
 */
export default function WorkerCard({ worker, km }: { worker: UserProfile; km?: number }) {
  // Verified/Gold are already rendered as explicit badges below — showing
  // them again via ReputationBadges duplicated "✓ Verified" on every card.
  const badges = computeBadges(worker).filter(
    (b) => b.id !== "verified" && b.id !== "background-verified",
  );
  const available = isAvailableNow(worker);
  const skillNames = (worker.skills ?? [])
    .map((id) => skillLabel(id))
    .filter((s): s is string => !!s);
  const photos = (worker.portfolioImageURLs ?? []).slice(0, 3);
  return (
    <Link
      href={`/u?id=${worker.uid}`}
      className="block rounded-xl p-5 bg-[var(--color-paper)] border border-[var(--color-line)] hover:shadow-lift hover:-translate-y-0.5 transition-all"
    >
      <div className="flex items-start gap-3">
        <Avatar name={worker.displayName} photoURL={worker.photoURL} size="md" />
        <div className="flex-1 min-w-0">
          <p className="font-display text-lg text-[var(--color-ink)] truncate">
            {worker.displayName}
          </p>
          {worker.tagline && (
            <p className="text-xs text-[var(--color-ink-muted)] italic line-clamp-1">
              {worker.tagline}
            </p>
          )}
          <div className="mt-1.5">
            <StarsRead value={worker.ratingAvg} count={worker.ratingCount} />
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {available && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-[11px] font-medium bg-[var(--color-sage-100)] text-[var(--color-sage-700)] border border-[var(--color-sage-400)]/50">
            <span className="w-2 h-2 rounded-full bg-[var(--color-sage-600)] animate-pulse" />
            Available now
          </span>
        )}
        {worker.verificationStatus === "approved" && <Badge tone="sage">✓ Verified</Badge>}
        {worker.backgroundVerified && <Badge tone="ochre">🥇 Gold</Badge>}
        {badges.length > 0 && (
          <ReputationBadges badges={badges.slice(0, 2)} />
        )}
      </div>
      {skillNames.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {skillNames.slice(0, 3).map((s) => (
            <span
              key={s}
              className="px-2 py-0.5 rounded-pill text-[11px] bg-[var(--color-cream-2)] border border-[var(--color-line)] text-[var(--color-ink-soft)]"
            >
              {s}
            </span>
          ))}
          {skillNames.length > 3 && (
            <span className="px-2 py-0.5 rounded-pill text-[11px] text-[var(--color-ink-muted)]">
              +{skillNames.length - 3} more
            </span>
          )}
        </div>
      )}
      {photos.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {photos.map((u, i) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={u}
              src={u}
              alt={`Work sample ${i + 1} by ${worker.displayName}`}
              loading="lazy"
              className="w-full h-16 rounded-lg object-cover border border-[var(--color-line)]"
            />
          ))}
        </div>
      )}
      <div className="mt-3 pt-3 border-t border-[var(--color-line)] flex items-center justify-between text-xs text-[var(--color-ink-muted)]">
        <span>
          {worker.jobsCompleted ?? 0} job{(worker.jobsCompleted ?? 0) === 1 ? "" : "s"} done
        </span>
        {typeof km === "number" ? (
          <span className="font-medium text-[var(--color-sage-700)]">
            📍 {formatDistance(km)} away
          </span>
        ) : worker.suburb ? (
          <span>{worker.suburb}</span>
        ) : null}
      </div>
    </Link>
  );
}
