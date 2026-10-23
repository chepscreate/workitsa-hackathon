import Link from "next/link";
import Badge from "./Badge";
import Avatar from "./Avatar";
import { CATEGORIES, crewProgress, isBoosted, isCrewJob, type Job } from "@/lib/types";
import { formatDistance } from "@/lib/geo";
import { isStale } from "@/lib/jobs";

function categoryLabel(id: string) {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export default function JobCard({
  job,
  distanceKm,
  saved,
  onToggleSave,
  viewerUid,
}: {
  job: Job;
  distanceKm?: number;
  saved?: boolean;
  onToggleSave?: () => void;
  /** When set + the viewer's UID is in invitedWorkerIds, show a "★ Invited" badge. */
  viewerUid?: string;
}) {
  const wasInvited = !!viewerUid && job.invitedWorkerIds?.includes(viewerUid);
  const thumb = job.photoURLs?.[0];
  const workerPhotos = (job.offerWorkerPhotos ?? []).slice(0, 4);
  const offerCount = job.offerCount ?? 0;
  const moreWorkers = Math.max(0, offerCount - workerPhotos.length);

  return (
    <div className="group relative rounded-xl overflow-hidden bg-[var(--color-paper)] border border-[var(--color-line)] hover:shadow-lift hover:-translate-y-1 hover:border-[var(--color-ochre-300)] transition-all duration-300">
      <Link href={`/jobs?id=${job.id}`} className="block">
        {thumb && (
          <div className="h-40 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumb}
              alt={`Photo for ${job.title}`}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        )}
        <div className="p-6">
          {/* Badges row — wraps freely, with right padding so the heart button
              (absolute top-right) doesn't overlap. Location moved to its own
              line below the title to stop it being squashed by the chips. */}
          <div className="flex flex-wrap items-center gap-1.5 mb-3 pr-12">
            {isBoosted(job) && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-pill text-xs font-medium bg-[var(--color-ochre-600)] text-[var(--color-cream)]">
                <span aria-hidden>✦</span>
                Boosted
              </span>
            )}
            {wasInvited && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-pill text-xs font-medium bg-[var(--color-ochre-500)] text-[var(--color-cream)]">
                <span aria-hidden>★</span>
                Invited
              </span>
            )}
            {job.urgent && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-pill text-xs font-medium border bg-[var(--color-brick-soft)] text-[var(--color-brick)] border-[var(--color-brick)]">
                <span aria-hidden>🔥</span>
                Urgent
              </span>
            )}
            <Badge tone="ochre">{categoryLabel(job.category)}</Badge>
            {isStale(job) && <Badge tone="stone">Stale</Badge>}
            {job.moderationStatus === "pending_review" && (
              <span
                className="inline-flex items-center gap-1 px-3 py-1 rounded-pill text-xs font-medium border bg-[var(--color-ochre-50)] text-[var(--color-ochre-700)] border-[var(--color-ochre-300)]"
                title="Workit reviews new posts before they go public. Yours is in the queue — usually cleared within a few hours."
              >
                <span aria-hidden>⏳</span>
                Under review
              </span>
            )}
            {job.moderationStatus === "removed" && (
              <Badge tone="brick">Removed</Badge>
            )}
            {isCrewJob(job) && (() => {
              const { filled, needed, remaining } = crewProgress(job);
              return (
                <span
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-pill text-xs font-medium border bg-[var(--color-sage-100)]/40 text-[var(--color-sage-700)] border-[var(--color-sage-400)]/50"
                  title={`${filled} of ${needed} workers hired, ${remaining} still needed`}
                >
                  <span aria-hidden>👥</span>
                  Crew · {filled}/{needed}
                </span>
              );
            })()}
          </div>
          <h3 className="font-display text-xl leading-snug">{job.title}</h3>
          <p className="mt-1 text-xs text-[var(--color-ink-muted)] truncate">
            {typeof distanceKm === "number" ? (
              <span className="inline-flex items-center gap-1 text-[var(--color-sage-700)] font-medium">
                <span aria-hidden>📍</span>
                {formatDistance(distanceKm)} away · {job.suburb}, {job.city}
              </span>
            ) : (
              <>
                <span aria-hidden>📍</span> {job.suburb}, {job.city}
              </>
            )}
          </p>
          {typeof job.dueAt === "number" && (() => {
            const now = Date.now();
            const overdue = job.dueAt < now;
            const within24h = !overdue && job.dueAt - now < 24 * 60 * 60 * 1000;
            const dueDate = new Date(job.dueAt);
            const label = dueDate.toLocaleString("en-ZA", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <p
                className={`mt-2 text-xs font-medium flex items-center gap-1 ${
                  overdue
                    ? "text-[var(--color-brick)]"
                    : within24h
                      ? "text-[var(--color-ochre-700)]"
                      : "text-[var(--color-ink-muted)]"
                }`}
              >
                <span aria-hidden>⏰</span>
                {overdue ? "Overdue · was due " : "Due by "}
                {label}
              </p>
            );
          })()}
          <p className="mt-2 text-sm text-[var(--color-ink-soft)] line-clamp-3">
            {job.description}
          </p>

          {/* Footer: employer + price + worker stack */}
          <div className="mt-4 pt-4 border-t border-[var(--color-line)] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Avatar
                name={job.employerName}
                photoURL={job.employerPhotoURL}
                size="xs"
              />
              <span className="text-xs text-[var(--color-ink-muted)] truncate">
                {job.employerName}
              </span>
            </div>
            <span className="font-display text-xl text-[var(--color-ochre-600)] flex-shrink-0">
              R {job.suggestedPrice}
            </span>
          </div>

          {/* Worker offers stack (social proof) */}
          {offerCount > 0 && (
            <div className="mt-3 flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
              <div className="flex -space-x-2">
                {workerPhotos.length > 0 ? (
                  workerPhotos.map((url, i) => (
                    <div
                      key={url + i}
                      className="w-6 h-6 rounded-full ring-2 ring-[var(--color-paper)] overflow-hidden bg-[var(--color-cream-2)]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt="Worker who offered"
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ))
                ) : (
                  // No photos collected yet (older job or workers w/o avatars) — show generic dot
                  <div className="w-6 h-6 rounded-full ring-2 ring-[var(--color-paper)] bg-[var(--color-sage-400)]" />
                )}
                {moreWorkers > 0 && (
                  <div className="w-6 h-6 rounded-full ring-2 ring-[var(--color-paper)] bg-[var(--color-ink)] text-[var(--color-cream)] text-[10px] font-semibold flex items-center justify-center">
                    +{moreWorkers}
                  </div>
                )}
              </div>
              <span>
                {offerCount} {offerCount === 1 ? "worker has" : "workers have"} offered
              </span>
            </div>
          )}
        </div>
      </Link>

      {/* Save / heart button */}
      {onToggleSave && (
        <button
          type="button"
          aria-label={saved ? "Unsave job" : "Save job"}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleSave();
          }}
          className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-lg transition-all ${
            saved
              ? "bg-[var(--color-ochre-500)] text-[var(--color-cream)] shadow-soft"
              : thumb
                ? "bg-black/30 text-white backdrop-blur-md hover:bg-black/50"
                : "bg-[var(--color-paper)]/90 text-[var(--color-ink-muted)] border border-[var(--color-line)] shadow-soft hover:text-[var(--color-brick)] hover:border-[var(--color-brick)]/40"
          }`}
        >
          {saved ? "♥" : "♡"}
        </button>
      )}
    </div>
  );
}
