/* Hand-drawn underline scribble — used to accent a keyword in a heading. */
export default function Underline({
  color = "var(--color-ochre-500)",
  className = "",
}: {
  color?: string;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 220 14"
      preserveAspectRatio="none"
      className={`absolute left-0 right-0 -bottom-2 w-full h-3 ${className}`}
    >
      <path
        d="M2 9 C 40 2, 90 12, 140 6 S 210 4, 218 8"
        fill="none"
        stroke={color}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
