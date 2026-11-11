import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

// `whitespace-nowrap` prevents button labels with arrows or multi-word strings
// (e.g. "Post a job →", "Sign in", "Finish verification →") from breaking
// across two lines when the parent flex container squeezes them.
const base =
  "inline-flex items-center justify-center gap-2 font-medium rounded-pill transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-px active:scale-[0.98] whitespace-nowrap";

const variants: Record<Variant, string> = {
  // Soft top-to-bottom gradient + a hover lift make the primary action feel
  // pressed-from-clay rather than flat. brightness on hover keeps the gradient.
  primary:
    "bg-[linear-gradient(180deg,var(--color-ochre-500)_0%,var(--color-ochre-600)_100%)] text-[var(--color-cream)] hover:brightness-105 hover:-translate-y-0.5 shadow-soft hover:shadow-lift",
  secondary:
    "bg-[var(--color-ink)] text-[var(--color-cream)] hover:bg-[var(--color-ink-soft)] hover:-translate-y-0.5 shadow-soft hover:shadow-lift",
  ghost:
    "bg-transparent text-[var(--color-ink)] hover:bg-[var(--color-cream-2)]",
  outline:
    "bg-transparent text-[var(--color-ink)] border border-[var(--color-line)] hover:bg-[var(--color-cream-2)] hover:border-[var(--color-ochre-300)]",
  danger:
    "bg-[var(--color-brick-solid)] text-white hover:opacity-90 hover:-translate-y-0.5 shadow-soft hover:shadow-lift",
};

const sizes: Record<Size, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-5 py-2.5 text-[15px]",
  lg: "px-7 py-3.5 text-base",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner, disables interaction, and (optionally) swaps the label. */
  loading?: boolean;
  /** Label to show while `loading` (e.g. "Saving…"). Defaults to `children`. */
  loadingText?: ReactNode;
  children: ReactNode;
  className?: string;
};

type AsButton = CommonProps & ComponentProps<"button"> & { href?: undefined };
type AsLink = CommonProps & { href: string } & Omit<
    ComponentProps<typeof Link>,
    "href"
  >;

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block w-[1.05em] h-[1.05em] rounded-full border-2 border-current border-r-transparent animate-spin"
    />
  );
}

export default function Button(props: AsButton | AsLink) {
  const {
    variant = "primary",
    size = "md",
    loading = false,
    loadingText,
    className = "",
    children,
    ...rest
  } = props;
  // Keep loading buttons crisp (not dimmed by disabled:opacity-50) and show a
  // wait cursor; `!` overrides the base disabled styles.
  const loadingCls = loading ? "!opacity-100 !cursor-wait" : "";
  const content = (
    <>
      {loading && <Spinner />}
      {loading ? loadingText ?? children : children}
    </>
  );

  if ("href" in rest && rest.href) {
    const cls = `${base} ${variants[variant]} ${sizes[size]} ${loading ? `${loadingCls} pointer-events-none` : ""} ${className}`;
    return (
      <Link className={cls} aria-busy={loading || undefined} {...(rest as AsLink)}>
        {content}
      </Link>
    );
  }

  const { disabled, ...btnRest } = rest as AsButton;
  const cls = `${base} ${variants[variant]} ${sizes[size]} ${loadingCls} ${className}`;
  return (
    <button
      className={cls}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...btnRest}
    >
      {content}
    </button>
  );
}
