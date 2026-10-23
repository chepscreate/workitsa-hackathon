"use client";

/**
 * JobDetailLayout — design upgrade for the single-job detail view.
 *
 * The production `src/app/jobs/page.tsx` is ~1500 lines of state +
 * Firestore subscriptions + dispute/chat/rating flows — far too big to
 * replace whole-hog. Instead this is a *visual shell* you can wrap
 * around your existing JobDetailInner render tree.
 *
 * It gives you:
 *  - Sticky 2-column desktop layout
 *  - LEFT slot: job header + photos + description + specs (you pass
 *    the body in via children, or use the helper sub-components)
 *  - RIGHT slot: sticky price-action card + employer card + safety
 *    reminder (all driven by props)
 *
 * Usage in src/app/jobs/page.tsx, replace the wrapper layout around the
 * existing JobDetailInner with:
 *
 *   <JobDetailLayout
 *     job={job}
 *     viewer={profile}
 *     priceAction={<YourExistingAcceptOfferButtonGroup />}
 *     employer={{
 *       name: job.employerName,
 *       photoURL: job.employerPhotoURL,
 *       rating: employerProfile?.ratingAvg,
 *       jobsPosted: employerProfile?.jobsCompleted,
 *       joined: formatJoined(employerProfile?.createdAt),
 *     }}
 *   >
 *     <JobDetailHeader job={job} />
 *     <JobDetailPhotos urls={job.photoURLs} />
 *     <JobDetailDescription job={job} />
 *     <JobDetailSpecs job={job} />
 *     { /* your existing offers list / chat / actions *\/ }
 *   </JobDetailLayout>
 */

import { ReactNode } from "react";
import Link from "next/link";
import Badge from "@/components/Badge";
import Avatar from "@/components/Avatar";
import {
  CATEGORIES,
  SUBCATEGORIES,
  findPaymentLabel,
  type Job,
} from "@/lib/types";

function categoryLabel(id: string) {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}
function subcategoryLabel(catId: string, subId?: string) {
  if (!subId) return undefined;
  return SUBCATEGORIES[catId as keyof typeof SUBCATEGORIES]?.find(
    (s) => s.id === subId,
  )?.label;
}

export default function JobDetailLayout({
  children,
  priceAction,
  employer,
  job,
}: {
  children: ReactNode;
  /** Action JSX for the sticky right card (Accept / counter-offer / etc).
      Pass `null` to omit — the price card stays but no action row is shown. */
  priceAction?: ReactNode;
  employer: {
    name: string;
    photoURL?: string;
    rating?: number;
    jobsPosted?: number;
    joined?: string;
  };
  job: Pick<Job, "suggestedPrice" | "paymentMethod">;
}) {
  return (
    <div className="grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-8 items-start">
      {/* LEFT — the job */}
      <div className="min-w-0 space-y-6">{children}</div>

      {/* RIGHT — sticky action + employer */}
      <aside className="lg:sticky lg:top-32 space-y-4">
        <div className="rounded-2xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)] font-medium">
            Suggested price
          </p>
          <p className="mt-2 font-display text-4xl text-[var(--color-ochre-600)] leading-none">
            R {job.suggestedPrice}
          </p>
          {job.paymentMethod && (
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              {findPaymentLabel(job.paymentMethod)}
            </p>
          )}
          {/* Only render the action slot when there's actually something
              to put in it — keeps the card tight when the parent is still
              loading state or has no relevant CTA for this viewer. */}
          {priceAction && <div className="mt-5 flex flex-col gap-2.5">{priceAction}</div>}
        </div>

        <div className="rounded-2xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)] font-medium">
            Posted by
          </p>
          <div className="mt-3 flex items-center gap-3">
            <Avatar name={employer.name} photoURL={employer.photoURL} size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{employer.name}</p>
              {(employer.rating != null || employer.jobsPosted != null) && (
                <p className="text-xs text-[var(--color-ink-muted)] mt-0.5">
                  {employer.rating != null && (
                    <>★ {employer.rating.toFixed(1)}</>
                  )}
                  {employer.rating != null && employer.jobsPosted != null && " · "}
                  {employer.jobsPosted != null && (
                    <>{employer.jobsPosted} jobs posted</>
                  )}
                </p>
              )}
            </div>
          </div>
          {employer.joined && (
            <>
              <hr className="my-4 border-[var(--color-line)]" />
              <p className="text-xs text-[var(--color-ink-soft)] leading-relaxed">
                On Workit since{" "}
                <span className="text-[var(--color-ink)]">{employer.joined}</span>.
                Reviews from past workers are visible after you submit an offer.
              </p>
            </>
          )}
        </div>

        <div className="rounded-2xl p-4 bg-[var(--color-cream-2)] border border-[var(--color-line)] flex gap-3 text-sm text-[var(--color-ink-soft)]">
          <span className="text-xl shrink-0">🛡</span>
          <div>
            <p className="font-medium text-[var(--color-ink)]">Safety reminder</p>
            <p className="mt-1 text-xs leading-relaxed">
              Share your live location with a family member when you arrive.
              Use the SAPS emergency button if anything feels off.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

/** Job title + badges + location + posted-time row. Drop above the photos. */
export function JobDetailHeader({
  job,
  postedRelative,
  backHref = "/find-work",
  backLabel = "Back to feed",
}: {
  job: Pick<
    Job,
    "title" | "category" | "subcategory" | "urgent" | "suburb" | "city" | "createdAt"
  >;
  postedRelative?: string;
  backHref?: string;
  backLabel?: string;
}) {
  const subLabel = subcategoryLabel(job.category, job.subcategory);
  return (
    <div>
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] whitespace-nowrap"
      >
        <span className="text-base">←</span> {backLabel}
      </Link>
      <div className="mt-4 flex items-center gap-2 flex-wrap">
        {job.urgent && (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-pill text-xs font-medium border bg-[var(--color-brick-soft)] text-[var(--color-brick)] border-[var(--color-brick)] whitespace-nowrap">
            <span aria-hidden>🔥</span>
            Urgent
          </span>
        )}
        <Badge tone="ochre">{categoryLabel(job.category)}</Badge>
        {subLabel && <Badge tone="sage">{subLabel}</Badge>}
        {postedRelative && (
          <span className="text-xs text-[var(--color-ink-muted)] ml-auto whitespace-nowrap">
            Posted {postedRelative}
          </span>
        )}
      </div>
      <h1 className="mt-4 font-display text-3xl sm:text-4xl tracking-tight leading-tight">
        {job.title}
      </h1>
      <p className="mt-2 text-sm text-[var(--color-sage-700)] font-medium">
        📍 {job.suburb}, {job.city}
      </p>
    </div>
  );
}

/** Photo strip — large featured + small thumb. Pass through PhotoGrid for production. */
export function JobDetailPhotos({ urls = [] }: { urls?: string[] }) {
  if (urls.length === 0) return null;
  return (
    <div className="grid grid-cols-3 gap-2.5 h-72">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={urls[0]}
        alt=""
        className="col-span-2 w-full h-full object-cover rounded-2xl"
      />
      {urls[1] && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={urls[1]} alt="" className="w-full h-full object-cover rounded-2xl" />
      )}
      {!urls[1] && (
        <div className="rounded-2xl bg-[var(--color-cream-2)] border border-[var(--color-line)]" />
      )}
    </div>
  );
}

/** Description block. */
export function JobDetailDescription({
  job,
}: {
  job: Pick<Job, "description">;
}) {
  if (!job.description) return null;
  return (
    <div>
      <h2 className="font-display text-2xl">About this job</h2>
      <p className="mt-2 text-[var(--color-ink-soft)] leading-relaxed whitespace-pre-wrap">
        {job.description}
      </p>
    </div>
  );
}

/** Specs grid — payment / tools / experience / estimated time. */
export function JobDetailSpecs({ job }: { job: Pick<Job, "paymentMethod" | "toolsProvided" | "experienceLevel" | "estimatedHours" | "estimatedUnit"> }) {
  const toolsMap = {
    employer: "Employer provides",
    worker: "Worker brings own",
    shared: "Some of each",
    na: "No tools needed",
  } as const;
  const expMap = {
    any: "Open to anyone",
    some: "Some experience",
    experienced: "Experienced only",
  } as const;

  const specs: { icon: string; label: string; value?: string }[] = [
    { icon: "💳", label: "Payment", value: findPaymentLabel(job.paymentMethod) },
    { icon: "🔧", label: "Tools", value: job.toolsProvided ? toolsMap[job.toolsProvided] : undefined },
    { icon: "⭐", label: "Experience", value: job.experienceLevel ? expMap[job.experienceLevel] : undefined },
    {
      icon: "⏱",
      label: "Estimated",
      value: job.estimatedHours ? `${job.estimatedHours} ${job.estimatedUnit ?? "hours"}` : undefined,
    },
  ].filter((s) => s.value);

  if (specs.length === 0) return null;

  return (
    <div className="grid sm:grid-cols-2 gap-2.5">
      {specs.map((s) => (
        <div
          key={s.label}
          className="p-4 rounded-xl bg-[var(--color-paper)] border border-[var(--color-line)] flex items-center gap-3"
        >
          <span className="text-xl">{s.icon}</span>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)] font-medium">
              {s.label}
            </p>
            <p className="mt-0.5 text-sm">{s.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
