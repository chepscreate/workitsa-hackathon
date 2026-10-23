"use client";

/**
 * Persistent ID-verification card on /account for WORKERS — sits in the same
 * prompt stack as the email + phone cards (founder: contact + identity
 * completeness must be front-and-centre, 2026-07-08). Status-aware:
 *
 *   none              → "required before you can take jobs" + Get verified
 *   changes_requested → the admin's note + Fix and resubmit
 *   rejected          → the admin's note + Resubmit
 *   pending           → quiet "in review" reassurance
 *   approved          → renders nothing
 *
 * Employers/businesses keep their own optional-verification section below.
 */

import Button from "./Button";
import { useAuth } from "@/contexts/AuthContext";

export default function VerifyIdPrompt() {
  const { profile } = useAuth();
  if (!profile || profile.role !== "worker") return null;

  const status = profile.verificationStatus ?? "none";
  if (status === "approved") return null;

  const note = profile.verification?.reviewerNote;

  if (status === "pending") {
    return (
      <section className="mb-6 rounded-2xl p-5 bg-[var(--color-sage-100)]/40 border border-[var(--color-sage-400)]/50 text-sm text-[var(--color-ink-soft)]">
        ⏳ <b className="text-[var(--color-ink)]">Your ID documents are in review.</b>{" "}
        We check every worker by hand — you&apos;ll get an email and notification the
        moment there&apos;s a decision.
      </section>
    );
  }

  const isFix = status === "changes_requested" || status === "rejected";

  return (
    <section
      className={`mb-6 rounded-2xl p-5 sm:p-6 shadow-soft border ${
        isFix
          ? "bg-[var(--color-ochre-50)] border-2 border-[var(--color-ochre-500)]"
          : "bg-[var(--color-ochre-50)] border-[var(--color-ochre-300)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 max-w-md">
          <h2 className="font-display text-xl text-[var(--color-ink)]">
            {status === "changes_requested"
              ? "✋ One quick fix needed on your verification"
              : status === "rejected"
                ? "Your verification needs another look"
                : "Upload your ID to get verified"}
          </h2>
          {isFix && note ? (
            <p className="mt-2 text-sm text-[var(--color-ink)] font-medium border-l-2 border-[var(--color-ochre-500)] pl-3">
              {note}
            </p>
          ) : null}
          <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
            {isFix
              ? "Fix it and resubmit — you'll go straight back into the review queue."
              : "Your SA ID is required before you can accept jobs (a short selfie video is optional but speeds up approval). It takes about 5 minutes, and a real person reviews it."}
          </p>
        </div>
        <Button href="/verification" variant="primary" size="sm">
          {isFix ? "Fix and resubmit" : "Get verified"}
        </Button>
      </div>
    </section>
  );
}
