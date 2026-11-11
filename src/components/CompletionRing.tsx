"use client";

/**
 * Small SVG progress ring showing profile completion %.
 */
export default function CompletionRing({
  pct,
  size = 48,
}: {
  pct: number;
  size?: number;
}) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, pct)) / 100) * c;
  const colour =
    pct >= 90
      ? "var(--color-sage-600)"
      : pct >= 60
        ? "var(--color-ochre-500)"
        : "var(--color-brick)";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colour}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
      </svg>
      <span className="absolute font-display text-xs font-semibold text-[var(--color-ink)]">
        {pct}%
      </span>
    </div>
  );
}
