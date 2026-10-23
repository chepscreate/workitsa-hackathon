"use client";

/**
 * PostJobShell — layout wrapper for the post-a-job form.
 *
 * Splits the page into a 2-column desktop layout: form on the left,
 * sticky live-preview card on the right. On narrow viewports it stacks.
 *
 * Usage in `src/app/post-a-job/page.tsx`:
 *
 *   import PostJobShell, { JobPreviewCard } from "@/components/PostJobShell";
 *
 *   return (
 *     <PostJobShell
 *       preview={
 *         <JobPreviewCard
 *           title={title}
 *           categoryLabel={categoryLabel}
 *           description={description}
 *           suburb={suburb}
 *           city={city}
 *           price={suggestedPrice}
 *           urgent={urgent}
 *           employerName={profile?.displayName}
 *           employerPhotoURL={profile?.photoURL}
 *         />
 *       }
 *     >
 *       {/* your existing form JSX *\/}
 *     </PostJobShell>
 *   );
 *
 * The shell renders Header + Footer + Container internally, so you can
 * drop your form fields straight inside without re-wrapping.
 */

import { ReactNode } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import Badge from "@/components/Badge";
import Avatar from "@/components/Avatar";
import { useTranslation } from "@/contexts/LocaleContext";

export default function PostJobShell({
  children,
  preview,
  backHref = "/account",
  backLabel,
  rebookId,
}: {
  children: ReactNode;
  preview: ReactNode;
  backHref?: string;
  backLabel?: string;
  rebookId?: string | null;
}) {
  const { t } = useTranslation();
  return (
    <>
      <Header />
      <main className="flex-1">
        <Container className="py-10 lg:py-14">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] whitespace-nowrap"
          >
            <span className="text-base">←</span> {backLabel ?? t("postJob.shell.back")}
          </Link>

          <div data-reveal>
            <h1 className="mt-4 font-display text-4xl sm:text-5xl tracking-tight">
              {rebookId ? t("postJob.shell.titleRebook") : t("postJob.shell.titlePost")}
            </h1>
            <p className="mt-3 text-lg text-[var(--color-ink-soft)] max-w-xl">
              {t("postJob.shell.intro")}
            </p>
          </div>

          <div className="mt-10 grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-8 items-start">
            {/* LEFT — form */}
            <div className="min-w-0">
              {children}
            </div>

            {/* RIGHT — sticky live preview */}
            <aside className="lg:sticky lg:top-32">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)] font-medium mb-3">
                {t("postJob.shell.livePreview")}
              </p>
              {preview}
              <p className="mt-3 text-xs text-[var(--color-ink-muted)] leading-relaxed">
                {t("postJob.shell.previewNote")}
              </p>
            </aside>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}

/**
 * JobPreviewCard — the live-updating job card shown in the right column.
 * Mirrors the production JobCard chrome (badges, location, price, employer
 * avatar) but reads from form state instead of a Firestore doc.
 */
export function JobPreviewCard({
  title,
  categoryLabel,
  subcategoryLabel,
  description,
  suburb,
  city,
  price,
  urgent,
  employerName,
  employerPhotoURL,
}: {
  title?: string;
  categoryLabel?: string;
  subcategoryLabel?: string;
  description?: string;
  suburb?: string;
  city?: string;
  price?: string | number;
  urgent?: boolean;
  employerName?: string;
  employerPhotoURL?: string;
}) {
  return (
    <div className="relative rounded-xl bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft p-5">
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {urgent && (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-pill text-xs font-medium border bg-[var(--color-brick-soft)] text-[var(--color-brick)] border-[var(--color-brick)] whitespace-nowrap">
            <span aria-hidden>🔥</span>
            Urgent
          </span>
        )}
        {categoryLabel && <Badge tone="ochre">{categoryLabel}</Badge>}
        {subcategoryLabel && <Badge tone="sage">{subcategoryLabel}</Badge>}
      </div>

      <h3 className="font-display text-xl leading-snug">
        {title || <span className="text-[var(--color-ink-muted)]">Untitled job</span>}
      </h3>

      {(suburb || city) && (
        <p className="mt-1 text-xs text-[var(--color-sage-700)] font-medium">
          📍 {suburb || "Suburb"}, {city || "City"}
        </p>
      )}

      <p className="mt-2 text-sm text-[var(--color-ink-soft)] line-clamp-3 leading-relaxed">
        {description || (
          <span className="text-[var(--color-ink-muted)]">
            Add a description workers can scan in under 30 seconds…
          </span>
        )}
      </p>

      <div className="mt-4 pt-3 border-t border-[var(--color-line)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar name={employerName} photoURL={employerPhotoURL} size="xs" />
          <span className="text-xs text-[var(--color-ink-muted)] truncate">
            {employerName ?? "You"}
          </span>
        </div>
        <span className="font-display text-xl text-[var(--color-ochre-600)] whitespace-nowrap">
          R {price || "—"}
        </span>
      </div>
    </div>
  );
}
