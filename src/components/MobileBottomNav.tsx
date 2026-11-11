"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Avatar from "./Avatar";

/**
 * Native-app-style bottom tab bar shown only on mobile (< md).
 * Sits above iOS home indicator using safe-area-inset.
 * Hidden when a confirm modal or full-screen overlay is open (z-index lower).
 */
export default function MobileBottomNav() {
  const pathname = usePathname() ?? "/";
  const { user, profile } = useAuth();

  // Full-screen views (the live "pulse" god-view) render their own chrome —
  // the bottom nav must not sit on top of them.
  const fullScreen = pathname.startsWith("/admin/live");

  const items: Array<{
    href: string;
    label: string;
    icon: React.JSX.Element;
    isActive: (p: string) => boolean;
  }> = [
    {
      href: "/",
      label: "Home",
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12 L12 3 L21 12" />
          <path d="M5 10 V20 H9 V14 H15 V20 H19 V10" />
        </svg>
      ),
      isActive: (p) => p === "/",
    },
    {
      href: "/find-work",
      label: "Find work",
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20 L16 16" />
        </svg>
      ),
      isActive: (p) => p.startsWith("/find-work") || p.startsWith("/jobs"),
    },
    {
      href: "/workers",
      label: "Workers",
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20 C2.5 16, 5.5 14, 9 14 S15.5 16, 15.5 20" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M16 13.5 C19 13.5, 21.5 15.5, 21.5 18.5" />
        </svg>
      ),
      isActive: (p) => p.startsWith("/workers") || p.startsWith("/u"),
    },
    {
      href: "/post-a-job",
      label: "Post",
      icon: (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8 V16 M8 12 H16" />
        </svg>
      ),
      isActive: (p) => p.startsWith("/post-a-job"),
    },
    {
      href: user ? "/account" : "/signin",
      label: user ? "Me" : "Sign in",
      // Signed-in users see their own profile photo in a little bubble instead
      // of a generic person icon — makes the "Me" tab feel personal.
      icon: user ? (
        <span className="block w-[26px] h-[26px] rounded-full overflow-hidden ring-2 ring-[var(--color-cream)]">
          <Avatar name={profile?.displayName} photoURL={profile?.photoURL} size="xs" />
        </span>
      ) : (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="9" r="4" />
          <path d="M4 21 C4 16, 8 14, 12 14 S20 16, 20 21" />
        </svg>
      ),
      isActive: (p) => p.startsWith("/account") || p.startsWith("/profile") || p.startsWith("/signin"),
    },
  ];

  // Show admin shortcut for admins instead of Post (they post less often).
  // Looked up by href, not index — a hard-coded index broke silently when the
  // Workers tab was added.
  if (profile?.role === "admin") {
    items.splice(items.findIndex((it) => it.href === "/post-a-job"), 1, {
      href: "/admin",
      label: "Admin",
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3 L3 7 V12 C3 17, 7 21, 12 22 C17 21, 21 17, 21 12 V7 Z" />
          <path d="M9 12 L11 14 L15 10" />
        </svg>
      ),
      isActive: (p) => p.startsWith("/admin"),
    });
  }

  if (fullScreen) return null;

  return (
    <>
      {/* Spacer so page content isn't covered by the fixed bar */}
      <div className="md:hidden h-[calc(64px+env(safe-area-inset-bottom))]" aria-hidden />

      <nav
        aria-label="Primary"
        className="md:hidden fixed left-0 right-0 bottom-0 z-30 border-t border-[var(--color-line)] bg-[color:var(--color-cream)]/95 backdrop-blur-md"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="grid grid-cols-5 h-16">
          {items.map((it) => {
            const active = it.isActive(pathname);
            return (
              <li key={it.href} className="flex">
                <Link
                  href={it.href}
                  className={`flex flex-col items-center justify-center w-full gap-1 text-[10px] transition-[color,transform] duration-200 active:scale-90 ${
                    active
                      ? "text-[var(--color-ochre-600)]"
                      : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  {/* Pill glow scales in behind the active tab's icon */}
                  <span className="relative flex items-center justify-center">
                    <span
                      aria-hidden
                      className={`absolute -inset-x-4 -inset-y-1 rounded-pill bg-[var(--color-ochre-50)] transition-all duration-300 [transition-timing-function:var(--ease-spring)] ${
                        active ? "opacity-100 scale-100" : "opacity-0 scale-50"
                      }`}
                    />
                    <span className="relative">{it.icon}</span>
                  </span>
                  <span className="uppercase tracking-wider font-medium">
                    {it.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
