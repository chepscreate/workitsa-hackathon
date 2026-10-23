import type { ComponentProps, ReactNode } from "react";

type Props = ComponentProps<"input"> & {
  label: string;
  hint?: ReactNode;
  error?: string;
};

export default function Input({
  label,
  hint,
  error,
  className = "",
  id,
  ...rest
}: Props) {
  const inputId = id ?? rest.name ?? label.toLowerCase().replace(/\s+/g, "-");
  // A visible focus ring (not just a border-colour nudge) is an accessibility
  // requirement — `focus:outline-none` alone fails WCAG 2.4.7. Error state gets
  // its own brick border + ring so the field itself signals the problem.
  const state = error
    ? "border-[var(--color-brick)] focus:border-[var(--color-brick)] focus:ring-[var(--color-brick-soft)]"
    : "border-[var(--color-line)] focus:border-[var(--color-ochre-500)] focus:ring-[var(--color-ochre-300)]";
  return (
    <label htmlFor={inputId} className="block">
      <span className="block text-sm font-medium text-[var(--color-ink)] mb-1.5">
        {label}
      </span>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        {...rest}
        className={`w-full px-4 py-3 rounded-md bg-[var(--color-paper)] border ${state} focus:outline-none focus:ring-2 transition-[border-color,box-shadow] text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)] ${className}`}
      />
      {hint && !error && (
        <span className="block text-xs text-[var(--color-ink-muted)] mt-1.5">
          {hint}
        </span>
      )}
      {error && (
        <span className="block text-xs text-[var(--color-brick)] mt-1.5">
          {error}
        </span>
      )}
    </label>
  );
}
