import type { ReactNode } from "react";
import Badge from "./Badge";

type Tone = "ochre" | "sage" | "ink" | "brick" | "stone";

/**
 * Shared page header for content / info pages.
 *
 * Gives every top-level page the same recognizable opening: a small "beadwork"
 * rule (three brand dots + a hairline), an eyebrow badge, the serif title, an
 * optional meta line, and an intro. A soft ochre glow sits behind the title so
 * the header has depth without a heavy gradient band on every page.
 */
export default function PageHero({
  eyebrow,
  eyebrowTone = "ink",
  title,
  meta,
  intro,
  children,
}: {
  eyebrow: string;
  eyebrowTone?: Tone;
  title: ReactNode;
  /** Small uppercase line under the title, e.g. "Last updated · May 2026". */
  meta?: string;
  /** Lead paragraph under the title. */
  intro?: ReactNode;
  /** Anything that should sit directly under the intro (CTAs, etc). */
  children?: ReactNode;
}) {
  return (
    // data-reveal: above the fold, so this fires immediately on load — a
    // consistent soft entrance for every page that opens with a PageHero.
    <header className="relative" data-reveal>
      {/* Warm glow accents — depth behind the title, kept subtle. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-12 -right-6 h-44 w-44 rounded-full bg-[var(--color-ochre-300)] opacity-20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-6 left-1/4 h-32 w-32 rounded-full bg-[var(--color-sage-400)] opacity-[0.12] blur-3xl"
      />

      {/* Beadwork rule — the same motif used on the deck + brand marks. */}
      <div className="flex items-center gap-1.5 mb-4">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-ochre-500)]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-sage-600)]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-ochre-300)]" />
        <span className="ml-1 h-px w-12 bg-[var(--color-line)]" />
      </div>

      <Badge tone={eyebrowTone}>{eyebrow}</Badge>
      <h1 className="mt-4 font-display text-4xl sm:text-5xl tracking-tight">
        {title}
      </h1>
      {meta && (
        <p className="mt-2 text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
          {meta}
        </p>
      )}
      {intro && (
        <p className="mt-3 text-[var(--color-ink-soft)] max-w-2xl leading-relaxed">
          {intro}
        </p>
      )}
      {children}
    </header>
  );
}
