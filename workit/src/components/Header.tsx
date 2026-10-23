"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Container from "./Container";
import Logo from "./Logo";
import Button from "./Button";
import ThemeToggle from "./ThemeToggle";
import LanguageSwitcher from "./LanguageSwitcher";
import NavMore, { MORE_LINKS } from "./NavMore";
import AccountMenu from "./AccountMenu";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/LocaleContext";
import type { Messages } from "@/i18n/locales";

// Primary action links only. The secondary/info links (How it works, Safety,
// FAQ) live in the <NavMore> dropdown so they don't crowd these.
const NAV_LINKS: { href: string; key: keyof Messages }[] = [
  { href: "/find-work", key: "nav.findWork" },
  { href: "/post-a-job", key: "nav.postJob" },
  { href: "/workers", key: "nav.workers" },
  { href: "/businesses", key: "nav.businesses" },
];

export default function Header() {
  const { user, loading } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const showBack = pathname !== "/";

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-[color:var(--color-cream)]/85 border-b border-[var(--color-line)]">
      <Container className="flex items-center justify-between h-16 sm:h-18">
        <div className="flex items-center gap-1">
          {/* Mobile back button — browser-history back, hidden on the home page.
              Desktop users have the full nav, so it's mobile-only. */}
          {showBack && (
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Go back"
              className="md:hidden inline-flex items-center justify-center w-9 h-9 -ml-1 rounded-full hover:bg-[var(--color-cream-2)] text-[var(--color-ink)]"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}
          <Link href="/" aria-label="Workit home">
            <Logo size="sm" />
          </Link>
        </div>

        {/* Desktop nav */}
        {/* Info links (How it works / Safety / FAQ) show INLINE for logged-out
            visitors — they're trust-builders that help a newcomer decide — and
            collapse into the "More" dropdown once signed in, to keep the app
            view tidy. During auth loading we show the tidy version to avoid a
            flash of the full link set. */}
        <nav className="hidden md:flex items-center gap-6 text-sm text-[var(--color-ink-soft)]">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="nav-link transition-colors hover:text-[var(--color-ink)]"
            >
              {t(l.key)}
            </Link>
          ))}
          {!loading && !user ? (
            MORE_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="nav-link transition-colors hover:text-[var(--color-ink)]"
              >
                {t(l.key)}
              </Link>
            ))
          ) : (
            <NavMore />
          )}
        </nav>

        {/* Desktop auth */}
        <div className="hidden md:flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          {loading ? (
            <span className="text-xs text-[var(--color-ink-muted)]">…</span>
          ) : user ? (
            <AccountMenu />
          ) : (
            <>
              <Button href="/signin" variant="ghost" size="sm">{t("auth.signIn")}</Button>
              <Button href="/signup" variant="primary" size="sm">{t("auth.getStarted")}</Button>
            </>
          )}
        </div>

        {/* Mobile actions — no hamburger. The bottom tab bar (MobileBottomNav)
            already covers Home / Find work / Post / Me, so a hamburger would
            duplicate navigation. Guests still get a Sign in shortcut; the rest
            (sign out, profile) lives on the Me / account screen. */}
        <div className="md:hidden flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
          {!loading && !user && (
            <Button href="/signin" variant="ghost" size="sm">{t("auth.signIn")}</Button>
          )}
        </div>
      </Container>
    </header>
  );
}
