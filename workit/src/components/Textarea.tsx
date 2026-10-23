import type { ComponentProps, ReactNode } from "react";

type Props = ComponentProps<"textarea"> & {
  label: string;
  hint?: ReactNode;
  error?: string;
};

export default function Textarea({
  label,
  hint,
  error,
  className = "",
  id,
  rows = 5,
  ...rest
}: Props) {
  const inputId = id ?? rest.name ?? label.toLowerCase().replace(/\s+/g, "-");
  const state = error
    ? "border-[var(--color-brick)] focus:border-[var(--color-brick)] focus:ring-[var(--color-brick-soft)]"
    : "border-[var(--color-line)] focus:border-[var(--color-ochre-500)] focus:ring-[var(--color-ochre-300)]";
  return (
    <label htmlFor={inputId} className="block">
      <span className="block text-sm font-medium text-[var(--color-ink)] mb-1.5">
        {label}
      </span>
      <textarea
        id={inputId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        {...rest}
        className={`w-full px-4 py-3 rounded-md bg-[var(--color-paper)] border ${state} focus:outline-none focus:ring-2 transition-[border-color,box-shadow] text-[var(--color-ink)] resize-y placeholder:text-[var(--color-ink-muted)] ${className}`}
      />
      {hint && !error && (
        <span className="block text-xs text-[var(--color-ink-muted)] mt-1.5">{hint}</span>
      )}
      {error && (
        <span className="block text-xs text-[var(--color-brick)] mt-1.5">{error}</span>
      )}
    </label>
  );
}
