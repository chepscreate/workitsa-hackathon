"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/contexts/LocaleContext";
import type { Messages } from "@/i18n/locales";

/**
 * "More" dropdown for the secondary/info nav links (How it works, Safety, FAQ).
 * Keeps them one click away without crowding the primary action links.
 * Follows the LanguageSwitcher dropdown pattern (click-outside + Escape).
 */
// Secondary/info links. Exported so the Header can render them INLINE for
// logged-out visitors (trust-builders on the marketing pages) and collapse
// them into this dropdown once a user is signed in.
export const MORE_LINKS: { href: string; key: keyof Messages }[] = [
  { href: "/how-it-works", key: "nav.howItWorks" },
  { href: "/safety", key: "nav.safety" },
  { href: "/how-it-works#faq", key: "nav.faq" },
];

export default function NavMore() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="nav-link inline-flex items-center gap-1 transition-colors hover:text-[var(--color-ink)]"
      >
        {t("nav.more")}
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 min-w-[11rem] rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] shadow-lift py-1 z-50 animate-pop-in"
        >
          {MORE_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-[var(--color-ink-soft)] hover:bg-[var(--color-cream-2)] hover:text-[var(--color-ink)] transition-colors"
            >
              {t(l.key)}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
