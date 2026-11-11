"use client";

/**
 * Root error boundary — what shows when a client-side render throws.
 * Branded fallback with a real "try again" button.
 */
import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Best-effort: ship to Sentry if it's loaded
    try {
      const w = window as unknown as {
        Sentry?: { captureException?: (e: unknown) => void };
      };
      w.Sentry?.captureException?.(error);
    } catch {
      /* ignore */
    }
  }, [error]);

  return (
    <main className="flex-1 flex items-center justify-center px-5 py-14">
      <div className="max-w-md w-full rounded-2xl bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft p-8 sm:p-10 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-[var(--color-brick-soft)] text-[var(--color-brick)] flex items-center justify-center mb-5 font-display text-3xl">
          !
        </div>
        <h1 className="font-display text-2xl sm:text-3xl tracking-tight">
          Something went wrong.
        </h1>
        <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
          Not your fault. The error has been logged for review. Try again, or
          go home and we&apos;ll keep things moving.
        </p>
        {error.digest && (
          <p className="mt-3 text-[10px] uppercase tracking-widest text-[var(--color-ink-muted)] font-mono">
            ref · {error.digest}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2 justify-center">
          <Link
            href="/"
            className="px-5 py-3 rounded-pill border border-[var(--color-line)] hover:bg-[var(--color-cream-2)] text-sm"
          >
            Workit home
          </Link>
          <button
            type="button"
            onClick={reset}
            className="px-5 py-3 rounded-pill bg-[var(--color-ochre-500)] text-[var(--color-cream)] font-medium hover:bg-[var(--color-ochre-600)]"
          >
            Try again
          </button>
        </div>
      </div>
    </main>
  );
}
