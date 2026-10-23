"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import Badge from "@/components/Badge";
import AccountGate from "@/components/AccountGate";
import JobCard from "@/components/JobCard";
import { JobCardSkeletonGrid } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import RecentlyViewedStrip from "@/components/RecentlyViewedStrip";
import AvailableNowCard from "@/components/AvailableNowCard";
import { subscribeOpenJobs } from "@/lib/jobs";
import { startTrace } from "@/lib/performance";
import { CATEGORIES, isBoosted, type CategoryId, type Job } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { haversineKm } from "@/lib/geo";
import { scoreJobForWorker } from "@/lib/matching";
import { saveJob, subscribeSavedJobIds, unsaveJob } from "@/lib/saved";
import {
  deleteSavedSearch,
  saveSearch,
  subscribeSavedSearches,
} from "@/lib/savedSearches";
import type { SavedSearch } from "@/lib/types";
import Link from "next/link";
import { useTranslation } from "@/contexts/LocaleContext";
import type { Messages } from "@/i18n/locales";

type Radius = 5 | 10 | 25 | 50 | "all";
type SortMode = "best" | "nearest" | "newest" | "highest" | "lowest";
type ViewMode = "list" | "map";

// Leaflet touches `window` at import time — load only on the client.
const JobsMap = dynamic(() => import("@/components/JobsMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full grid place-items-center bg-[var(--color-cream-2)] text-sm text-[var(--color-ink-muted)]">
      Loading map…
    </div>
  ),
});

// "5 km" etc. read the same in en/af/zu — only "Any distance" is translated.
const RADII: { value: Radius; label: string }[] = [
  { value: 5, label: "5 km" },
  { value: 10, label: "10 km" },
  { value: 25, label: "25 km" },
  { value: 50, label: "50 km" },
  { value: "all", label: "" }, // label comes from t("findWork.radius.any")
];

const SORTS: { value: SortMode; labelKey: keyof Messages }[] = [
  { value: "best", labelKey: "findWork.sort.best" },
  { value: "nearest", labelKey: "findWork.sort.nearest" },
  { value: "newest", labelKey: "findWork.sort.newest" },
  { value: "highest", labelKey: "findWork.sort.highest" },
  { value: "lowest", labelKey: "findWork.sort.lowest" },
];

/** Translated name for a category id (keys are `category.{id}` in Messages). */
const categoryKey = (id: string) => `category.${id}` as keyof Messages;

export default function FindWorkPage() {
  // Sign-in required — signed-out visitors are redirected to /signin. The job
  // feed (and worker contact surface) is members-only on both desktop + mobile.
  return (
    <AccountGate requireSignIn>
      <Suspense fallback={null}>
        <FindWorkInner />
      </Suspense>
    </AccountGate>
  );
}

function FindWorkInner() {
  const { t } = useTranslation();
  const { user, profile, loading: authLoading, configured } = useAuth();
  const searchParams = useSearchParams();
  const initialCategory = (() => {
    const raw = searchParams.get("category");
    if (!raw) return "all" as const;
    return (CATEGORIES.find((c) => c.id === raw)?.id ?? "all") as CategoryId | "all";
  })();
  const [filter, setFilter] = useState<CategoryId | "all">(initialCategory);
  // Default to "Any distance" while the marketplace is still thin: a 25km cap
  // hides the handful of real jobs when liquidity is low. Revisit (back to 25km)
  // once a suburb has enough density that distance is the useful default. (2026-09-30)
  const [radius, setRadius] = useState<Radius>("all");
  const [sort, setSort] = useState<SortMode>("best");
  const [view, setView] = useState<ViewMode>("list");
  const [searchQuery, setSearchQuery] = useState("");
  // Filters collapse by default so the results lead the page. Search stays
  // always-visible; category/distance/sort live behind the toggle.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [savingSearch, setSavingSearch] = useState(false);

  // Subscribe to this user's saved-job IDs so we can show heart state on cards
  useEffect(() => {
    if (!user) {
      setSavedIds(new Set());
      return;
    }
    const unsub = subscribeSavedJobIds(user.uid, setSavedIds);
    return () => unsub();
  }, [user]);

  // Saved searches subscription (workers only — employers don't browse for work)
  useEffect(() => {
    if (!user || profile?.role !== "worker") {
      setSavedSearches([]);
      return;
    }
    const unsub = subscribeSavedSearches(user.uid, setSavedSearches);
    return () => unsub();
  }, [user, profile?.role]);

  const onSaveCurrentSearch = async () => {
    if (!user || savingSearch) return;
    setSavingSearch(true);
    try {
      await saveSearch(user.uid, {
        category: filter,
        keyword: searchQuery,
        radiusKm: radius,
      });
    } finally {
      setSavingSearch(false);
    }
  };

  const applySavedSearch = (s: SavedSearch) => {
    setFilter(s.category);
    setRadius(s.radiusKm);
    setSearchQuery(s.keyword ?? "");
  };

  const onDeleteSavedSearch = async (id: string) => {
    if (!user) return;
    await deleteSavedSearch(user.uid, id);
  };

  const toggleSave = async (jobId: string) => {
    if (!user) return;
    if (savedIds.has(jobId)) await unsaveJob(user.uid, jobId);
    else await saveJob(user.uid, jobId);
  };

  const home =
    profile && typeof profile.homeLat === "number" && typeof profile.homeLng === "number"
      ? { lat: profile.homeLat, lng: profile.homeLng }
      : null;

  useEffect(() => {
    if (!configured) return;
    setJobs(null);
    setError(null);
    // Perf: time from subscribe → first snapshot painted (feed ready).
    const stopTrace = startTrace("load_jobs_list");
    let firstSnapshot = true;
    const unsub = subscribeOpenJobs(
      filter === "all" ? undefined : filter,
      (list) => {
        if (firstSnapshot) {
          firstSnapshot = false;
          stopTrace();
        }
        setJobs(list);
      },
    );
    return () => {
      stopTrace();
      unsub();
    };
  }, [filter, configured]);

  // Compute distances, apply search, radius filter, then sort
  const visibleJobs = useMemo(() => {
    if (!jobs) return null;

    const q = searchQuery.trim().toLowerCase();

    // Drop jobs from blocked employers
    const blocked = new Set(profile?.blockedUserIds ?? []);
    const sourceJobs = blocked.size > 0
      ? jobs.filter((j) => !blocked.has(j.employerId))
      : jobs;

    // Annotate with distance (if home is known + job has coords)
    let annotated = sourceJobs.map((j) => {
      const km =
        home && typeof j.lat === "number" && typeof j.lng === "number"
          ? haversineKm(home.lat, home.lng, j.lat, j.lng)
          : undefined;
      return {
        job: j,
        km,
        score: scoreJobForWorker(j, { categories: profile?.categories, km }),
      };
    });

    // Keyword filter — title + description + suburb
    if (q) {
      annotated = annotated.filter(({ job }) => {
        const blob = `${job.title} ${job.description} ${job.suburb}`.toLowerCase();
        return blob.includes(q);
      });
    }

    // Radius filter (only meaningful if home is set)
    if (home && radius !== "all") {
      annotated = annotated.filter((x) => x.km === undefined || x.km <= radius);
    }

    // Sort — boosted (paid/featured) first, then urgent, then the chosen sort
    annotated.sort((a, b) => {
      const aBoost = isBoosted(a.job) ? 1 : 0;
      const bBoost = isBoosted(b.job) ? 1 : 0;
      if (aBoost !== bBoost) return bBoost - aBoost;
      const aUrgent = a.job.urgent ? 1 : 0;
      const bUrgent = b.job.urgent ? 1 : 0;
      if (aUrgent !== bUrgent) return bUrgent - aUrgent;
      switch (sort) {
        case "best":
          return b.score - a.score;
        case "newest":
          return (b.job.createdAt ?? 0) - (a.job.createdAt ?? 0);
        case "highest":
          return (b.job.suggestedPrice ?? 0) - (a.job.suggestedPrice ?? 0);
        case "lowest":
          return (a.job.suggestedPrice ?? 0) - (b.job.suggestedPrice ?? 0);
        case "nearest":
        default:
          // Jobs with distance first (asc), then no-distance jobs.
          if (a.km === undefined && b.km === undefined) return 0;
          if (a.km === undefined) return 1;
          if (b.km === undefined) return -1;
          return a.km - b.km;
      }
    });

    return annotated.map(
      (x) => ({ ...x.job, _distanceKm: x.km }) as Job & { _distanceKm?: number },
    );
  }, [jobs, home, radius, sort, searchQuery, profile?.categories]);

  // Collapsed-filter summary + active-count badge (defaults: all / any / best).
  const catLabel = filter === "all" ? t("findWork.filter.all") : t(categoryKey(filter));
  const distLabel = radius === "all" ? t("findWork.radius.any") : `${radius} km`;
  const sortLabel = t(SORTS.find((s) => s.value === sort)?.labelKey ?? "findWork.sort.best");
  const activeFilterCount =
    (filter !== "all" ? 1 : 0) + (radius !== "all" ? 1 : 0) + (sort !== "best" ? 1 : 0);
  const filterSummary = [catLabel, distLabel, sortLabel].join(" · ");

  return (
    <>
      <Header />
      <main className="flex-1">
        <Container className="py-14">
          <Badge tone="sage">{t("findWork.badge")}</Badge>
          <h1 className="mt-4 font-display text-4xl sm:text-5xl tracking-tight">
            {t("findWork.title")}
          </h1>
          <p className="mt-3 text-[var(--color-ink-soft)] max-w-2xl">
            {t("findWork.intro")}
          </p>

          {/* Filter bar — search stays visible; category/distance/sort collapse
              behind a "Filters" toggle so results lead the page. Progressive
              disclosure keeps it calm when the feed is sparse and out of the
              way when it's full. */}
          <div className="mt-8 rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)]/70 backdrop-blur-sm p-5 space-y-4 shadow-soft">
          {/* Search — always visible */}
          <div>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("findWork.search.placeholder")}
              aria-label={t("findWork.search.placeholder")}
              className="w-full px-4 py-3 rounded-pill bg-[var(--color-paper)] border border-[var(--color-line)] focus:border-[var(--color-ochre-500)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ochre-300)] transition-[border-color,box-shadow] text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)] text-sm"
            />
          </div>

          {/* Filters toggle + collapsed summary */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-pill text-sm border border-[var(--color-line)] bg-[var(--color-paper)] text-[var(--color-ink-soft)] hover:bg-[var(--color-cream-2)] hover:text-[var(--color-ink)] transition-colors"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="4" y1="6" x2="20" y2="6" /><circle cx="9" cy="6" r="2" fill="currentColor" />
                <line x1="4" y1="12" x2="20" y2="12" /><circle cx="15" cy="12" r="2" fill="currentColor" />
                <line x1="4" y1="18" x2="20" y2="18" /><circle cx="8" cy="18" r="2" fill="currentColor" />
              </svg>
              {t("findWork.filtersBtn")}
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-[var(--color-ochre-500)] text-[var(--color-cream)] text-xs font-semibold">
                  {activeFilterCount}
                </span>
              )}
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`transition-transform ${filtersOpen ? "rotate-180" : ""}`}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {!filtersOpen && (
              <span className="text-xs text-[var(--color-ink-muted)] truncate">{filterSummary}</span>
            )}
          </div>

          {/* Collapsible: category, distance, sort */}
          {filtersOpen && (
            <div className="space-y-4 pt-1">
              <div className="flex flex-wrap gap-2">
                <Chip active={filter === "all"} onClick={() => setFilter("all")}>
                  {t("findWork.filter.all")}
                </Chip>
                {CATEGORIES.map((c) => (
                  <Chip key={c.id} active={filter === c.id} onClick={() => setFilter(c.id)}>
                    {t(categoryKey(c.id))}
                  </Chip>
                ))}
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
                  {t("findWork.filter.distance")}
                </span>
                {RADII.map((r) => (
                  <Chip key={String(r.value)} active={radius === r.value} onClick={() => setRadius(r.value)}>
                    {r.value === "all" ? t("findWork.radius.any") : r.label}
                  </Chip>
                ))}
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
                  {t("findWork.filter.sort")}
                </span>
                {SORTS.map((s) => (
                  <Chip key={s.value} active={sort === s.value} onClick={() => setSort(s.value)}>
                    {t(s.labelKey)}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          </div>

          {/* Approved workers get the "available now" toggle (visible-to-employers
              self-flag). Workers who can't offer yet get a status-aware verify
              nudge instead, so they know why "Send offer" is blocked. */}
          {profile && profile.role === "worker" && profile.verificationStatus === "approved" && (
            <div className="mt-6">
              <AvailableNowCard profile={profile} />
            </div>
          )}
          {profile && profile.role === "worker" && (profile.verificationStatus ?? "none") !== "approved" && (
            <div className="mt-4 rounded-xl p-4 bg-[var(--color-ochre-50)] border border-[var(--color-ochre-300)] text-sm text-[var(--color-ink-soft)] flex items-center justify-between gap-3 flex-wrap">
              <span>
                {profile.verificationStatus === "pending"
                  ? "Your verification is under review — you'll be able to send offers as soon as you're approved."
                  : profile.verificationStatus === "changes_requested"
                    ? "We need a quick update to your verification before you can send offers."
                    : "Verify your identity to send offers and get hired — it only takes a few minutes."}
              </span>
              {profile.verificationStatus !== "pending" && (
                <Link
                  href="/verification"
                  className="px-4 py-2 rounded-pill bg-[var(--color-ink)] text-[var(--color-cream)] text-sm whitespace-nowrap"
                >
                  {profile.verificationStatus === "changes_requested" ? "Update documents" : "Verify now"}
                </Link>
              )}
            </div>
          )}

          {!user && !authLoading && (
            <div className="mt-4 rounded-xl p-4 bg-[var(--color-ochre-50)] border border-[var(--color-ochre-300)] text-sm text-[var(--color-ink-soft)] flex items-center justify-between gap-3 flex-wrap">
              <span>
                Just browsing? You can preview any job.{" "}
                <Link href="/signup?role=worker" className="underline font-medium text-[var(--color-ink)]">
                  Sign up
                </Link>{" "}
                to send offers and start earning.
              </span>
              <Link
                href="/signup?role=worker"
                className="px-4 py-2 rounded-pill bg-[var(--color-ink)] text-[var(--color-cream)] text-sm whitespace-nowrap"
              >
                Become a worker
              </Link>
            </div>
          )}
          {!home && user && (
            <div className="mt-4 rounded-xl p-4 bg-[var(--color-ochre-50)] border border-[var(--color-ochre-300)] text-sm text-[var(--color-ink-soft)] flex items-center justify-between gap-3 flex-wrap">
              <span>
                {t("findWork.homeNudge.before")}
                <Link href="/profile" className="underline font-medium text-[var(--color-ink)]">
                  {t("findWork.homeNudge.link")}
                </Link>
                {t("findWork.homeNudge.after")}
              </span>
            </div>
          )}

          {/* Saved searches — workers can save the current filter set and get
              a toast when matching new jobs land. */}
          {user && profile?.role === "worker" && (
            <section className="mt-6">
              <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
                <h2 className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold">
                  {t("findWork.saved.title")}
                </h2>
                <button
                  type="button"
                  onClick={onSaveCurrentSearch}
                  disabled={savingSearch}
                  className="text-xs px-3 py-1.5 rounded-pill border border-dashed border-[var(--color-line)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] hover:border-[var(--color-ochre-500)] disabled:opacity-50"
                  title={t("findWork.saved.saveTitle")}
                >
                  {savingSearch ? t("findWork.saved.saving") : t("findWork.saved.save")}
                </button>
              </div>
              {savedSearches.length === 0 ? (
                <p className="text-xs text-[var(--color-ink-muted)]">
                  {t("findWork.saved.emptyPre")}
                  <b>{t("findWork.saved.emptyBold")}</b>
                  {t("findWork.saved.emptyPost")}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {savedSearches.map((s) => {
                    const catLabel =
                      s.category === "all"
                        ? t("findWork.saved.allCategories")
                        : CATEGORIES.some((c) => c.id === s.category)
                          ? t(categoryKey(s.category))
                          : s.category;
                    const summary = [
                      catLabel,
                      s.keyword ? `"${s.keyword}"` : null,
                      s.radiusKm === "all" ? null : `≤${s.radiusKm}km`,
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <div
                        key={s.id}
                        className="inline-flex items-center bg-[var(--color-paper)] border border-[var(--color-line)] rounded-pill overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => applySavedSearch(s)}
                          className="px-3 py-1.5 text-xs hover:bg-[var(--color-cream-2)] text-[var(--color-ink-soft)]"
                          title={t("findWork.saved.applyTitle")}
                        >
                          {s.name || summary}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteSavedSearch(s.id)}
                          aria-label={t("findWork.saved.delete")}
                          className="px-2 py-1.5 text-[var(--color-ink-muted)] hover:text-[var(--color-brick)] border-l border-[var(--color-line)]"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Only surface "recently viewed" once the live feed is healthy — with
              a sparse feed the strip can show more cards than actual results,
              which reads as "there are more jobs than there are". */}
          {visibleJobs && visibleJobs.length >= 3 && <RecentlyViewedStrip />}

          <div className="mt-8">
            {/* Result count — gives the feed a sense of "how much is here" and
                echoes the active radius so filters feel connected to results. */}
            {visibleJobs && visibleJobs.length > 0 && (
              <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
                <h2 className="font-display text-xl text-[var(--color-ink)]">
                  {visibleJobs.length === 1
                    ? t("findWork.results.one", { count: visibleJobs.length })
                    : t("findWork.results.many", { count: visibleJobs.length })}
                  {filter !== "all" && (
                    <span className="text-[var(--color-ink-muted)]">
                      {" "}
                      {t("findWork.results.inCategory", { category: t(categoryKey(filter)) })}
                    </span>
                  )}
                </h2>
                <div className="flex items-center gap-3">
                  {home && radius !== "all" && (
                    <span className="hidden sm:inline text-xs text-[var(--color-ink-muted)]">
                      {t("findWork.results.within", { radius })}
                    </span>
                  )}
                  {/* List / Map view toggle */}
                  <div className="inline-flex p-0.5 rounded-pill bg-[var(--color-cream-2)] border border-[var(--color-line)]">
                    <button
                      type="button"
                      onClick={() => setView("list")}
                      aria-pressed={view === "list"}
                      className={`px-3 py-1.5 rounded-pill text-xs font-medium transition-colors ${
                        view === "list"
                          ? "bg-[var(--color-paper)] shadow-soft text-[var(--color-ink)]"
                          : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                      }`}
                    >
                      ☰ {t("findWork.view.list")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setView("map")}
                      aria-pressed={view === "map"}
                      className={`px-3 py-1.5 rounded-pill text-xs font-medium transition-colors ${
                        view === "map"
                          ? "bg-[var(--color-paper)] shadow-soft text-[var(--color-ink)]"
                          : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                      }`}
                    >
                      ⌖ {t("findWork.view.map")}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {!configured ? (
              <Empty>
                Firebase isn&apos;t connected. See{" "}
                <Link href="/setup" className="underline">/setup</Link>.
              </Empty>
            ) : authLoading ? (
              <JobCardSkeletonGrid />
            ) : error ? (
              <Empty>
                <span className="text-[var(--color-brick)]">{error}</span>
              </Empty>
            ) : visibleJobs === null ? (
              <JobCardSkeletonGrid />
            ) : visibleJobs.length === 0 ? (
              jobs && jobs.length > 0 ? (
                <EmptyState
                  kind="no-results"
                  title={t("findWork.empty.noResults.title")}
                  body={t("findWork.empty.noResults.body")}
                />
              ) : (
                <EmptyState
                  kind="no-jobs"
                  title={t("findWork.empty.early.title")}
                  body={t("findWork.empty.early.body")}
                  action={
                    <div className="flex flex-col sm:flex-row flex-wrap gap-2 justify-center">
                      <Link
                        href={profile?.verificationStatus === "approved" ? "/account" : "/verification"}
                        className="px-5 py-2.5 rounded-pill text-sm font-medium bg-[var(--color-ink)] text-[var(--color-cream)] hover:opacity-90"
                      >
                        {profile?.verificationStatus === "approved"
                          ? t("findWork.empty.early.ctaAlerts")
                          : t("findWork.empty.early.ctaVerify")}
                      </Link>
                      {profile?.verificationStatus === "approved" && (
                        <Link
                          href="/profile"
                          className="px-4 py-2.5 rounded-pill text-sm border border-[var(--color-line)] bg-[var(--color-paper)] hover:bg-[var(--color-cream)] text-[var(--color-ink)]"
                        >
                          {t("findWork.empty.early.ctaProfile")}
                        </Link>
                      )}
                      <Link
                        href="/account"
                        className="px-4 py-2.5 rounded-pill text-sm border border-[var(--color-line)] bg-[var(--color-paper)] hover:bg-[var(--color-cream)] text-[var(--color-ink)]"
                      >
                        {t("findWork.empty.early.ctaInvite")}
                      </Link>
                    </div>
                  }
                />
              )
            ) : view === "map" ? (
              (() => {
                const mappable = visibleJobs.filter(
                  (j) => typeof j.lat === "number" && typeof j.lng === "number",
                );
                const hidden = visibleJobs.length - mappable.length;
                return (
                  <div>
                    <div className="h-[460px] sm:h-[560px] w-full rounded-2xl overflow-hidden border border-[var(--color-line)] shadow-soft">
                      {mappable.length > 0 ? (
                        <JobsMap jobs={mappable} home={home} />
                      ) : (
                        <div className="h-full grid place-items-center text-center p-6 bg-[var(--color-cream-2)]">
                          <p className="text-sm text-[var(--color-ink-muted)]">
                            {t("findWork.map.nonePinnedPre")}
                            <button
                              type="button"
                              onClick={() => setView("list")}
                              className="underline text-[var(--color-ink)]"
                            >
                              {t("findWork.map.nonePinnedLink")}
                            </button>
                            .
                          </p>
                        </div>
                      )}
                    </div>
                    {hidden > 0 && mappable.length > 0 && (
                      <p className="mt-2 text-xs text-[var(--color-ink-muted)]">
                        {hidden === 1
                          ? t("findWork.map.hiddenOne", { count: hidden })
                          : t("findWork.map.hiddenMany", { count: hidden })}
                      </p>
                    )}
                  </div>
                );
              })()
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {visibleJobs.map((j) => (
                  <JobCard
                    key={j.id}
                    job={j}
                    distanceKm={(j as Job & { _distanceKm?: number })._distanceKm}
                    saved={savedIds.has(j.id)}
                    onToggleSave={user ? () => toggleSave(j.id) : undefined}
                    viewerUid={user?.uid}
                  />
                ))}
              </div>
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

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-10 bg-[var(--color-paper)] border border-dashed border-[var(--color-line)] text-center text-[var(--color-ink-muted)]">
      {children}
    </div>
  );
}
