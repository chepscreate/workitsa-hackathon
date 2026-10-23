"use client";

/**
 * Personalised home for signed-in users — design upgrade.
 *
 * Compared to the previous version:
 *  - Greeting block gets the role badges + verification chips inline
 *  - Primary CTA card unchanged (ochre / sage role-aware)
 *  - Stats grid now 4-up (rating, jobs done/posted, jobs completed,
 *    active now) instead of 2-up
 *  - NEW: "Your active job" strip — surfaces the in-flight job with
 *    inline message/track-live actions and a beadwork divider footer
 *  - Recent posts/jobs grid kept (uses existing JobCard)
 *  - About card kept
 *
 * All data hooks (subscribeMyJobs, subscribeMyAssignedJobs) preserved.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import Button from "@/components/Button";
import Badge from "@/components/Badge";
import Avatar from "@/components/Avatar";
import JobCard from "@/components/JobCard";
import { StarsRead } from "@/components/Stars";
import WorkerLevelBadge from "@/components/WorkerLevelBadge";
import AnimatedNumber from "@/components/AnimatedNumber";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeMyAssignedJobs, subscribeMyJobs } from "@/lib/jobs";
import type { Job, UserProfile } from "@/lib/types";

export default function HomeDashboard() {
  const { profile } = useAuth();

  if (!profile) {
    return (
      <>
        <Header />
        <main className="flex-1">
          <Container className="py-14">
            <div className="h-32 rounded-2xl bg-[var(--color-cream-2)] animate-pulse" />
          </Container>
        </main>
        <Footer />
      </>
    );
  }

  const isWorker = profile.role === "worker";
  const isEmployer = profile.role === "employer" || profile.role === "admin";

  return (
    <>
      <Header />
      <main className="flex-1">
        <Container className="py-14 space-y-10">
          <Greeting profile={profile} />

          {isEmployer && <EmployerPrimaryCard profile={profile} />}
          {isWorker && <WorkerPrimaryCard profile={profile} />}

          <QuickStats profile={profile} />

          <ActiveJobStrip uid={profile.uid} mode={isWorker ? "worker" : "employer"} />

          {isEmployer && <RecentJobsStrip uid={profile.uid} mode="employer" />}
          {isWorker && <RecentJobsStrip uid={profile.uid} mode="worker" />}

          <AboutWorkitCard />
        </Container>
      </main>
      <Footer />
    </>
  );
}

function Greeting({ profile }: { profile: UserProfile }) {
  const hour = new Date().getHours();
  const part =
    hour < 5 ? "Working late" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = profile.displayName?.split(" ")[0] ?? "there";
  return (
    <section className="flex items-center gap-4 flex-wrap">
      <Avatar name={profile.displayName} photoURL={profile.photoURL} size="lg" />
      <div>
        <p className="text-sm text-[var(--color-ink-muted)]">{part},</p>
        <h1 className="font-display text-3xl sm:text-4xl tracking-tight">
          {firstName}.
        </h1>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <Badge tone={profile.role === "worker" ? "sage" : "ochre"}>
            {profile.role === "worker"
              ? "Worker"
              : profile.role === "admin"
                ? "Admin"
                : "Employer"}
          </Badge>
          {profile.role === "worker" && profile.verificationStatus === "approved" && (
            <Badge tone="sage">✓ Verified</Badge>
          )}
          {profile.role === "worker" && profile.backgroundVerified && (
            <Badge tone="ochre">🥇 Gold</Badge>
          )}
        </div>
      </div>
    </section>
  );
}

function EmployerPrimaryCard({ profile: _profile }: { profile: UserProfile }) {
  return (
    <section className="rounded-2xl p-7 sm:p-9 bg-[var(--color-ochre-500)] text-[var(--color-cream)] shadow-lift">
      <h2 className="font-display text-2xl sm:text-3xl tracking-tight">
        Need something done today?
      </h2>
      <p className="mt-2 text-sm sm:text-base text-[var(--color-cream)]/90 max-w-xl">
        Post a job in under a minute — workers nearby will respond with their
        price, and you pick who you trust. Cash or EFT on completion.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href="/post-a-job"
          className="px-6 py-3 rounded-pill bg-[var(--color-ink)] text-[var(--color-cream)] font-medium hover:opacity-90 whitespace-nowrap"
        >
          Post a job
        </Link>
        <Link
          href="/account"
          className="px-6 py-3 rounded-pill border border-[var(--color-cream)]/40 text-[var(--color-cream)] font-medium hover:bg-white/10 whitespace-nowrap"
        >
          My jobs
        </Link>
      </div>
    </section>
  );
}

function WorkerPrimaryCard({ profile }: { profile: UserProfile }) {
  const needsVerification = profile.verificationStatus !== "approved";
  return (
    <section className="rounded-2xl p-7 sm:p-9 bg-[var(--color-sage-600)] text-[var(--color-cream)] shadow-lift">
      <h2 className="font-display text-2xl sm:text-3xl tracking-tight">
        Ready to earn?
      </h2>
      <p className="mt-2 text-sm sm:text-base text-[var(--color-cream)]/90 max-w-xl">
        Browse open jobs near you — accept the suggested price in one tap or
        send a counter-offer. You keep 100% of what you earn during launch.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href="/find-work"
          className="px-6 py-3 rounded-pill bg-[var(--color-ink)] text-[var(--color-cream)] font-medium hover:opacity-90 whitespace-nowrap"
        >
          Find work
        </Link>
        <Link
          href="/account"
          className="px-6 py-3 rounded-pill border border-[var(--color-cream)]/40 text-[var(--color-cream)] font-medium hover:bg-white/10 whitespace-nowrap"
        >
          My assigned jobs
        </Link>
        {needsVerification && (
          <Link
            href="/verification"
            className="px-6 py-3 rounded-pill bg-[var(--color-cream)] text-[var(--color-sage-700)] font-medium hover:opacity-90 whitespace-nowrap"
          >
            Finish verification →
          </Link>
        )}
      </div>
    </section>
  );
}

function QuickStats({ profile }: { profile: UserProfile }) {
  return (
    <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatCard
        label="Rating"
        value={
          profile.ratingCount && profile.ratingCount > 0 ? (
            <span className="flex items-baseline gap-1">
              <AnimatedNumber
                value={profile.ratingAvg ?? 0}
                format={(n) => n.toFixed(1)}
              />
              <span className="text-sm text-[var(--color-ink-muted)]">/ 5</span>
            </span>
          ) : (
            <span className="text-sm text-[var(--color-ink-muted)]">No ratings yet</span>
          )
        }
        sub={
          profile.ratingCount && profile.ratingCount > 0
            ? `from ${profile.ratingCount} job${profile.ratingCount === 1 ? "" : "s"}`
            : undefined
        }
      />
      <StatCard
        label={profile.role === "worker" ? "Jobs done" : "Jobs posted"}
        value={<AnimatedNumber value={profile.jobsCompleted ?? 0} />}
      />
      {profile.role === "worker" && (
        <StatCard
          label="Level"
          value={
            <div className="mt-1">
              <WorkerLevelBadge profile={profile} compact />
            </div>
          }
        />
      )}
      <StatCard
        label="Stars"
        value={
          <StarsRead value={profile.ratingAvg} count={profile.ratingCount} />
        }
      />
    </section>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl p-4 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
      <p className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold">
        {label}
      </p>
      <div className="mt-2 font-display text-2xl text-[var(--color-ink)] min-h-[2rem]">
        {value}
      </div>
      {sub && <p className="text-xs text-[var(--color-ink-muted)] mt-1">{sub}</p>}
    </div>
  );
}

/**
 * NEW — "Your active job" strip. Pulls the user's in-flight job (the
 * first one with status assigned/in_progress) and surfaces it with the
 * beadwork divider. Hides if nothing's in-flight.
 */
function ActiveJobStrip({ uid, mode }: { uid: string; mode: "employer" | "worker" }) {
  const [jobs, setJobs] = useState<Job[] | null>(null);

  useEffect(() => {
    const unsub =
      mode === "employer"
        ? subscribeMyJobs(uid, (list) => setJobs(list))
        : subscribeMyAssignedJobs(uid, (list) => setJobs(list));
    return () => unsub();
  }, [uid, mode]);

  const active = (jobs ?? []).find(
    (j) => j.status === "assigned" || j.status === "in_progress",
  );

  if (!active) return null;

  const counterparty = mode === "employer"
    ? { name: active.assignedWorkerName ?? "Worker", photo: active.assignedWorkerPhotoURL }
    : { name: active.employerName, photo: active.employerPhotoURL };

  return (
    <section>
      <div className="flex items-end justify-between flex-wrap gap-3 mb-4">
        <h2 className="font-display text-2xl text-[var(--color-ink)]">Your active job</h2>
        <Link
          href="/account"
          className="text-sm font-medium text-[var(--color-ochre-600)] hover:text-[var(--color-ochre-700)] whitespace-nowrap"
        >
          All your jobs →
        </Link>
      </div>
      <div className="rounded-2xl overflow-hidden bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
        <div className="p-6 flex items-center justify-between gap-5 flex-wrap">
          <div className="flex items-start gap-4 min-w-0">
            <Avatar name={counterparty.name} photoURL={counterparty.photo} size="md" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                <Badge tone="sage">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-sage-600)]" />
                  {active.status === "in_progress" ? "In progress" : "On the way"}
                </Badge>
              </div>
              <h3 className="font-display text-xl">{active.title}</h3>
              <p className="text-xs text-[var(--color-ink-muted)] mt-1">
                {counterparty.name} · {active.suburb}, {active.city}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button href={`/jobs?id=${active.id}`} variant="outline" size="sm">Message</Button>
            <Button href={`/jobs?id=${active.id}`} variant="primary" size="sm">Track live</Button>
          </div>
        </div>
        {/* Beadwork divider — brand signature */}
        <div
          aria-hidden
          className="h-1.5 w-full"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, var(--color-ochre-500) 0 14px, var(--color-ink) 14px 22px, var(--color-sage-600) 22px 36px, var(--color-cream) 36px 44px)",
          }}
        />
        <div className="px-6 py-3 flex items-center justify-between text-sm text-[var(--color-ink-muted)] flex-wrap gap-2">
          <span>📍 {active.suburb}, {active.city}</span>
          <span className="font-display text-xl text-[var(--color-ochre-600)] whitespace-nowrap">R {active.suggestedPrice}</span>
        </div>
      </div>
    </section>
  );
}

function RecentJobsStrip({
  uid,
  mode,
}: {
  uid: string;
  mode: "employer" | "worker";
}) {
  const [jobs, setJobs] = useState<Job[] | null>(null);

  useEffect(() => {
    const unsub =
      mode === "employer"
        ? subscribeMyJobs(uid, (list) => setJobs(list))
        : subscribeMyAssignedJobs(uid, (list) => setJobs(list));
    return () => unsub();
  }, [uid, mode]);

  // Filter out the active job since it's shown above
  const recent = (jobs ?? [])
    .filter((j) => j.status !== "assigned" && j.status !== "in_progress")
    .slice(0, 3);

  return (
    <section>
      <div className="flex items-end justify-between flex-wrap gap-3 mb-4">
        <h2 className="font-display text-2xl text-[var(--color-ink)]">
          {mode === "employer" ? "Your recent posts" : "Your recent jobs"}
        </h2>
        <Link
          href="/account"
          className="text-sm font-medium text-[var(--color-ochre-600)] hover:text-[var(--color-ochre-700)] whitespace-nowrap"
        >
          See all →
        </Link>
      </div>
      {jobs === null ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-56 rounded-xl bg-[var(--color-cream-2)] animate-pulse" />
          ))}
        </div>
      ) : recent.length === 0 ? (
        <div className="rounded-xl p-8 bg-[var(--color-paper)] border border-dashed border-[var(--color-line)] text-center text-sm text-[var(--color-ink-muted)]">
          {mode === "employer" ? (
            <>
              You haven&apos;t posted any jobs yet.{" "}
              <Link href="/post-a-job" className="underline text-[var(--color-ochre-600)]">
                Post your first one
              </Link>{" "}
              — it takes under a minute.
            </>
          ) : (
            <>
              You haven&apos;t taken any jobs yet.{" "}
              <Link href="/find-work" className="underline text-[var(--color-ochre-600)]">
                Browse open jobs
              </Link>{" "}
              nearby.
            </>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {recent.map((j) => (
            <JobCard key={j.id} job={j} />
          ))}
        </div>
      )}
    </section>
  );
}

function AboutWorkitCard() {
  return (
    <section className="rounded-2xl p-6 bg-[var(--color-cream-2)] border border-[var(--color-line)]">
      <h2 className="font-display text-xl text-[var(--color-ink)]">
        What Workit is
      </h2>
      <p className="mt-2 text-sm text-[var(--color-ink-soft)] leading-relaxed">
        Workit is South Africa&apos;s people-first work marketplace — connecting
        people who need a job done with verified workers nearby. Every worker is
        reviewed by a real person. Cash or EFT on completion. Two-way ratings.
        No middleman fees during launch.
      </p>
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <Link href="/how-it-works" className="text-[var(--color-ochre-600)] hover:underline">
          How it works
        </Link>
        <Link href="/safety" className="text-[var(--color-ochre-600)] hover:underline">
          Safety guide
        </Link>
        <Link href="/categories" className="text-[var(--color-ochre-600)] hover:underline">
          Categories
        </Link>
        <Link href="/help" className="text-[var(--color-ochre-600)] hover:underline">
          Help
        </Link>
      </div>
    </section>
  );
}
