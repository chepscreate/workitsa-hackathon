import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

// `whitespace-nowrap` prevents button labels with arrows or multi-word strings
// (e.g. "Post a job →", "Sign in", "Finish verification →") from breaking
// across two lines when the parent flex container squeezes them.
const base =
  "inline-flex items-center justify-center gap-2 font-medium rounded-pill transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-px whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--color-ochre-500)] text-[var(--color-cream)] hover:bg-[var(--color-ochre-600)] shadow-soft",
  secondary:
    "bg-[var(--color-ink)] text-[var(--color-cream)] hover:bg-[var(--color-ink-soft)] shadow-soft",
  ghost:
    "bg-transparent text-[var(--color-ink)] hover:bg-[var(--color-cream-2)]",
  outline:
    "bg-transparent text-[var(--color-ink)] border border-[var(--color-line)] hover:bg-[var(--color-cream-2)]",
};

const sizes: Record<Size, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-5 py-2.5 text-[15px]",
  lg: "px-7 py-3.5 text-base",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  className?: string;
};

type AsButton = CommonProps & ComponentProps<"button"> & { href?: undefined };
type AsLink = CommonProps & { href: string } & Omit<
    ComponentProps<typeof Link>,
    "href"
  >;

export default function Button(props: AsButton | AsLink) {
  const {
    variant = "primary",
    size = "md",
    className = "",
    children,
    ...rest
  } = props;
  const cls = `${base} ${variants[variant]} ${sizes[size]} ${className}`;

  if ("href" in rest && rest.href) {
    return (
      <Link className={cls} {...(rest as AsLink)}>
        {children}
      </Link>
    );
  }
  return (
    <button className={cls} {...(rest as AsButton)}>
      {children}
    </button>
  );
}
