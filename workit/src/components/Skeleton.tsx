export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse rounded bg-[var(--color-cream-2)] ${className}`}
    />
  );
}

export function JobCardSkeleton() {
  return (
    <div className="rounded-xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)]">
      <Skeleton className="h-5 w-24 mb-3" />
      <Skeleton className="h-6 w-3/4 mb-2" />
      <Skeleton className="h-4 w-full mb-1" />
      <Skeleton className="h-4 w-2/3 mb-4" />
      <div className="flex justify-between items-center">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-6 w-16" />
      </div>
    </div>
  );
}

/** Full-page placeholder for the job detail while the doc streams in —
 *  mirrors the real layout (title header → detail card → activity card) so
 *  the page doesn't blank-then-pop on slow connections. */
export function JobDetailSkeleton() {
  return (
    <div aria-hidden>
      <Skeleton className="h-5 w-28 mb-4" />
      <Skeleton className="h-9 w-3/4 mb-2" />
      <Skeleton className="h-4 w-40 mb-6" />
      <div className="rounded-2xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)] mb-6">
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-2/3 mb-5" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      <div className="rounded-2xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)]">
        <Skeleton className="h-5 w-36 mb-4" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

/** Placeholder for a public profile (avatar + name + badges + bio card). */
export function ProfileSkeleton() {
  return (
    <div aria-hidden>
      <div className="flex items-start gap-4 mb-6">
        <span className="block w-20 h-20 rounded-full animate-pulse bg-[var(--color-cream-2)]" />
        <div className="flex-1 pt-2">
          <Skeleton className="h-7 w-48 mb-2" />
          <Skeleton className="h-4 w-32 mb-3" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
      </div>
      <div className="rounded-2xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)]">
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/5" />
      </div>
    </div>
  );
}

/** Generic page placeholder (heading + two content cards) for pages whose
 *  layout varies — beats a bare "Loading…" line on slow connections. */
export function PageSkeleton() {
  return (
    <div aria-hidden>
      <Skeleton className="h-8 w-56 mb-2" />
      <Skeleton className="h-4 w-72 mb-6" />
      <div className="rounded-2xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)] mb-4">
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="rounded-2xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)]">
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

export function JobCardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <JobCardSkeleton key={i} />
      ))}
    </div>
  );
}
