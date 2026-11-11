import type { ReactNode } from "react";

/**
 * Inline-SVG empty-state illustrations + a small layout wrapper.
 * Tonal — uses brand colors via currentColor swaps so they look right
 * in light + dark mode without extra work.
 */

type Kind = "no-jobs" | "no-saved" | "no-messages" | "no-results" | "approved";

function Illustration({ kind }: { kind: Kind }) {
  switch (kind) {
    case "no-jobs":
      return (
        <svg viewBox="0 0 120 100" width="120" height="100" aria-hidden>
          {/* Empty signboard */}
          <line x1="60" y1="70" x2="60" y2="92" stroke="var(--color-ink-soft)" strokeWidth="3" strokeLinecap="round" />
          <rect x="20" y="22" width="80" height="50" rx="6"
            fill="var(--color-cream-2)" stroke="var(--color-ink-soft)" strokeWidth="2" />
          <line x1="32" y1="38" x2="76" y2="38" stroke="var(--color-line)" strokeWidth="3" strokeLinecap="round" />
          <line x1="32" y1="50" x2="60" y2="50" stroke="var(--color-line)" strokeWidth="3" strokeLinecap="round" />
          {/* Sun above */}
          <circle cx="92" cy="18" r="8" fill="var(--color-ochre-300)" />
        </svg>
      );
    case "no-saved":
      return (
        <svg viewBox="0 0 120 100" width="120" height="100" aria-hidden>
          {/* Heart outline */}
          <path
            d="M60 78 C 25 55, 25 30, 45 30 C 55 30, 60 38, 60 38 C 60 38, 65 30, 75 30 C 95 30, 95 55, 60 78 Z"
            fill="none"
            stroke="var(--color-ochre-500)"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {/* Sparkles */}
          <circle cx="22" cy="20" r="2" fill="var(--color-sage-600)" />
          <circle cx="100" cy="20" r="2" fill="var(--color-ochre-500)" />
          <circle cx="98" cy="78" r="2" fill="var(--color-sage-600)" />
        </svg>
      );
    case "no-messages":
      return (
        <svg viewBox="0 0 120 100" width="120" height="100" aria-hidden>
          <path
            d="M25 30 H85 a8 8 0 0 1 8 8 v22 a8 8 0 0 1 -8 8 H45 l-12 12 v-12 h-8 a8 8 0 0 1 -8 -8 v-22 a8 8 0 0 1 8 -8 z"
            fill="var(--color-cream-2)"
            stroke="var(--color-ink-soft)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="42" cy="49" r="3" fill="var(--color-ochre-500)" />
          <circle cx="55" cy="49" r="3" fill="var(--color-ochre-500)" />
          <circle cx="68" cy="49" r="3" fill="var(--color-ochre-500)" />
        </svg>
      );
    case "no-results":
      return (
        <svg viewBox="0 0 120 100" width="120" height="100" aria-hidden>
          <circle cx="50" cy="50" r="22" fill="none"
            stroke="var(--color-ink-soft)" strokeWidth="3" />
          <line x1="68" y1="68" x2="90" y2="90" stroke="var(--color-ochre-500)"
            strokeWidth="5" strokeLinecap="round" />
        </svg>
      );
    case "approved":
      return (
        <svg viewBox="0 0 120 100" width="120" height="100" aria-hidden>
          <circle cx="60" cy="50" r="28" fill="var(--color-sage-100)" />
          <path d="M48 50 L57 60 L74 41" fill="none"
            stroke="var(--color-sage-700)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

export default function EmptyState({
  kind,
  title,
  body,
  action,
}: {
  kind: Kind;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl p-8 sm:p-10 bg-[var(--color-paper)] border border-dashed border-[var(--color-line)] text-center">
      <div className="flex justify-center mb-4">
        <Illustration kind={kind} />
      </div>
      <h3 className="font-display text-xl text-[var(--color-ink)]">{title}</h3>
      {body && (
        <p className="mt-2 text-sm text-[var(--color-ink-soft)] max-w-md mx-auto">
          {body}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
