"use client";

import { useEffect } from "react";
import Link from "next/link";

export type ToastItem = {
  id: string;
  title: string;
  body?: string;
  href?: string;
  createdAt: number;
};

export function ToastStack({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  // Newest at the top of the visual stack — `flex-col-reverse` lays the
  // latest array entry highest while keeping the natural insertion order.
  return (
    <div className="fixed z-50 bottom-20 sm:bottom-6 right-4 sm:right-6 flex flex-col-reverse gap-3 max-w-sm w-[calc(100%-2rem)]">
      {items.map((t) => (
        <Toast key={t.id} item={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  useEffect(() => {
    const handle = setTimeout(onDismiss, 8000);
    return () => clearTimeout(handle);
  }, [onDismiss]);

  const Inner = (
    <>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-1 inline-block w-2 h-2 rounded-full bg-[var(--color-ochre-500)] flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="font-display text-base text-[var(--color-ink)] leading-tight">
            {item.title}
          </p>
          {item.body && (
            <p className="mt-1 text-sm text-[var(--color-ink-soft)] line-clamp-2">
              {item.body}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDismiss();
          }}
          className="text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] text-lg leading-none"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </>
  );

  const className =
    "block rounded-xl bg-[var(--color-paper)] border border-[var(--color-line)] shadow-lift p-4 hover:-translate-y-0.5 transition-transform";

  if (item.href) {
    return (
      <Link href={item.href} className={className}>
        {Inner}
      </Link>
    );
  }
  return <div className={className}>{Inner}</div>;
}
