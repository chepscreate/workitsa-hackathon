/**
 * Concept 2 — Two Hands, One Tool
 * Stylized handshake gripping a hammer handle. Direct visual metaphor
 * for the marketplace: employer + worker meeting on a job.
 */
export default function HandshakeToolMark({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Background warm circle */}
      <circle cx="32" cy="32" r="30" fill="var(--color-cream-2)" />

      {/* Hammer head — ink */}
      <rect
        x="20"
        y="14"
        width="24"
        height="10"
        rx="2"
        fill="var(--color-ink)"
      />

      {/* Hammer handle — ochre */}
      <rect
        x="29"
        y="22"
        width="6"
        height="26"
        rx="2"
        fill="var(--color-ochre-500)"
      />

      {/* Left hand — abstracted, gripping handle */}
      <path
        d="M 14 38
           Q 14 32, 20 32
           L 30 32
           Q 30 38, 24 40
           Q 18 42, 14 40 Z"
        fill="var(--color-sage-400)"
        stroke="var(--color-sage-700)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Right hand — abstracted, opposite grip */}
      <path
        d="M 50 38
           Q 50 32, 44 32
           L 34 32
           Q 34 38, 40 40
           Q 46 42, 50 40 Z"
        fill="var(--color-ochre-300)"
        stroke="var(--color-ochre-700)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Ground line */}
      <path
        d="M 10 54 Q 32 58 54 54"
        stroke="var(--color-ink-soft)"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
    </svg>
  );
}
