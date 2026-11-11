"use client";

/**
 * "Who you'd be working for" — an at-a-glance trust panel shown to a worker on a
 * job BEFORE they offer/accept and head to a stranger's place. Surfaces the
 * employer's accountability: rating, how many workers they've hired, how long
 * they've been on Workit, and any verification badges — plus a gentle caution
 * for brand-new accounts with no track record. Closes the asymmetry where
 * workers are ID-verified but employers were opaque to the person walking into
 * their home.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import Badge from "@/components/Badge";
import { getUserProfile } from "@/lib/jobs";
import type { Job, UserProfile } from "@/lib/types";

export default function EmployerTrust({ job }: { job: Job }) {
  const [emp, setEmp] = useState<UserProfile | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getUserProfile(job.employerId)
      .then((p) => {
        if (!cancelled) setEmp((p as UserProfile | null) ?? null);
      })
      .catch(() => {
        if (!cancelled) setEmp(null);
      });
    return () => {
      cancelled = true;
    };
  }, [job.employerId]);

  if (emp === undefined) {
    return <div className="mt-6 h-28 rounded-2xl bg-[var(--color-cream-2)] animate-pulse" />;
  }
  if (!emp) return null;

  const ratingCount = emp.ratingCount ?? 0;
  const ratingAvg = emp.ratingAvg;
  const hires = emp.employerJobsHired ?? 0;
  const isBusiness = emp.role === "business";
  const businessVerified = emp.businessVerification?.status === "approved";
  const idVerified = emp.verificationStatus === "approved";
  const memberSince = emp.createdAt
    ? new Date(emp.createdAt).toLocaleDateString("en-ZA", { month: "long", year: "numeric" })
    : null;
  const ageDays = emp.createdAt ? (Date.now() - emp.createdAt) / 86_400_000 : 999;
  const isNew = hires === 0 && ratingCount === 0 && ageDays < 21;
  const profileHref = isBusiness ? `/business?id=${emp.uid}` : `/u?id=${emp.uid}`;
  const name = job.employerName || emp.displayName || "This employer";

  return (
    <section className="mt-6 rounded-2xl p-5 sm:p-6 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold">
            Who you&apos;d be working for
          </p>
          <Link
            href={profileHref}
            target="_blank"
            className="mt-1 inline-block font-display text-lg text-[var(--color-ink)] hover:underline"
          >
            {name}
          </Link>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {businessVerified && <Badge tone="sage">✓ Registered business</Badge>}
          {idVerified && <Badge tone="sage">✓ ID verified</Badge>}
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
        <div>
          <dt className="text-xs text-[var(--color-ink-muted)]">Rating</dt>
          <dd className="mt-0.5 text-sm font-medium text-[var(--color-ink)]">
            {ratingCount > 0 ? `★ ${ratingAvg?.toFixed(1)} (${ratingCount})` : "No ratings yet"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--color-ink-muted)]">Workers hired</dt>
          <dd className="mt-0.5 text-sm font-medium text-[var(--color-ink)]">{hires}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--color-ink-muted)]">On Workit</dt>
          <dd className="mt-0.5 text-sm font-medium text-[var(--color-ink)]">{memberSince ?? "—"}</dd>
        </div>
      </dl>

      {isNew && (
        <p className="mt-3 rounded-lg bg-[var(--color-cream-2)] border border-[var(--color-line)] p-3 text-xs text-[var(--color-ink-soft)]">
          🛟 New to Workit — no track record yet. Before you go, share this job with a
          trusted contact and meet somewhere safe. An employer with ratings and a hiring
          history is a stronger sign you&apos;re in good hands.
        </p>
      )}
    </section>
  );
}
