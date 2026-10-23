"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "./Header";
import Footer from "./Footer";
import Container from "./Container";
import Badge from "./Badge";
import Button from "./Button";
import { useAuth } from "@/contexts/AuthContext";
import { isAccountApproved, type UserRole } from "@/lib/types";

/**
 * Wrap any signed-in-only page that should be hidden until the admin
 * approves the account. If pending or rejected, shows the gate screen
 * instead of children.
 *
 * Sign-in itself is not required by this gate — pass an explicit
 * `requireSignIn` if you want unauthenticated users redirected too.
 */
export default function AccountGate({
  children,
  requireSignIn = true,
}: {
  children: React.ReactNode;
  requireSignIn?: boolean;
}) {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (!loading && requireSignIn && !user) {
      router.replace(`/signin?next=${encodeURIComponent(location.pathname + location.search)}`);
    }
  }, [loading, user, router, requireSignIn]);

  // Brand-new users haven't completed onboarding yet. Onboarding is now a
  // SINGLE step — /verification?welcome=1 — which captures identity docs, home
  // location and (for workers) categories/skills in one form, then submits for
  // approval. (Merged 2026-07-12: the separate "tell us about yourself" profile
  // step was a drop-off point that grew pending-but-never-submitted accounts.)
  // Profile polish (photo, bio, portfolio) lives on /profile for after approval.
  useEffect(() => {
    if (!loading && user && profile && !isAccountApproved(profile)) {
      if (!profile.verification?.submittedAt) {
        router.replace("/verification?welcome=1");
      }
    }
  }, [loading, user, profile, router]);

  // Signed in but no profile doc = a brand-new Google user who hasn't finished
  // onboarding (Google doesn't give us a role or age). Send them to finish.
  useEffect(() => {
    if (!loading && user && !profile) {
      router.replace("/finish-signup");
    }
  }, [loading, user, profile, router]);

  if (loading) {
    return (
      <FrameBare>
        <p className="text-[var(--color-ink-muted)]">Loading…</p>
      </FrameBare>
    );
  }

  if (!user) {
    // When sign-in IS required, the effect above is mid-redirect — render
    // a placeholder. When sign-in is NOT required (e.g. /find-work where
    // guests can browse), pass straight through to the children.
    if (!requireSignIn) return <>{children}</>;
    return (
      <FrameBare>
        <p className="text-[var(--color-ink-muted)]">Redirecting…</p>
      </FrameBare>
    );
  }

  // Profile may still be loading even after user is set
  if (!profile) {
    return (
      <FrameBare>
        <p className="text-[var(--color-ink-muted)]">Loading your account…</p>
      </FrameBare>
    );
  }

  if (!isAccountApproved(profile)) {
    return <PendingScreen status={profile.accountStatus} reviewerNote={profile.accountReviewerNote} role={profile.role} />;
  }

  return <>{children}</>;
}

function PendingScreen({
  status,
  reviewerNote,
  role,
}: {
  status?: string;
  reviewerNote?: string;
  role: UserRole;
}) {
  const rejected = status === "rejected";

  return (
    <>
      <Header />
      <main className="flex-1">
        <Container className="py-16 max-w-2xl">
          <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] shadow-soft p-8 sm:p-12 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-[var(--color-ochre-100)] flex items-center justify-center mb-5">
              <span className="text-3xl" aria-hidden>
                {rejected ? "✗" : "⏳"}
              </span>
            </div>

            <Badge tone={rejected ? "brick" : "ochre"}>
              {rejected ? "Account rejected" : "Pending account approval"}
            </Badge>

            <h1 className="mt-5 font-display text-3xl sm:text-4xl tracking-tight">
              {rejected
                ? "Your account wasn't approved."
                : "Your account is waiting for review."}
            </h1>

            <p className="mt-4 text-[var(--color-ink-soft)] leading-relaxed">
              {rejected ? (
                <>
                  Tshepo reviewed your account and couldn&apos;t approve it.
                  You can update your details and we&apos;ll review again, or
                  email{" "}
                  <a
                    href="mailto:tshepowayne@workitsa.co.za"
                    className="underline decoration-[var(--color-ochre-500)] underline-offset-2"
                  >
                    tshepowayne@workitsa.co.za
                  </a>{" "}
                  to ask why.
                </>
              ) : (
                <>
                  Every new Workit account is checked by a real person before
                  it can post jobs or send offers. This keeps the platform
                  safe for everyone. You&apos;ll usually hear back within
                  1–2 days during launch.
                </>
              )}
            </p>

            {reviewerNote && (
              <div className="mt-5 rounded-xl bg-[var(--color-cream-2)] border border-[var(--color-line)] p-4 text-left">
                <p className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)] mb-1">
                  Note from review
                </p>
                <p className="text-sm text-[var(--color-ink)]">{reviewerNote}</p>
              </div>
            )}

            <div className="mt-7 grid sm:grid-cols-2 gap-3">
              <Button
                href="/profile"
                variant="primary"
                size="lg"
                className="w-full justify-center"
              >
                {rejected ? "Update profile" : "Complete profile"}
              </Button>
              {/* All roles verify ID since 2026-07-08 — workers get the full
                  credential form, employers/businesses the identity core. */}
              <Button
                href="/verification"
                variant="secondary"
                size="lg"
                className="w-full justify-center"
              >
                Submit verification
              </Button>
              {role !== "worker" && (
                <Button
                  href="/"
                  variant="outline"
                  size="lg"
                  className="w-full justify-center"
                >
                  Back to home
                </Button>
              )}
            </div>

            <p className="mt-8 text-xs text-[var(--color-ink-muted)]">
              Questions?{" "}
              <a
                href="mailto:tshepowayne@workitsa.co.za"
                className="underline decoration-[var(--color-ochre-500)] underline-offset-2"
              >
                tshepowayne@workitsa.co.za
              </a>
            </p>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}

function FrameBare({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Container className="py-14">{children}</Container>
      </main>
      <Footer />
    </>
  );
}
