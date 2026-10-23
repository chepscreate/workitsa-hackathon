import WStampMark from "./logos/WStampMark";

type Props = {
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
  /** Use on dark surfaces — flips to a white wordmark + white-on-black stamp */
  onDark?: boolean;
};

const sizes = {
  sm: { mark: 30, text: "text-xl" },
  md: { mark: 40, text: "text-2xl" },
  lg: { mark: 52, text: "text-3xl" },
} as const;

export default function Logo({ size = "md", showTagline = false, onDark = false }: Props) {
  const s = sizes[size];
  const textColor = onDark ? "var(--color-cream)" : "var(--color-ink)";
  const taglineColor = onDark ? "rgba(250,244,236,0.65)" : "var(--color-ink-muted)";

  return (
    <div className="inline-flex items-center gap-2.5 select-none">
      <WStampMark size={s.mark} invert={onDark} />
      <div className="flex flex-col leading-none">
        <span
          className={`font-display font-semibold tracking-tight ${s.text}`}
          style={{ color: textColor }}
        >
          Workit
        </span>
        {showTagline && (
          <span
            // `whitespace-nowrap` keeps "WORK IT · EARN IT" on one line in
            // the footer column even when the footer-grid squeezes its cells.
            className="text-[11px] uppercase tracking-[0.18em] mt-1 whitespace-nowrap"
            style={{ color: taglineColor }}
          >
            Work it · Earn it
          </span>
        )}
      </div>
    </div>
  );
}
