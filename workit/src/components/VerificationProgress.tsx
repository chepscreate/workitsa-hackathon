"use client";

import Link from "next/link";
import type { UserProfile } from "@/lib/types";

/**
 * Visual progress bar showing how close a worker is to fully verified +
 * gold-badged. Derives steps from the existing profile.verification fields
 * — no extra writes. Acts as a nudge to finish each step.
 */

type Step = {
  id: string;
  label: string;
  done: boolean;
  // Weight 1 by default; gold badge is weighted more since it's optional
  weight?: number;
};

export default function VerificationProgress({ profile }: { profile: UserProfile }) {
  const v = profile.verification ?? {};
  const steps: Step[] = [
    { id: "id-number", label: "SA ID number", done: !!v.idNumber },
    { id: "id-photo", label: "ID photo", done: !!v.idPhotoURL },
    // Optional since 2026-07-12 — weight 0 keeps it out of the completion
    // count so workers without one aren't stuck at "almost done" forever.
    { id: "selfie", label: "Selfie video (optional)", done: !!v.selfieVideoURL, weight: 0 },
    { id: "address", label: "Address", done: !!v.addressLine },
    { id: "address-proof", label: "Proof of address", done: !!v.addressProofURL },
    { id: "skills", label: "Skills summary", done: !!v.skillsSummary },
    { id: "categories", label: "Categories", done: (profile.categories?.length ?? 0) > 0 },
    { id: "gold", label: "Gold (background check)", done: !!profile.backgroundVerified, weight: 0 },
  ];

  // Required-only score (gold excluded)
  const required = steps.filter((s) => (s.weight ?? 1) > 0);
  const done = required.filter((s) => s.done).length;
  const total = required.length;
  const pct = Math.round((done / total) * 100);

  const isApproved = profile.verificationStatus === "approved" || profile.accountStatus === "approved";
  const nextStep = steps.find((s) => !s.done);

  return (
    <section className="rounded-2xl p-5 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className="font-display text-lg">Verification progress</h3>
        <span className="font-display text-2xl text-[var(--color-ochre-600)] tabular-nums">
          {pct}%
        </span>
      </div>

      {/* Progress track */}
      <div className="h-2 rounded-full bg-[var(--color-cream-2)] overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[var(--color-ochre-500)] to-[var(--color-sage-600)] transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Step grid */}
      <ul className="mt-4 grid sm:grid-cols-2 gap-2">
        {steps.map((s) => (
          <li
            key={s.id}
            className={`flex items-center gap-2 text-sm ${
              s.done ? "text-[var(--color-ink)]" : "text-[var(--color-ink-muted)]"
            }`}
          >
            <span
              aria-hidden
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                s.done
                  ? "bg-[var(--color-sage-600)] text-white"
                  : "border border-[var(--color-line)]"
              }`}
            >
              {s.done ? "✓" : ""}
            </span>
            <span>{s.label}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      {!isApproved && nextStep && (
        <div className="mt-5 pt-4 border-t border-[var(--color-line)] flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-[var(--color-ink-soft)]">
            Next:{" "}
            <span className="font-medium text-[var(--color-ink)]">
              {nextStep.label}
            </span>
          </p>
          <Link
            href="/verification"
            className="px-4 py-2 rounded-pill bg-[var(--color-ink)] text-[var(--color-cream)] text-sm font-medium hover:bg-[var(--color-ink-soft)]"
          >
            Continue
          </Link>
        </div>
      )}
      {isApproved && !profile.backgroundVerified && (
        <div className="mt-5 pt-4 border-t border-[var(--color-line)] flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-[var(--color-ink-soft)]">
            Add your police clearance to earn the{" "}
            <span className="font-medium text-[var(--color-ochre-600)]">
              Gold badge
            </span>{" "}
            — employers can filter by it.
          </p>
          <Link
            href="/verification"
            className="px-4 py-2 rounded-pill border border-[var(--color-line)] text-sm hover:bg-[var(--color-cream-2)]"
          >
            Upload clearance
          </Link>
        </div>
      )}
    </section>
  );
}
