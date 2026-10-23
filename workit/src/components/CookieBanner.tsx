"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// v2: copy now discloses consent-gated analytics, so everyone re-answers
// under the new wording (v1 consent predates analytics and doesn't carry over).
const STORAGE_KEY = "workit_cookie_consent_v2";

type Consent = "accepted" | "rejected" | null;

/**
 * Single-tap cookie consent, stored in localStorage. This IS a runtime gate:
 * Firebase Analytics (src/lib/analytics.ts) only initialises and logs events
 * when the stored choice is "accepted". Decline (or no answer) = no analytics.
 */
export default function CookieBanner() {
  const [consent, setConsent] = useState<Consent>(null);
  const [hidden, setHidden] = useState(true); // start hidden, reveal after read

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY) as Consent;
    setConsent(stored);
    setHidden(stored !== null);
  }, []);

  const choose = (v: Exclude<Consent, null>) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, v);
    }
    setConsent(v);
    setHidden(true);
  };

  if (hidden || consent !== null) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie notice"
      // Sit above the mobile bottom nav on small screens. On md+ the
      // nav is hidden so we revert to the bottom edge.
      className="fixed inset-x-0 bottom-16 md:bottom-0 z-50 px-3 sm:px-6 pb-3 sm:pb-6 animate-slide-up"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto max-w-3xl rounded-2xl bg-[var(--color-ink)] text-[var(--color-cream)] shadow-lift p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <span className="text-2xl" aria-hidden>🍪</span>
        <p className="text-sm flex-1 leading-relaxed">
          Workit uses a small amount of storage on your device so you stay
          signed in, and — only if you accept — anonymous usage stats that
          help us improve the app. No advertising cookies.{" "}
          <Link
            href="/privacy"
            className="underline decoration-[var(--color-ochre-300)] underline-offset-2"
          >
            Privacy policy
          </Link>
        </p>
        <div className="flex gap-2 self-stretch sm:self-auto flex-shrink-0">
          <button
            type="button"
            onClick={() => choose("rejected")}
            className="flex-1 sm:flex-none px-4 py-2 rounded-pill text-sm text-[var(--color-cream-2)]/80 hover:text-[var(--color-cream)] hover:bg-white/10 transition-colors"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => choose("accepted")}
            className="flex-1 sm:flex-none px-5 py-2 rounded-pill bg-[var(--color-ochre-500)] text-[var(--color-cream)] text-sm font-medium hover:bg-[var(--color-ochre-600)] transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
