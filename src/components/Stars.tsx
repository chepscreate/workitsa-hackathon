"use client";

import { useState } from "react";

export function StarsRead({
  value,
  count,
}: {
  value?: number;
  count?: number;
}) {
  if (value === undefined || value === null) {
    return <span className="text-xs text-[var(--color-ink-muted)]">No ratings yet</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span className="text-[var(--color-ochre-500)]">★</span>
      <span className="font-medium text-[var(--color-ink)]">{value.toFixed(1)}</span>
      {count !== undefined && (
        <span className="text-xs text-[var(--color-ink-muted)]">({count})</span>
      )}
    </span>
  );
}

export function StarsInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value;
  return (
    <div className="inline-flex items-center gap-1" onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(n)}
          className="text-3xl leading-none transition-transform hover:scale-110"
          style={{
            color: n <= display ? "var(--color-ochre-500)" : "var(--color-line)",
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}
