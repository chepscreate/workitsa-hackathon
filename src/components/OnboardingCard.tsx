"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { UserRole } from "@/lib/types";

const STORAGE_KEY = "workit_onboarding_dismissed_v1";

const STEPS: Record<UserRole, Array<{ title: string; body: string; href?: string; cta?: string }>> = {
  worker: [
    { title: "1. Finish your profile", body: "Add a photo, your home location and a short bio. Trust = jobs.", href: "/profile", cta: "Edit profile" },
    { title: "2. Verify your account", body: "Submit ID, selfie video, address proof and skill proof. We review within 1–2 days.", href: "/verification", cta: "Start verification" },
    { title: "3. Browse jobs near you", body: "Filter by category and distance. Save your favourites with the ♡ button.", href: "/find-work", cta: "Find work" },
  ],
  employer: [
    { title: "1. Post your first job", body: "Be specific. Add a fair price. Workers will respond with their offers.", href: "/post-a-job", cta: "Post a job" },
    { title: "2. Review the offers", body: "Pick the worker whose price and rating you like. Cash on completion.", href: "/find-work", cta: "Browse" },
    { title: "3. Stay safe", body: "Use in-app chat, live tracking and the SOS button on every active job.", href: "/safety", cta: "Read the safety guide"},
  ],
  business: [
    { title: "1. Complete your business profile", body: "Add your logo, what you do and the areas you serve — workers see this before accepting your jobs.", href: "/business/edit", cta: "Set up profile" },
    { title: "2. Post your first job", body: "Be specific, add a fair price. Verified workers nearby will respond with offers.", href: "/post-a-job", cta: "Post a job" },
    { title: "3. Hire + build your reputation", body: "Pick a worker, pay on completion, rate each other. A strong rating wins better workers.", href: "/find-work", cta: "Browse" },
  ],
  admin: [],
};

export default function OnboardingCard({ role }: { role: UserRole }) {
  const [dismissed, setDismissed] = useState(true); // hide by default until we know

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  const steps = STEPS[role] ?? [];
  if (dismissed || steps.length === 0) return null;

  const dismiss = () => {
    setDismissed(true);
    window.localStorage.setItem(STORAGE_KEY, "true");
  };

  return (
    <section className="relative rounded-2xl p-6 mb-6 bg-gradient-to-br from-[var(--color-ochre-50)] to-[var(--color-cream-2)] border border-[var(--color-ochre-300)] animate-slide-up">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss tips"
        className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-[var(--color-ink-muted)] hover:bg-[var(--color-cream)] hover:text-[var(--color-ink)]"
      >
        ×
      </button>
      <p className="text-xs uppercase tracking-widest text-[var(--color-ochre-700)] font-semibold mb-1">
        Welcome to Workit
      </p>
      <h2 className="font-display text-xl text-[var(--color-ink)] mb-3">
        {role === "worker" ? "Three steps to your first job." : "Three steps to your first hire."}
      </h2>
      <ol className="space-y-2.5">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-3 text-sm">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--color-ochre-500)] text-[var(--color-cream)] font-display flex items-center justify-center text-xs">
              {i + 1}
            </span>
            <div className="flex-1">
              <p className="font-medium text-[var(--color-ink)]">{s.title.replace(/^\d+\.\s*/, "")}</p>
              <p className="text-[var(--color-ink-soft)] mt-0.5">{s.body}</p>
            </div>
            {s.href && s.cta && (
              <Link
                href={s.href}
                className="text-xs px-3 py-1.5 rounded-pill bg-[var(--color-paper)] border border-[var(--color-line)] text-[var(--color-ink)] hover:bg-[var(--color-cream)] whitespace-nowrap"
              >
                {s.cta}
              </Link>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-4 text-[10px] text-[var(--color-ink-muted)]">
        Dismiss any time — these tips won&apos;t show again on this device.
      </p>
    </section>
  );
}
