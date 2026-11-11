"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import Button from "@/components/Button";
import Badge from "@/components/Badge";
import Input from "@/components/Input";
import NotConfiguredBanner from "@/components/NotConfiguredBanner";
import PhoneAuthForm from "@/components/PhoneAuthForm";
import GoogleButton from "@/components/GoogleButton";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/LocaleContext";
import { normaliseSaPhone } from "@/lib/phone";
import type { UserRole } from "@/lib/types";

function isValidRole(v: string | null): v is UserRole {
  return v === "employer" || v === "worker" || v === "business";
}

function SignUpInner() {
  const search = useSearchParams();
  const router = useRouter();
  const { signUp, configured } = useAuth();
  const { t } = useTranslation();

  const roleParam = search.get("role");
  const initialRole: UserRole = isValidRole(roleParam) ? roleParam : "employer";

  const [authMode, setAuthMode] = useState<"phone" | "email">("phone");
  const [role, setRole] = useState<UserRole>(initialRole);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [referralCode, setReferralCode] = useState(
    (search.get("ref") ?? "").trim().toUpperCase(),
  );
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 18 years before today, as yyyy-mm-dd, for the max attribute on the
  // date input. Anything later is under-18 and rejected.
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
    if (password.length < 8) {
      setError(t("auth.err.passwordLen"));
      return;
    }
    if (!isOver18(dateOfBirth)) {
      setError(t("auth.err.under18"));
      return;
    }
    // Phone was already required but unvalidated — normalise to E.164 so the
    // stored number is actually usable (WhatsApp, OTP verification later).
    const e164 = normaliseSaPhone(phone);
    if (!e164) {
      setError(t("auth.err.invalidPhone"));
      return;
    }
    if (!agreed) {
      setError(t("auth.err.terms"));
      return;
    }
    setSubmitting(true);
    try {
      await signUp({
        email,
        password,
        displayName,
        role,
        phone: e164,
        dateOfBirth,
        referralCode: referralCode || undefined,
      });
      // Onboarding is a single step now — straight to verification (identity
      // docs + location + skills in one form), then the pending screen.
      router.push("/verification?welcome=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.err.createFail"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex-1">
      <Container className="py-14 max-w-2xl">
        <div className="text-center mb-10" data-reveal>
          <Badge tone="ochre">{t("signup.badge")}</Badge>
          <h1 className="mt-4 font-display text-4xl sm:text-5xl tracking-tight">
            {t("signup.welcome")}
          </h1>
          <p className="mt-3 text-[var(--color-ink-soft)]">{t("signup.intent")}</p>
        </div>

        {/* Role toggle — only needed for the email form (phone form has its own role cards).
            Two intents; "I need work done" then asks whether they're hiring as
            a business (employer vs business role). Both hiring paths require
            ID verification, same as workers (founder 2026-07-08). */}
        <div className={authMode === "phone" ? "hidden" : ""}>
          <div
            role="tablist"
            data-reveal
            className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1.5 rounded-2xl bg-[var(--color-cream-2)] border border-[var(--color-line)] mb-4 [--reveal-delay:80ms]"
          >
            <RoleButton
              active={role === "employer" || role === "business"}
              onClick={() => setRole("employer")}
              title={t("auth.role.needWork.title")}
              subtitle={t("auth.role.needWork.sub")}
            />
            <RoleButton
              active={role === "worker"}
              onClick={() => setRole("worker")}
              title={t("auth.role.doWork.title")}
              subtitle={t("auth.role.doWork.sub")}
            />
          </div>

          {(role === "employer" || role === "business") && (
            <div className="mb-8 rounded-xl p-4 bg-[var(--color-paper)] border border-[var(--color-line)] flex items-center gap-3 flex-wrap animate-slide-up">
              <span className="text-sm font-medium text-[var(--color-ink)]">
                {t("auth.biz.question")}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRole("employer")}
                  className={`px-4 py-2 rounded-pill text-sm transition-colors ${
                    role === "employer"
                      ? "bg-[var(--color-ink)] text-[var(--color-cream)]"
                      : "bg-[var(--color-cream-2)] border border-[var(--color-line)] text-[var(--color-ink-soft)]"
                  }`}
                >
                  {t("auth.biz.no")}
                </button>
                <button
                  type="button"
                  onClick={() => setRole("business")}
                  className={`px-4 py-2 rounded-pill text-sm transition-colors ${
                    role === "business"
                      ? "bg-[var(--color-ink)] text-[var(--color-cream)]"
                      : "bg-[var(--color-cream-2)] border border-[var(--color-line)] text-[var(--color-ink-soft)]"
                  }`}
                >
                  {t("auth.biz.yes")}
                </button>
              </div>
              {role === "business" && (
                <p className="w-full text-xs text-[var(--color-ink-muted)]">
                  {t("auth.biz.note")}
                </p>
              )}
            </div>
          )}
        </div>

        {!configured && (
          <div className="mb-6">
            <NotConfiguredBanner />
          </div>
        )}

        {/* Google — picks role + age on the next step */}
        <div className="mb-5">
          <GoogleButton label={t("signup.googleLabel")} />
        </div>
        <div className="flex items-center gap-3 mb-5">
          <span className="h-px flex-1 bg-[var(--color-line)]" />
          <span className="text-xs text-[var(--color-ink-muted)]">{t("auth.or")}</span>
          <span className="h-px flex-1 bg-[var(--color-line)]" />
        </div>

        {/* Phone / Email switcher */}
        <div className="grid grid-cols-2 gap-2 p-1 mb-5 rounded-pill bg-[var(--color-cream-2)] border border-[var(--color-line)]">
          <button
            type="button"
            onClick={() => setAuthMode("phone")}
            className={`rounded-pill px-4 py-2 text-sm transition-all ${
              authMode === "phone"
                ? "bg-[var(--color-paper)] shadow-soft text-[var(--color-ink)] font-medium"
                : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            }`}
          >
            📱 {t("auth.tabPhoneSms")}
          </button>
          <button
            type="button"
            onClick={() => setAuthMode("email")}
            className={`rounded-pill px-4 py-2 text-sm transition-all ${
              authMode === "email"
                ? "bg-[var(--color-paper)] shadow-soft text-[var(--color-ink)] font-medium"
                : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            }`}
          >
            ✉️ {t("auth.tabEmail")}
          </button>
        </div>

        {authMode === "phone" ? (
          <div className="rounded-2xl p-7 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
            <PhoneAuthForm
              mode="signup"
              initialRole={role}
              onSuccess={() => router.push("/verification?welcome=1")}
            />
            <p className="text-center text-sm text-[var(--color-ink-muted)] mt-5">
              {t("signup.already")}{" "}
              <Link
                href="/signin"
                className="text-[var(--color-ochre-600)] hover:text-[var(--color-ochre-700)] underline-offset-2 hover:underline"
              >
                {t("auth.signIn")}
              </Link>
            </p>
          </div>
        ) : (
        <form
          onSubmit={onSubmit}
          className="space-y-5 rounded-2xl p-7 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft"
        >
          <Input
            label={t("auth.field.fullName")}
            name="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t("auth.field.fullNamePh")}
            required
            autoComplete="name"
          />
          <Input
            label={t("auth.field.email")}
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("auth.field.emailPh")}
            required
            autoComplete="email"
          />
          <Input
            label={t("signup.phoneLabel")}
            name="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t("signup.phonePh")}
            hint={t("signup.phoneHint")}
            autoComplete="tel"
            required
          />
          <Input
            label={t("auth.field.dob")}
            name="dateOfBirth"
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            max={maxDob}
            required
            hint={t("auth.field.dobHint")}
          />
          <Input
            label={t("signup.referralLabel")}
            name="referralCode"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
            placeholder={t("signup.referralPh")}
            maxLength={8}
            hint={t("signup.referralHint")}
          />
          <Input
            label={t("auth.field.password")}
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("signup.passwordPh")}
            required
            autoComplete="new-password"
            minLength={8}
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
              {t("auth.consent.pre")}{" "}
              <Link href="/terms" className="underline text-[var(--color-ink)]" target="_blank">
                {t("auth.consent.terms")}
              </Link>
              ,{" "}
              <Link href="/acceptable-use" className="underline text-[var(--color-ink)]" target="_blank">
                {t("auth.consent.aup")}
              </Link>
              , {t("auth.and")}{" "}
              <Link href="/privacy" className="underline text-[var(--color-ink)]" target="_blank">
                {t("auth.consent.privacy")}
              </Link>
              .
            </span>
          </label>

          <Button
            type="submit"
            size="lg"
            variant="primary"
            className="w-full"
            loading={submitting}
            loadingText={t("signup.creating")}
            disabled={!configured}
          >
            {role === "worker"
              ? t("signup.submitWorker")
              : role === "business"
                ? t("signup.submitBusiness")
                : t("signup.submitEmployer")}
          </Button>

          <p className="text-center text-sm text-[var(--color-ink-muted)]">
            {t("signup.already")}{" "}
            <Link
              href="/signin"
              className="text-[var(--color-ochre-600)] hover:text-[var(--color-ochre-700)] underline-offset-2 hover:underline"
            >
              {t("auth.signIn")}
            </Link>
          </p>
        </form>
        )}

        {role === "worker" && (
          <div className="mt-6 rounded-xl p-5 bg-[var(--color-sage-100)]/40 border border-[var(--color-sage-400)]/40 text-sm text-[var(--color-ink-soft)]">
            <p className="font-medium text-[var(--color-ink)] mb-1">
              {t("signup.workerNotice.title")}
            </p>
            <p>{t("signup.workerNotice.body")}</p>
          </div>
        )}
      </Container>
    </main>
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
      <span className="block font-display text-lg text-[var(--color-ink)]">
        {title}
      </span>
      <span className="block text-xs text-[var(--color-ink-muted)]">
        {subtitle}
      </span>
    </button>
  );
}

export default function SignUpPage() {
  const { t } = useTranslation();
  return (
    <>
      <Header />
      <Suspense
        fallback={
          <Container className="py-14">
            <p className="text-[var(--color-ink-muted)]">{t("signup.loading")}</p>
          </Container>
        }
      >
        <SignUpInner />
      </Suspense>
      <Footer />
    </>
  );
}
