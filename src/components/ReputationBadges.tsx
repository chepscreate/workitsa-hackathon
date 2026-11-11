import type { ReputationBadge } from "@/lib/types";

type Tone = "ochre" | "sage" | "ink" | "stone";

const toneStyles: Record<Tone, string> = {
  ochre:
    "bg-[var(--color-ochre-100)] text-[var(--color-ochre-700)] border-[var(--color-ochre-300)]",
  sage: "bg-[var(--color-sage-100)] text-[var(--color-sage-700)] border-[var(--color-sage-400)]",
  ink: "bg-[var(--color-ink)] text-[var(--color-cream)] border-transparent",
  stone:
    "bg-[var(--color-stone-100)] text-[var(--color-ink-soft)] border-[var(--color-stone-200)]",
};

const ICONS: Record<string, string> = {
  verified: "✓",
  "background-verified": "★",
  "top-rated": "★",
  reliable: "✓",
  "rising-star": "↗",
  "local-hero": "♥",
};

export default function ReputationBadges({
  badges,
  size = "sm",
}: {
  badges: ReputationBadge[];
  size?: "xs" | "sm";
}) {
  if (badges.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((b) => (
        <span
          key={b.id}
          title={b.description}
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill border ${toneStyles[b.tone]} ${
            size === "xs" ? "text-[10px]" : "text-[11px]"
          } font-medium`}
        >
          <span aria-hidden>{ICONS[b.id] ?? "•"}</span>
          {b.short}
        </span>
      ))}
    </div>
  );
}
