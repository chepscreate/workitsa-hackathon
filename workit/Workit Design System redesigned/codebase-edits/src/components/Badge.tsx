import type { ReactNode } from "react";

type Tone = "ochre" | "sage" | "ink" | "brick" | "stone";

const tones: Record<Tone, string> = {
  ochre:
    "bg-[var(--color-ochre-100)] text-[var(--color-ochre-700)] border-[var(--color-ochre-300)]",
  sage: "bg-[var(--color-sage-100)] text-[var(--color-sage-700)] border-[var(--color-sage-400)]",
  ink: "bg-[var(--color-ink)] text-[var(--color-cream)] border-transparent",
  brick:
    "bg-[var(--color-brick-soft)] text-[var(--color-brick)] border-[var(--color-brick)]",
  stone:
    "bg-[var(--color-stone-100)] text-[var(--color-ink-soft)] border-[var(--color-stone-200)]",
};

export default function Badge({
  children,
  tone = "ochre",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      // `whitespace-nowrap` keeps short labels like "Live at launch",
      // "Skilled trades" or "All categories" on a single line when sitting
      // inside a tight flex parent (filter rows, card-header rows, etc).
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-pill text-xs font-medium border whitespace-nowrap ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
