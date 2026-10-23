"use client";

/**
 * Finish-signup step for brand-new Google users. Google gives us their name,
 * email and photo, but not the things Workit needs: which side they're on
 * (worker/employer) and their age (18+). Collect those, then create the profile
 * and hand off to the normal welcome flow.
 */

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import Button from "@/components/Button";
import Badge from "@/components/Badge";
import Input from "@/components/Input";
import Avatar from "@/components/Avatar";
import { useAuth } from "@/contexts/AuthContext";
import { normaliseSaPhone } from "@/lib/phone";
import type { UserRole } from "@/lib/types";

function FinishSignupInner() {
  const router = useRouter();
  const search = useSearchParams();
  const { user, profile, loading, completeGoogleSignUp } = useAuth();

  const [role, setRole] = useState<UserRole>("employer");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phone, setPhone] = useState("");
  // Phone sign-ups reach this page with no provider name/email (Google gives
  // both). Collect whatever the auth provider didn't give us.
  const [displayName, setDisplayName] = useState("");
  const [emailAddr, setEmailAddr] = useState("");
  const needsName = !!user && !user.displayName;
  const needsEmail = !!user && !user.email;
  const phoneLocked = !!user?.phoneNumber;

  // Prefill the already-verified phone number for phone sign-ups.
  useEffect(() => {
    if (user?.phoneNumber) setPhone(user.phoneNumber);
  }, [user?.phoneNumber]);
  const [referralCode, setReferralCode] = useState(
    (search.get("ref") ?? "").trim().toUpperCase(),
  );
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Not signed in → send to sign-in. Already has a profile → they're done here.
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/signin");
    else if (profile) router.replace("/verification?welcome=1");
  }, [loading, user, profile, router]);

  const maxDob = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d.toISOString().split("T")[0];
  })();

  const isOver18 = (iso: string): boolean => {
    if (!iso) return false;
    const dob = new Date(iso);
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 18);
    return dob <= cutoff;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (needsName && displayName.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }
    if (needsEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddr.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!isOver18(dateOfBirth)) {
      setError("You must be 18 or older to use Workit.");
      return;
    }
    // Phone is compulsory (2026-07-10): every account carries both contact
    // channels — jobs get arranged by phone/WhatsApp.
    const e164 = normaliseSaPhone(phone);
    if (!e164) {
      setError("Enter a valid SA mobile number (e.g. 082 123 4567).");
      return;
    }
    if (!agreed) {
      setError("Please accept the Terms and Privacy Policy.");
      return;
    }
    setSubmitting(true);
    try {
      await completeGoogleSignUp({
        role,
        dateOfBirth,
        phone: e164,
        referralCode: referralCode || undefined,
        ...(needsName ? { displayName: displayName.trim() } : {}),
        ...(needsEmail ? { email: emailAddr.trim() } : {}),
      });
      router.push("/verification?welcome=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finish signup.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user || profile) {
    return (
      <Container className="py-14">
        <p className="text-[var(--color-ink-muted)]">Loading…</p>
      </Container>
    );
  }

  return (
    <Container className="py-14 max-w-2xl">
      <div className="text-center mb-8">
        <Badge tone="ochre">Almost there</Badge>
        <h1 className="mt-4 font-display text-4xl sm:text-5xl tracking-tight">
          Finish setting up.
        </h1>
        <p className="mt-3 text-[var(--color-ink-soft)]">
          A few quick details and you&apos;re in.
        </p>
      </div>

      {/* Who you're signing up as. For Google we already know the name/email;
          for phone sign-ups we collect them in the form below. */}
      {(user.displayName || user.email) && (
        <div className="flex items-center justify-center gap-3 mb-8 text-sm text-[var(--color-ink-muted)]">
          <Avatar name={user.displayName ?? undefined} photoURL={user.photoURL ?? undefined} size="sm" />
          <span>
            Signing up as{" "}
            <b className="text-[var(--color-ink)]">{user.displayName || "you"}</b>
            {user.email ? ` · ${user.email}` : ""}
          </span>
        </div>
      )}

      {/* Role */}
      <p className="text-center text-[var(--color-ink-soft)] mb-3">
        Are you here to{" "}
        <span className="font-medium text-[var(--color-ink)]">get work done</span>, or{" "}
        <span className="font-medium text-[var(--color-ink)]">do work</span>?
      </p>
      <div
        role="tablist"
        className="grid grid-cols-2 gap-2 p-1.5 rounded-pill bg-[var(--color-cream-2)] border border-[var(--color-line)] mb-8"
      >
        <RoleButton
          active={role === "employer"}
          onClick={() => setRole("employer")}
          title="I need work done"
          subtitle="Hire a verified worker"
        />
        <RoleButton
          active={role === "worker"}
          onClick={() => setRole("worker")}
          title="I want to work"
          subtitle="Find jobs near me"
        />
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-5 rounded-2xl p-7 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft"
      >
        {needsName && (
          <Input
            label="Full name"
            name="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Tshepo Mokoena"
            autoComplete="name"
            required
            hint="This is the name workers and employers see."
          />
        )}
        {needsEmail && (
          <Input
            label="Email address"
            name="email"
            type="email"
            value={emailAddr}
            onChange={(e) => setEmailAddr(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
            hint="We send your account decision and job updates here."
          />
        )}
        <Input
          label="Date of birth"
          name="dateOfBirth"
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          max={maxDob}
          required
          hint="You must be 18 or older to use Workit."
        />
        <Input
          label="Phone number"
          name="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="082 123 4567"
          hint={
            phoneLocked
              ? "The verified number you signed in with."
              : "Jobs get arranged by phone/WhatsApp. SA mobile (06x, 07x, 08x)."
          }
          autoComplete="tel"
          required
          readOnly={phoneLocked}
        />
        <Input
          label="Referral code (optional)"
          name="referralCode"
          value={referralCode}
          onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
          placeholder="e.g. 7K3X9P"
          maxLength={8}
          hint="If a friend invited you, paste their code here."
          error={error ?? undefined}
        />

        <label className="flex items-start gap-3 text-sm text-[var(--color-ink-soft)] cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 accent-[var(--color-ochre-500)] w-4 h-4 flex-shrink-0"
            required
          />
          <span>
            I agree to the{" "}
            <Link href="/terms" className="underline text-[var(--color-ink)]" target="_blank">Terms</Link>,{" "}
            <Link href="/acceptable-use" className="underline text-[var(--color-ink)]" target="_blank">Acceptable Use Policy</Link>, and{" "}
            <Link href="/privacy" className="underline text-[var(--color-ink)]" target="_blank">Privacy Policy</Link>.
          </span>
        </label>

        <Button
          type="submit"
          size="lg"
          variant="primary"
          className="w-full"
          loading={submitting}
          loadingText="Creating account…"
        >
          {role === "worker" ? "Continue as a worker" : "Continue to post jobs"}
        </Button>
      </form>

      {role === "worker" && (
        <div className="mt-6 rounded-xl p-5 bg-[var(--color-sage-100)]/40 border border-[var(--color-sage-400)]/40 text-sm text-[var(--color-ink-soft)]">
          <p className="font-medium text-[var(--color-ink)] mb-1">
            Next, you&apos;ll verify
          </p>
          <p>
            SA ID, proof of address, and either a qualification or photos of
            past work (a short selfie video is optional but speeds up approval).
            Usually reviewed within 1–2 days.
          </p>
        </div>
      )}
    </Container>
  );
}

function RoleButton({
  active,
  onClick,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-pill px-5 py-3 text-left transition-all ${
        active
          ? "bg-[var(--color-paper)] shadow-soft"
          : "bg-transparent hover:bg-[var(--color-paper)]/60"
      }`}
    >
      <span className="block font-display text-lg text-[var(--color-ink)]">{title}</span>
      <span className="block text-xs text-[var(--color-ink-muted)]">{subtitle}</span>
    </button>
  );
}

export default function FinishSignupPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Suspense
          fallback={
            <Container className="py-14">
              <p className="text-[var(--color-ink-muted)]">Loading…</p>
            </Container>
          }
        >
          <FinishSignupInner />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
