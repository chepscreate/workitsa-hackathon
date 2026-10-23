"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import Header from "@/components/Header";
import { PageSkeleton } from "@/components/Skeleton";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import PageHero from "@/components/PageHero";
import Badge from "@/components/Badge";
import Avatar from "@/components/Avatar";
import { StarsRead } from "@/components/Stars";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { CATEGORIES, type CategoryId, type UserProfile } from "@/lib/types";

export default function BusinessesPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Container className="py-12 max-w-5xl">
          <PageHero
            eyebrow="Directory"
            eyebrowTone="ochre"
            title="Businesses on Workit"
            intro="Local businesses hiring through Workit. Browse who they are, what they do, and how workers rate them."
          />
          <BusinessesInner />
        </Container>
      </main>
      <Footer />
    </>
  );
}

function BusinessesInner() {
  const { user, loading: authLoading } = useAuth();
  const [businesses, setBusinesses] = useState<UserProfile[] | null>(null);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<CategoryId | "all">("all");
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(getDb(), "users"), where("role", "==", "business"), limit(200)),
        );
        if (cancelled) return;
        setBusinesses(snap.docs.map((d) => ({ ...(d.data() as UserProfile), uid: d.id })));
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("permission") || msg.includes("insufficient")) setDenied(true);
        else setBusinesses([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const filtered = useMemo(() => {
    if (!businesses) return [];
    const q = search.trim().toLowerCase();
    return businesses
      .filter((b) => {
        if (cat !== "all" && !(b.businessCategories ?? []).includes(cat)) return false;
        if (!q) return true;
        const hay = [b.businessName, b.displayName, b.businessTagline, b.businessAreaServed]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      // Pro first (monetization), then verified, then by rating, then name.
      .sort((a, b) => {
        const ap = a.businessPro ? 1 : 0;
        const bp = b.businessPro ? 1 : 0;
        if (ap !== bp) return bp - ap;
        const av = a.businessVerification?.status === "approved" ? 1 : 0;
        const bv = b.businessVerification?.status === "approved" ? 1 : 0;
        if (av !== bv) return bv - av;
        const ar = a.ratingAvg ?? 0;
        const br = b.ratingAvg ?? 0;
        if (ar !== br) return br - ar;
        return (a.businessName || a.displayName || "").localeCompare(b.businessName || b.displayName || "");
      });
  }, [businesses, search, cat]);

  if (authLoading) {
    return (
      <div className="mt-8">
        <PageSkeleton />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mt-8 rounded-2xl p-8 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft text-center">
        <h2 className="font-display text-2xl tracking-tight mb-2">Sign in to browse businesses</h2>
        <p className="text-sm text-[var(--color-ink-soft)] mb-5">The directory is visible to signed-in Workit users.</p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Link href="/signup?next=%2Fbusinesses" className="px-5 py-3 rounded-pill bg-[var(--color-ochre-500)] text-[var(--color-cream)] text-sm font-medium hover:bg-[var(--color-ochre-600)]">
            Create account
          </Link>
          <Link href="/signin?next=%2Fbusinesses" className="px-5 py-3 rounded-pill border border-[var(--color-line)] text-sm hover:bg-[var(--color-cream-2)]">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (denied) {
    return <p className="mt-8 text-[var(--color-ink-muted)]">Couldn&apos;t load the directory right now.</p>;
  }
  if (businesses === null) {
    return <p className="mt-8 text-[var(--color-ink-muted)]">Loading businesses…</p>;
  }

  return (
    <div className="mt-8">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or area…"
          aria-label="Search businesses by name or area"
          className="flex-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-ochre-500)]"
        />
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value as CategoryId | "all")}
          className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-2.5 text-sm"
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl p-10 bg-[var(--color-paper)] border border-[var(--color-line)] text-center text-sm text-[var(--color-ink-muted)]">
          {businesses.length === 0
            ? "No businesses on Workit yet — be the first."
            : "No businesses match your search."}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {filtered.map((b) => {
            const name = b.businessName || b.displayName || "Business";
            const verified = b.businessVerification?.status === "approved";
            const pro = !!b.businessPro;
            const rc = b.ratingCount ?? 0;
            return (
              <Link
                key={b.uid}
                href={`/business?id=${b.uid}`}
                className="rounded-2xl p-5 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft hover:border-[var(--color-ochre-300)] transition-colors flex gap-4"
              >
                <Avatar name={name} photoURL={b.businessLogoURL || b.photoURL} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display text-lg truncate">{name}</h3>
                    {pro && <Badge tone="ochre">✦ Pro</Badge>}
                    {verified && <Badge tone="sage">✓ Verified</Badge>}
                  </div>
                  {b.businessTagline && (
                    <p className="text-sm text-[var(--color-ink-soft)] line-clamp-2 mt-0.5">{b.businessTagline}</p>
                  )}
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-[var(--color-ink-muted)] flex-wrap">
                    {rc > 0 ? (
                      <span className="flex items-center gap-1">
                        <StarsRead value={b.ratingAvg ?? 0} />
                        {(b.ratingAvg ?? 0).toFixed(1)} ({rc})
                      </span>
                    ) : (
                      <span>New</span>
                    )}
                    {b.businessAreaServed && <span>· 📍 {b.businessAreaServed}</span>}
                  </div>
                  {b.businessCategories && b.businessCategories.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {b.businessCategories.slice(0, 3).map((c) => (
                        <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-cream-2)] text-[var(--color-ink-soft)]">
                          {CATEGORIES.find((x) => x.id === c)?.label ?? c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
