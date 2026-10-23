"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import Avatar from "@/components/Avatar";
import { useAuth } from "@/contexts/AuthContext";

export type AdminSection =
  | "overview"
  | "jarvis"
  | "analytics"
  | "growth"
  | "outreach"
  | "approvals"
  | "verification"
  | "business"
  | "disputes"
  | "moderation"
  | "support"
  | "broadcast"
  | "users"
  | "heatmap"
  | "audit";

type NavItem = {
  id: AdminSection;
  label: string;
  description: string;
  icon: ReactNode;
  count?: number;
  tone?: "ochre" | "brick" | "sage";
};

const ICONS: Record<AdminSection, ReactNode> = {
  outreach: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22 11 13 2 9z" />
    </svg>
  ),
  jarvis: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 1 3 3v1h1a3 3 0 0 1 3 3v2a3 3 0 0 1-1 2.2V18a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-1.8A3 3 0 0 1 4 14v-2a3 3 0 0 1 3-3h1V5a3 3 0 0 1 3-3z" />
      <circle cx="9" cy="13" r="1" />
      <circle cx="15" cy="13" r="1" />
    </svg>
  ),
  analytics: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="21" x2="21" y2="21" />
      <rect x="5" y="11" width="3" height="7" />
      <rect x="10.5" y="7" width="3" height="11" />
      <rect x="16" y="13" width="3" height="5" />
    </svg>
  ),
  overview: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" />
      <rect x="3" y="16" width="7" height="5" />
    </svg>
  ),
  approvals: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  verification: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  business: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l1.5-5h15L21 9" />
      <path d="M4 9h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9z" />
      <path d="M3 9a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 3 0" />
      <path d="M10 20v-5h4v5" />
    </svg>
  ),
  disputes: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  heatmap: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  audit: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2 H6 a2 2 0 0 0 -2 2 v16 a2 2 0 0 0 2 2 h12 a2 2 0 0 0 2 -2 V8 z" />
      <path d="M14 2 v6 h6" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="15" y2="17" />
    </svg>
  ),
  moderation: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4v16" />
      <path d="M4 4h11l-2 5 2 5H4" />
    </svg>
  ),
  support: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  ),
  broadcast: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 0 1-5.8-1.6" />
    </svg>
  ),
  growth: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 6l-9.5 9.5-5-5L1 18" />
      <path d="M17 6h6v6" />
    </svg>
  ),
};

export default function AdminShell({
  section,
  onSectionChange,
  title,
  subtitle,
  counts,
  searchSlot,
  alertSlot,
  children,
}: {
  section: AdminSection;
  onSectionChange: (s: AdminSection) => void;
  title: string;
  subtitle?: string;
  counts?: { approvals?: number; verification?: number; disputes?: number; users?: number; moderation?: number; business?: number; support?: number };
  /** Global admin search (rendered in the top bar, desktop only). */
  searchSlot?: ReactNode;
  /** High-priority banner (e.g. active SOS alerts) shown atop every section. */
  alertSlot?: ReactNode;
  children: ReactNode;
}) {
  const { profile, signOut, can } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const navAll: NavItem[] = [
    { id: "overview", label: "Overview", description: "Today at a glance", icon: ICONS.overview },
    { id: "jarvis", label: "Jarvis", description: "Ask about the marketplace", icon: ICONS.jarvis },
    { id: "analytics", label: "Analytics", description: "Funnels, rates & trends", icon: ICONS.analytics },
    { id: "growth", label: "Growth", description: "Ratio, fill-rate & pace to 20k", icon: ICONS.growth },
    { id: "outreach", label: "Outreach", description: "B2B email pipeline & replies", icon: ICONS.outreach },
    {
      id: "approvals",
      label: "Account approvals",
      description: "Greenlight new sign-ups",
      icon: ICONS.approvals,
      count: counts?.approvals,
      tone: "ochre",
    },
    {
      id: "verification",
      label: "Worker verification",
      description: "ID + selfie + skill review",
      icon: ICONS.verification,
      count: counts?.verification,
      tone: "ochre",
    },
    {
      id: "business",
      label: "Business verify",
      description: "CIPC review + badge",
      icon: ICONS.business,
      count: counts?.business,
      tone: "ochre",
    },
    {
      id: "disputes",
      label: "Disputes",
      description: "Frozen jobs awaiting decision",
      icon: ICONS.disputes,
      count: counts?.disputes,
      tone: "brick",
    },
    {
      id: "moderation",
      label: "Moderation",
      description: "Reports + auto-flags",
      icon: ICONS.moderation,
      count: counts?.moderation,
      tone: "brick",
    },
    {
      id: "support",
      label: "Support",
      description: "WhatsApp messages",
      icon: ICONS.support,
      count: counts?.support,
      tone: "sage",
    },
    { id: "broadcast", label: "Broadcast", description: "Notify users", icon: ICONS.broadcast },
    { id: "users", label: "Users", description: "All accounts", icon: ICONS.users, count: counts?.users },
    { id: "heatmap", label: "Heatmap", description: "Where the work is", icon: ICONS.heatmap },
    { id: "audit", label: "Audit log", description: "Every admin action recorded", icon: ICONS.audit },
  ];
  const nav = navAll.filter((item) => {
    // RBAC phase 2: tabs are gated by the capability each one needs (see
    // ADMIN_ROLES.md matrix). Untagged legacy admins see everything via the
    // can() fallback; a tagged "operations" admin loses Broadcast, an
    // "analyst" keeps only the read-only dashboards, etc. Cosmetic — the
    // rules/callables behind each tab are the real gate.
    const need: Record<string, Parameters<typeof can>[0]> = {
      overview: "analytics.view",
      jarvis: "approvals.manage",
      analytics: "analytics.view",
      growth: "analytics.view",
      outreach: "approvals.manage",
      approvals: "approvals.manage",
      verification: "verification.review",
      business: "business.verify",
      disputes: "disputes.resolve",
      moderation: "moderation.act",
      support: "support.respond",
      broadcast: "broadcast.send",
      users: "users.read",
      heatmap: "analytics.view",
      audit: "audit.view",
    };
    const p = need[item.id];
    return !p || can(p);
  });

  const select = (s: AdminSection) => {
    onSectionChange(s);
    setDrawerOpen(false);
  };

  return (
    <div className="min-h-screen bg-[var(--color-cream)] text-[var(--color-ink)]">
      {/* TOP BAR */}
      <header className="sticky top-0 z-30 h-14 border-b border-[var(--color-line)] bg-[var(--color-paper)]/95 backdrop-blur-md">
        <div className="h-full mx-auto max-w-[1400px] px-3 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Hamburger (mobile) */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open admin menu"
              className="md:hidden w-9 h-9 rounded-md flex items-center justify-center hover:bg-[var(--color-cream-2)]"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <Link href="/" aria-label="Workit home" className="flex items-center gap-2">
              <Logo size="sm" />
            </Link>
            <span className="hidden sm:inline-block text-xs uppercase tracking-widest px-2 py-0.5 rounded bg-[var(--color-ink)] text-[var(--color-cream)] font-semibold">
              Admin
            </span>
          </div>

          {/* Global search — desktop top bar */}
          {searchSlot && <div className="hidden md:block flex-1 max-w-md mx-4">{searchSlot}</div>}

          <div className="flex items-center gap-2">
            <Link
              href="/admin/live"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-ochre-700)] hover:text-white px-3 py-1.5 rounded-pill border border-[var(--color-ochre-300)] hover:bg-[var(--color-ochre-600)] transition-colors"
              title="Full-screen live marketplace view"
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-ochre-500)] animate-pulse" />
              Live view
            </Link>
            <Link
              href="/"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] px-3 py-1.5 rounded hover:bg-[var(--color-cream-2)]"
            >
              ← Back to app
            </Link>
            <div className="flex items-center gap-2 pl-3 ml-1 border-l border-[var(--color-line)]">
              <Avatar name={profile?.displayName} photoURL={profile?.photoURL} size="xs" />
              <span className="hidden sm:inline text-xs text-[var(--color-ink-soft)]">
                {profile?.displayName?.split(" ")[0]}
              </span>
              <button
                type="button"
                onClick={() => signOut()}
                className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-brick)] px-2 py-1 rounded"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] flex">
        {/* SIDEBAR (desktop) */}
        <aside className="hidden md:flex flex-col w-64 lg:w-72 flex-shrink-0 border-r border-[var(--color-line)] min-h-[calc(100vh-3.5rem)] py-6 px-3">
          <SidebarBody nav={nav} active={section} onSelect={select} />
          <div className="mt-auto px-2 pt-6 text-[10px] text-[var(--color-ink-muted)]">
            <p className="mb-2">
              <kbd className="px-1 py-0.5 rounded border border-[var(--color-line)] bg-[var(--color-cream-2)] font-mono">/</kbd>{" "}
              search ·{" "}
              <kbd className="px-1 py-0.5 rounded border border-[var(--color-line)] bg-[var(--color-cream-2)] font-mono">g</kbd>
              +key switch tabs
            </p>
            <p>Workit admin · Furthersky Solutions</p>
            <p className="mt-0.5">Built by Tshepo M</p>
          </div>
        </aside>

        {/* CONTENT */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {alertSlot}
          <div className="mb-6">
            <h1 className="font-display text-2xl sm:text-3xl tracking-tight">{title}</h1>
            {subtitle && (
              <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{subtitle}</p>
            )}
          </div>
          {children}
        </main>
      </div>

      {/* MOBILE DRAWER */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 animate-fade-in"
          onClick={() => setDrawerOpen(false)}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="absolute left-0 top-0 bottom-0 w-72 max-w-[85%] bg-[var(--color-paper)] py-6 px-3 overflow-y-auto"
          >
            <div className="flex items-center justify-between px-2 mb-6">
              <Logo size="sm" />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close"
                className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--color-ink-muted)] hover:bg-[var(--color-cream-2)]"
              >
                ×
              </button>
            </div>
            <SidebarBody nav={nav} active={section} onSelect={select} />
          </aside>
        </div>
      )}
    </div>
  );
}

function SidebarBody({
  nav,
  active,
  onSelect,
}: {
  nav: NavItem[];
  active: AdminSection;
  onSelect: (s: AdminSection) => void;
}) {
  return (
    <nav className="space-y-0.5">
      <p className="px-3 pb-2 text-[10px] uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold">
        Manage
      </p>
      {nav.map((item) => {
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
              isActive
                ? "bg-[var(--color-ink)] text-[var(--color-cream)]"
                : "text-[var(--color-ink-soft)] hover:bg-[var(--color-cream-2)] hover:text-[var(--color-ink)]"
            }`}
          >
            <span className={isActive ? "text-[var(--color-ochre-300)]" : "text-[var(--color-ink-muted)]"}>
              {item.icon}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium leading-tight">{item.label}</span>
              <span
                className={`block text-[11px] leading-tight mt-0.5 ${
                  isActive ? "text-[var(--color-cream-2)]/70" : "text-[var(--color-ink-muted)]"
                }`}
              >
                {item.description}
              </span>
            </span>
            {typeof item.count === "number" && item.count > 0 && (
              <span
                className={`inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-full text-[10px] font-bold ${
                  item.tone === "brick"
                    ? "bg-[var(--color-brick-solid)] text-white"
                    : item.tone === "sage"
                      ? "bg-[var(--color-sage-600)] text-white"
                      : "bg-[var(--color-ochre-500)] text-[var(--color-cream)]"
                }`}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
