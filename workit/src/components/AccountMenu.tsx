"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Avatar from "./Avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/LocaleContext";

/**
 * Signed-in account menu — folds the avatar, My jobs and Sign out into one
 * dropdown so the header's right side stays calm (was three separate items).
 * Follows the LanguageSwitcher dropdown pattern (click-outside + Escape).
 */
export default function AccountMenu() {
  const { profile, signOut } = useAuth();
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

  const firstName = profile?.displayName?.split(" ")[0] ?? t("nav.account");

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("nav.account")}
        className="flex items-center gap-2 pl-1 pr-2 h-9 rounded-full text-sm text-[var(--color-ink-soft)] hover:bg-[var(--color-cream-2)] hover:text-[var(--color-ink)] transition-colors"
      >
        <Avatar name={profile?.displayName} photoURL={profile?.photoURL} size="xs" />
        <span className="hidden lg:inline max-w-[8rem] truncate">{firstName}</span>
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
          className="absolute right-0 mt-2 min-w-[12rem] rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] shadow-lift py-1 z-50 animate-pop-in"
        >
          <Link
            href="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-[var(--color-ink-soft)] hover:bg-[var(--color-cream-2)] hover:text-[var(--color-ink)] transition-colors"
          >
            {t("nav.account")}
          </Link>
          <Link
            href="/my-jobs"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-[var(--color-ink-soft)] hover:bg-[var(--color-cream-2)] hover:text-[var(--color-ink)] transition-colors"
          >
            {t("nav.myJobs")}
          </Link>
          <div className="my-1 border-t border-[var(--color-line)]" role="none" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="w-full text-left px-3 py-2 text-sm text-[var(--color-ink-soft)] hover:bg-[var(--color-cream-2)] hover:text-[var(--color-brick)] transition-colors"
          >
            {t("auth.signOut")}
          </button>
        </div>
      )}
    </div>
  );
}
