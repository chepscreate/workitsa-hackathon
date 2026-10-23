/**
 * Concept 4 — Sunrise & Acacia
 * Minimalist acacia silhouette against a rising ochre sun.
 * Most explicitly South African. Risk: leans tourism-brand.
 */
export default function AcaciaSunMark({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Half-circle rising sun */}
      <path
        d="M 6 48 A 26 26 0 0 1 58 48 Z"
        fill="var(--color-ochre-500)"
      />

      {/* Acacia tree silhouette — trunk + flat-top canopy */}
      <g fill="var(--color-ink)">
        {/* Trunk */}
        <path
          d="M 32 30
             L 33 48
             L 31 48 Z"
        />
        {/* Branches splaying out */}
        <path
          d="M 32 30
             L 24 22
             M 32 30
             L 40 22
             M 32 30
             L 22 26
             M 32 30
             L 42 26"
          stroke="var(--color-ink)"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        {/* Flat-top canopy — wide, slightly umbrella-shaped */}
        <path
          d="M 18 24
             Q 18 18, 26 17
             Q 32 14, 38 17
             Q 46 18, 46 24
             Q 44 26, 32 25
             Q 20 26, 18 24 Z"
        />
      </g>

      {/* Ground line — sage, very subtle */}
      <line
        x1="6"
        y1="48"
        x2="58"
        y2="48"
        stroke="var(--color-sage-700)"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* A small bird in the sky for personality (only visible above ~32px) */}
      <path
        d="M 12 16 Q 14 14 16 16 Q 18 14 20 16"
        stroke="var(--color-ink-soft)"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  );
}
