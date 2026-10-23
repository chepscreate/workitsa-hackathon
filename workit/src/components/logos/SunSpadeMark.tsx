/**
 * Concept 1 — Sun & Spade
 * Bold ochre sun-disc, sage horizon, single confident spade silhouette
 * cutting across the sun. Hand-drawn imperfections, no extra clutter.
 * Reads at 16px (favicon). Carries SA earth/sun vibe.
 */
export default function SunSpadeMark({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Sun disc — slightly off-perfect for hand-drawn feel */}
      <circle cx="32" cy="29" r="22" fill="var(--color-ochre-500)" />

      {/* A few short rays — subtle, top half only */}
      <g stroke="var(--color-ochre-500)" strokeWidth="2.5" strokeLinecap="round" opacity="0.7">
        <line x1="32" y1="3" x2="32" y2="7" />
        <line x1="13" y1="11" x2="16" y2="14" />
        <line x1="51" y1="11" x2="48" y2="14" />
        <line x1="3" y1="29" x2="7" y2="29" />
        <line x1="57" y1="29" x2="61" y2="29" />
      </g>

      {/* Spade — single shape cutting across the sun */}
      <path
        d="M32 14
           C 24 18, 22 27, 32 32
           C 42 27, 40 18, 32 14 Z
           M 31 32 L 31 50
           L 33 50 L 33 32 Z"
        fill="var(--color-cream)"
        stroke="var(--color-ink)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Earth horizon — sage curve under the sun */}
      <path
        d="M 6 52 Q 32 58 58 52"
        stroke="var(--color-sage-600)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
