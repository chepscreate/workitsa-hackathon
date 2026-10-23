/**
 * Concept 3 — W Stamp (final, mono)
 * Bold W set in an ink stamp. The final upstroke ends in a vertical 't' stem
 * with a crossbar — so the mark reads as "Wt" (Workit shorthand).
 * Black + white only. Inverts cleanly on light or dark backgrounds.
 */
export default function WStampMark({
  size = 48,
  invert = false,
}: {
  size?: number;
  /** Set true on a light background — renders white on black. Default = black on white (best on cream). */
  invert?: boolean;
}) {
  const bg = invert ? "var(--color-cream)" : "var(--color-ink)";
  const fg = invert ? "var(--color-ink)" : "var(--color-cream)";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Stamp / seal */}
      <rect x="6" y="6" width="52" height="52" rx="14" fill={bg} />
      {/* Inner hairline for the "stamped" feel */}
      <rect
        x="9"
        y="9"
        width="46"
        height="46"
        rx="11"
        fill="none"
        stroke={fg}
        strokeWidth="1.5"
        opacity="0.55"
      />

      {/* W — bold strokes that meet cleanly */}
      <path
        d="M 14 19
           L 21 47
           L 28 30
           L 36 47
           L 43 30
           Q 47 22, 50 19
           L 50 50"
        stroke={fg}
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Crossbar — turns the final stem into a 't' */}
      <line
        x1="43"
        y1="22"
        x2="57"
        y2="22"
        stroke={fg}
        strokeWidth="4.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
