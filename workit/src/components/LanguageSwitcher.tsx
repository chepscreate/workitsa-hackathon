"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/contexts/LocaleContext";

/**
 * Compact language picker. Lists only languages with a real dictionary
 * registered (English, Afrikaans, isiZulu for now) — see LocaleContext.
 * Shows the globe + the current language's short code; opens a small menu
 * of native labels.
 */
export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, availableLocales } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Only one language available → nothing to switch; render nothing.
  if (availableLocales.length < 2) return null;

  const current = availableLocales.find((l) => l.code === locale) ?? availableLocales[0];

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Change language"
        className="inline-flex items-center gap-1.5 px-2.5 h-9 rounded-full text-sm text-[var(--color-ink-soft)] hover:bg-[var(--color-cream-2)] hover:text-[var(--color-ink)] transition-colors"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <span className="uppercase text-xs font-semibold tracking-wide">{current.code}</span>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Language"
          className="absolute right-0 mt-1 min-w-[10rem] rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] shadow-lift py-1 z-50 animate-pop-in"
        >
          {availableLocales.map((l) => {
            const active = l.code === locale;
            return (
              <li key={l.code} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    setLocale(l.code);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-3 transition-colors ${
                    active
                      ? "text-[var(--color-ochre-700)] font-medium bg-[var(--color-ochre-50)]"
                      : "text-[var(--color-ink-soft)] hover:bg-[var(--color-cream-2)]"
                  }`}
                >
                  <span>{l.nativeLabel}</span>
                  {active && <span aria-hidden>✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
