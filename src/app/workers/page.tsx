"use client";

/**
 * Worker directory — employers browse workers without posting a job first.
 *
 * Filters: category, Verified-only, Gold-only, sort by rating / jobs done /
 * distance. Each card opens the public profile (/u?id=...) where the
 * employer can hit "Invite to a job" → pre-filled post-a-job.
 *
 * Workers viewing other workers see the directory too (useful for
 * benchmarking yourself) but the "Invite" CTA is hidden for them on the
 * profile page anyway, so no harm done.
 *
 * Privacy: only signed-in users see the directory. Guests are bounced to
 * sign-in via AccountGate (`requireSignIn={false}` would let them through;
 * we want gated here).
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import Badge from "@/components/Badge";
import AccountGate from "@/components/AccountGate";
import WorkerCard from "@/components/WorkerCard";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import {
  CATEGORIES,
  SUBCATEGORIES,
  isAvailableNow,
  skillLabel,
  type CategoryId,
  type UserProfile,
} from "@/lib/types";
import { haversineKm } from "@/lib/geo";

type Trust = "all" | "verified" | "gold";
type Sort = "rating" | "jobs" | "nearest";

export default function WorkersPage() {
  return (
    <AccountGate>
      <WorkersInner />
    </AccountGate>
  );
}

function WorkersInner() {
  const { profile } = useAuth();
  const [workers, setWorkers] = useState<UserProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryId | "all">("all");
  const [skill, setSkill] = useState<string | "all">("all");
  const [trust, setTrust] = useState<Trust>("verified");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("rating");
  const [keyword, setKeyword] = useState("");

  // Skill chips only make sense within one category; reset on switch.
  const pickCategory = (c: CategoryId | "all") => {
    setCategory(c);
    setSkill("all");
  };

  // Pull approved workers once. Subscription would re-fire too often; this
  // page is browsed, not watched.
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(
          query(
            collection(getDb(), "users"),
            where("role", "==", "worker"),
            where("accountStatus", "==", "approved"),
          ),
        );
        const list = snap.docs.map((d) => ({
          ...(d.data() as UserProfile),
          uid: d.id,
        }));
        setWorkers(list);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load workers.");
        setWorkers([]);
      }
    })();
  }, []);

  const home =
    profile && typeof profile.homeLat === "number" && typeof profile.homeLng === "number"
      ? { lat: profile.homeLat, lng: profile.homeLng }
      : null;

  const visible = useMemo(() => {
    if (!workers) return null;
    const q = keyword.trim().toLowerCase();
    const blocked = new Set(profile?.blockedUserIds ?? []);

    let list = workers
      .filter((w) => !blocked.has(w.uid))
      .filter((w) => (category === "all" ? true : w.categories?.includes(category)))
      .filter((w) => (skill === "all" ? true : w.skills?.includes(skill)))
      .filter((w) => (availableOnly ? isAvailableNow(w) : true))
      .filter((w) =>
        trust === "verified"
          ? w.verificationStatus === "approved"
          : trust === "gold"
            ? w.backgroundVerified === true
            : true,
      );

    if (q) {
      // Token match over everything the worker has told us about their work:
      // any word of the query hitting name, bio, tagline, suburb, category
      // labels, declared skill labels or qualification titles keeps them in —
      // so "hair stylist" surfaces everyone with the Hair skill even if the
      // word "stylist" never appears on their profile.
      const tokens = q.split(/\s+/).filter(Boolean);
      list = list.filter((w) => {
        const blob = [
          w.displayName,
          w.bio ?? "",
          w.tagline ?? "",
          w.suburb ?? "",
          ...(w.categories ?? []).map(
            (id) => CATEGORIES.find((c) => c.id === id)?.label ?? id,
          ),
          ...(w.skills ?? []).map((id) => skillLabel(id) ?? id),
          ...(w.qualifications ?? []).map((qu) => qu.title),
        ]
          .join(" ")
          .toLowerCase();
        return tokens.some((t) => blob.includes(t));
      });
    }

    // Compute distance once for sorting + display. Other workers expose only
    // their ~1 km approx coords (Phase B) — exact homes are private; legacy
    // homeLat is a fallback for profiles created before the migration.
    const annotated = list.map((w) => {
      const lat = typeof w.approxLat === "number" ? w.approxLat : w.homeLat;
      const lng = typeof w.approxLng === "number" ? w.approxLng : w.homeLng;
      const km =
        home && typeof lat === "number" && typeof lng === "number"
          ? haversineKm(home.lat, home.lng, lat, lng)
          : undefined;
      return { worker: w, km };
    });

    annotated.sort((a, b) => {
      // "Available now" workers float to the top within any sort — this is
      // the visibility the AvailableNowCard toggle promises workers.
      const avail = Number(isAvailableNow(b.worker)) - Number(isAvailableNow(a.worker));
      if (avail !== 0) return avail;
      switch (sort) {
        case "jobs":
          return (b.worker.jobsCompleted ?? 0) - (a.worker.jobsCompleted ?? 0);
        case "nearest":
          if (a.km === undefined && b.km === undefined) return 0;
          if (a.km === undefined) return 1;
          if (b.km === undefined) return -1;
          return a.km - b.km;
        case "rating":
        default:
          return (b.worker.ratingAvg ?? 0) - (a.worker.ratingAvg ?? 0);
      }
    });
    return annotated;
  }, [workers, category, skill, trust, availableOnly, sort, keyword, home, profile?.blockedUserIds]);

  return (
    <>
      <Header />
      <main className="flex-1">
        <Container className="py-14">
          <Badge tone="ochre">Workers</Badge>
          <h1 className="mt-4 font-display text-4xl sm:text-5xl tracking-tight">
            Browse workers near you.
          </h1>
          <p className="mt-3 text-[var(--color-ink-soft)] max-w-2xl">
            Skip the open-call. Find a worker you like and invite them to a
            specific job — they get a notification and the job still goes
            public so anyone else can offer too.
          </p>

          {/* Keyword */}
          <div className="mt-8">
            <input
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Search a skill, name or suburb — e.g. hair stylist, plumber…"
              aria-label="Search workers by skill, name or suburb"
              className="w-full px-4 py-3 rounded-pill bg-[var(--color-paper)] border border-[var(--color-line)] focus:border-[var(--color-ochre-500)] focus:outline-none text-sm"
            />
          </div>

          {/* Category */}
          <div className="mt-5 flex flex-wrap gap-2">
            <Chip active={category === "all"} onClick={() => pickCategory("all")}>
              All categories
            </Chip>
            {CATEGORIES.map((c) => (
              <Chip key={c.id} active={category === c.id} onClick={() => pickCategory(c.id)}>
                {c.label}
              </Chip>
            ))}
          </div>

          {/* Specific skill within the picked category */}
          {category !== "all" && (
            <div className="mt-3 flex items-center gap-2 flex-wrap rounded-xl p-3 bg-[var(--color-cream-2)] border border-[var(--color-line)]">
              <span className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
                Skill
              </span>
              <Chip active={skill === "all"} onClick={() => setSkill("all")}>
                Any
              </Chip>
              {SUBCATEGORIES[category].map((s) => (
                <Chip key={s.id} active={skill === s.id} onClick={() => setSkill(s.id)}>
                  {s.label}
                </Chip>
              ))}
            </div>
          )}

          {/* Trust + availability */}
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <span className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
              Trust
            </span>
            <Chip active={trust === "all"} onClick={() => setTrust("all")}>
              All
            </Chip>
            <Chip active={trust === "verified"} onClick={() => setTrust("verified")}>
              ✓ Verified only
            </Chip>
            <Chip active={trust === "gold"} onClick={() => setTrust("gold")}>
              🥇 Gold (police-cleared)
            </Chip>
            <span className="ml-2 text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
              Availability
            </span>
            <Chip active={availableOnly} onClick={() => setAvailableOnly((v) => !v)}>
              🟢 Available now
            </Chip>
          </div>

          {/* Sort */}
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <span className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
              Sort
            </span>
            <Chip active={sort === "rating"} onClick={() => setSort("rating")}>
              Top rated
            </Chip>
            <Chip active={sort === "jobs"} onClick={() => setSort("jobs")}>
              Most jobs done
            </Chip>
            <Chip active={sort === "nearest"} onClick={() => setSort("nearest")}>
              Nearest
            </Chip>
          </div>

          {!home && (
            <div className="mt-4 rounded-xl p-4 bg-[var(--color-ochre-50)] border border-[var(--color-ochre-300)] text-sm text-[var(--color-ink-soft)]">
              Want workers sorted by distance?{" "}
              <Link href="/profile" className="underline font-medium text-[var(--color-ink)]">
                Pin your home location
              </Link>{" "}
              on your profile.
            </div>
          )}

          {/* List */}
          <div className="mt-8">
            {error ? (
              <p className="text-sm text-[var(--color-brick)]">{error}</p>
            ) : visible === null ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-44 rounded-xl bg-[var(--color-cream-2)] animate-pulse" />
                ))}
              </div>
            ) : visible.length === 0 ? (
              workers && workers.length === 0 ? (
                <div className="rounded-2xl p-8 sm:p-10 bg-[var(--color-paper)] border border-dashed border-[var(--color-line)] text-center">
                  <h3 className="font-display text-xl text-[var(--color-ink)]">
                    The worker bench is still filling up
                  </h3>
                  <p className="mt-2 text-sm text-[var(--color-ink-soft)] max-w-md mx-auto">
                    Workit is just getting going in your area. You don&apos;t have to find
                    someone here — post a job and verified workers nearby will send you
                    offers, often within the hour.
                  </p>
                  <div className="mt-5">
                    <Link
                      href="/post-a-job"
                      className="px-5 py-2.5 rounded-pill text-sm font-medium bg-[var(--color-ink)] text-[var(--color-cream)] hover:opacity-90"
                    >
                      + Post a job
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl p-10 bg-[var(--color-paper)] border border-dashed border-[var(--color-line)] text-center text-[var(--color-ink-muted)]">
                  No workers match these filters. Try widening — drop the
                  Verified-only or Available-now toggle, set Skill to
                  &quot;Any&quot;, or pick a different category.
                </div>
              )
            ) : (
              <>
                <p className="text-xs text-[var(--color-ink-muted)] mb-4">
                  Showing {visible.length} worker{visible.length === 1 ? "" : "s"}.
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {visible.map(({ worker: w, km }) => (
                    <WorkerCard key={w.uid} worker={w} km={km} />
                  ))}
                </div>
              </>
            )}
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}


function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-pill text-sm transition-colors ${
        active
          ? "bg-[var(--color-ink)] text-[var(--color-cream)]"
          : "bg-[var(--color-paper)] border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:bg-[var(--color-cream-2)]"
      }`}
    >
      {children}
    </button>
  );
}
