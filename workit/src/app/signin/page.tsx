"use client";

/**
 * Sign-in page — design upgrade.
 *
 * Layout: 2-column split on desktop (brand promise on the left, form
 * card on the right), single column stack on mobile. Preserves the
 * existing phone / email switcher and all auth wiring (PhoneAuthForm,
 * useAuth, NotConfiguredBanner). The right card just gets the new
 * promise panel as a sibling.
 *
 * No behavior change vs. the old page — purely visual.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
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
import Underline from "@/components/Underline";
import TotpChallenge from "@/components/TotpChallenge";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/LocaleContext";
import { friendlyAuthError } from "@/lib/auth-errors";
import { isMfaRequiredError } from "@/lib/mfa";
import type { MultiFactorError } from "firebase/auth";

export default function SignInPage() {
  const router = useRouter();
  const { signIn, configured } = useAuth();
  const { t } = useTranslation();
  const [authMode, setAuthMode] = useState<"phone" | "email">("phone");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when the account has two-step verification — we swap the form for
  // the 6-digit code prompt and finish sign-in from there.
  const [mfaError, setMfaError] = useState<MultiFactorError | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      router.push("/account");
    } catch (err) {
      if (isMfaRequiredError(err)) setMfaError(err);
      else setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Header />
      <main className="flex-1">
        <Container className="py-14 lg:py-20">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            {/* LEFT — brand promise */}
            <div className="order-2 lg:order-1" data-reveal>
              <Badge tone="sage">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-sage-600)]" />
                {t("hero.trustFree")}
              </Badge>
              <h1 className="mt-4 font-display text-4xl sm:text-5xl tracking-tight leading-tight">
                {t("signin.welcomePre")}{" "}
                <span className="relative inline-block italic" style={{ color: "var(--color-ochre-600)" }}>
                  Workit
                  <Underline />
                </span>
                .
              </h1>
              <p className="mt-5 text-lg text-[var(--color-ink-soft)] max-w-md leading-relaxed">
                {t("signin.lead")}
              </p>

              <ul className="mt-8 space-y-4 max-w-md">
                <Bullet icon="🔒" title={t("signin.b1.t")} body={t("signin.b1.b")} />
                <Bullet icon="📵" title={t("signin.b2.t")} body={t("signin.b2.b")} />
                <Bullet icon="🤝" title={t("signin.b3.t")} body={t("signin.b3.b")} />
              </ul>
            </div>

            {/* RIGHT — form card */}
            <div className="order-1 lg:order-2 [--reveal-delay:100ms]" data-reveal>
              {!configured && (
                <div className="mb-6">
                  <NotConfiguredBanner />
                </div>
              )}

              <div className="rounded-2xl p-7 sm:p-9 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-lift">
                {mfaError ? (
                  <TotpChallenge
                    mfaError={mfaError}
                    onSuccess={() => router.push("/account")}
                    onCancel={() => setMfaError(null)}
                  />
                ) : (
                <>
                <h2 className="font-display text-2xl tracking-tight">
                  {t("signin.formTitle")}
                </h2>
                <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                  {t("signin.formSub")}
                </p>

                {/* Google */}
                <div className="mt-6">
                  <GoogleButton label={t("auth.google.default")} />
                </div>
                <div className="flex items-center gap-3 my-5">
                  <span className="h-px flex-1 bg-[var(--color-line)]" />
                  <span className="text-xs text-[var(--color-ink-muted)]">{t("auth.or")}</span>
                  <span className="h-px flex-1 bg-[var(--color-line)]" />
                </div>

                {/* Phone / Email switcher */}
                <div className="grid grid-cols-2 gap-2 p-1 mt-6 mb-5 rounded-pill bg-[var(--color-cream-2)] border border-[var(--color-line)]">
                  <button
                    type="button"
                    onClick={() => setAuthMode("phone")}
                    className={`rounded-pill px-4 py-2 text-sm transition-all whitespace-nowrap ${
                      authMode === "phone"
                        ? "bg-[var(--color-paper)] shadow-soft text-[var(--color-ink)] font-medium"
                        : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                    }`}
                  >
                    📱 {t("auth.tabPhone")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode("email")}
                    className={`rounded-pill px-4 py-2 text-sm transition-all whitespace-nowrap ${
                      authMode === "email"
                        ? "bg-[var(--color-paper)] shadow-soft text-[var(--color-ink)] font-medium"
                        : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                    }`}
                  >
                    ✉️ {t("auth.tabEmail")}
                  </button>
                </div>

                {authMode === "phone" ? (
                  <>
                    <PhoneAuthForm
                      mode="signin"
                      showTerms={false}
                      onSuccess={({ isNewUser }) =>
                        router.push(isNewUser ? "/finish-signup" : "/account")
                      }
                    />
                    <p className="text-center text-sm text-[var(--color-ink-muted)] mt-5">
                      {t("signin.noAccount")}{" "}
                      <Link
                        href="/signup"
                        className="text-[var(--color-ochre-600)] hover:text-[var(--color-ochre-700)] underline-offset-2 hover:underline"
                      >
                        {t("signin.createOne")}
                      </Link>
                    </p>
                  </>
                ) : (
                  <form onSubmit={onSubmit} className="space-y-5">
                    <Input
                      label={t("auth.field.email")}
                      name="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      placeholder={t("auth.field.emailPh")}
                    />
                    <Input
                      label={t("auth.field.password")}
                      name="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      error={error ?? undefined}
                    />
                    <div className="flex justify-end -mt-2">
                      <Link
                        href="/forgot-password"
                        className="text-xs text-[var(--color-ochre-600)] hover:text-[var(--color-ochre-700)] underline-offset-2 hover:underline"
                      >
                        {t("signin.forgot")}
                      </Link>
                    </div>
                    <Button
                      type="submit"
                      size="lg"
                      variant="primary"
                      className="w-full"
                      loading={submitting}
                      loadingText={t("signin.signingIn")}
                      disabled={!configured}
                    >
                      {t("auth.signIn")}
                    </Button>
                    <p className="text-center text-sm text-[var(--color-ink-muted)]">
                      {t("signin.noAccount")}{" "}
                      <Link
                        href="/signup"
                        className="text-[var(--color-ochre-600)] hover:text-[var(--color-ochre-700)] underline-offset-2 hover:underline"
                      >
                        {t("signin.createOne")}
                      </Link>
                    </p>
                  </form>
                )}

                <p className="mt-6 text-xs text-[var(--color-ink-muted)] leading-relaxed">
                  {t("signin.byContinuingPre")}{" "}
                  <Link href="/terms" className="underline decoration-[var(--color-ochre-300)] underline-offset-2 hover:text-[var(--color-ink)]">{t("auth.consent.terms")}</Link>{" "}{t("auth.and")}{" "}
                  <Link href="/privacy" className="underline decoration-[var(--color-ochre-300)] underline-offset-2 hover:text-[var(--color-ink)]">{t("auth.privacyShort")}</Link>.
                </p>
                </>
                )}
              </div>
            </div>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}

function Bullet({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <li className="flex items-start gap-4">
      <span className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--color-cream-2)] border border-[var(--color-line)] flex items-center justify-center text-lg">
        {icon}
      </span>
      <div>
        <p className="font-medium text-[var(--color-ink)]">{title}</p>
        <p className="mt-0.5 text-sm text-[var(--color-ink-muted)] leading-relaxed">{body}</p>
      </div>
    </li>
  );
}
