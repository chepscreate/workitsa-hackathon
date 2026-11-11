"use client";

import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import Button from "@/components/Button";
import Badge from "@/components/Badge";
import Testimonials from "@/components/Testimonials";
import Faq from "@/components/Faq";
import Underline from "@/components/Underline";
import HomeDashboard from "@/components/HomeDashboard";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/LocaleContext";

// Copy flows through translation keys (see src/i18n) so the language switcher
// actually transforms these sections — they read from `t()` at render time.
const categories = [
  {
    titleKey: "home.cat.home.title",
    examplesKey: "home.cat.home.examples",
    tone: "sage",
    icon: "🌿",
  },
  {
    titleKey: "home.cat.trades.title",
    examplesKey: "home.cat.trades.examples",
    tone: "ochre",
    icon: "🔧",
  },
  {
    titleKey: "home.cat.moving.title",
    examplesKey: "home.cat.moving.examples",
    tone: "stone",
    icon: "📦",
  },
  {
    titleKey: "home.cat.personal.title",
    examplesKey: "home.cat.personal.examples",
    tone: "ink",
    icon: "✂️",
  },
] as const;

const steps = [
  { n: "01", titleKey: "home.step1.title", bodyKey: "home.step1.body" },
  { n: "02", titleKey: "home.step2.title", bodyKey: "home.step2.body" },
  { n: "03", titleKey: "home.step3.title", bodyKey: "home.step3.body" },
] as const;

const safetyPoints = [
  { titleKey: "home.safety.id.title", bodyKey: "home.safety.id.body" },
  { titleKey: "home.safety.address.title", bodyKey: "home.safety.address.body" },
  { titleKey: "home.safety.background.title", bodyKey: "home.safety.background.body" },
  { titleKey: "home.safety.tracking.title", bodyKey: "home.safety.tracking.body" },
  { titleKey: "home.safety.sos.title", bodyKey: "home.safety.sos.body" },
  { titleKey: "home.safety.ratings.title", bodyKey: "home.safety.ratings.body" },
] as const;

export default function Home() {
  const { user, loading } = useAuth();
  const { t } = useTranslation();

  // Signed-in users see a personalised dashboard instead of the marketing
  // landing. While auth is still resolving we show the marketing view so
  // there's no flash of blank for guests (the common case) and crawlers
  // always get the SEO-friendly landing copy.
  if (!loading && user) {
    return <HomeDashboard />;
  }

  return (
    <>
      <Header />

      {/* HERO */}
      <section className="relative overflow-hidden bg-hero-wash">
        <Container className="pt-14 pb-20 sm:pt-20 sm:pb-28">
          <div className="grid lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7">
              <div className="flex flex-wrap items-center gap-3 animate-slide-up">
                <Badge tone="sage">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-sage-600)]" />
                  {t("home.badge.launching")}
                </Badge>
                <span className="text-sm text-[var(--color-ink-muted)]">
                  <span className="font-display italic text-[var(--color-ink-soft)]">
                    Sawubona
                  </span>{" "}
                  ·{" "}
                  <span className="font-display italic text-[var(--color-ink-soft)]">
                    Dumela
                  </span>{" "}
                  ·{" "}
                  <span className="font-display italic text-[var(--color-ink-soft)]">
                    Goeie dag
                  </span>
                </span>
              </div>
              <h1 className="mt-5 font-display text-5xl sm:text-6xl lg:text-7xl leading-[1.02] tracking-tight animate-slide-up [animation-delay:60ms]">
                {t("hero.titleA")}{" "}
                <span className="relative inline-block italic" style={{ color: "var(--color-ochre-600)" }}>
                  {t("hero.titleB")}
                  <Underline />
                </span>{" "}
                {t("hero.titleC")}
              </h1>
              <p className="mt-6 max-w-xl text-lg text-[var(--color-ink-soft)] animate-slide-up [animation-delay:120ms]">
                {t("hero.subtitle")}
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-3 animate-slide-up [animation-delay:180ms]">
                <Button href="/signup?role=employer" size="lg" variant="primary">
                  {t("hero.ctaPost")}
                </Button>
                <Button href="/signup?role=worker" size="lg" variant="secondary">
                  {t("hero.ctaWork")}
                </Button>
              </div>

              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--color-ink-muted)] animate-slide-up [animation-delay:240ms]">
                {[t("hero.trustFree"), t("hero.trustVerified"), t("hero.trustCash")].map((chip) => (
                  <span key={chip} className="inline-flex items-center gap-1.5">
                    {/* sage-700 (not 600) — it's the variant that brightens in dark mode */}
                    <span className="text-[var(--color-sage-700)]" aria-hidden>✓</span>
                    {chip}
                  </span>
                ))}
              </div>
            </div>

            {/* Visual card stack — a softer alternative to a stock hero image */}
            <div className="lg:col-span-5 relative hidden md:block">
              <div className="relative h-[440px] sm:h-[500px]">
                <Card
                  className="absolute top-0 right-0 w-72 rotate-2 [--drift-tilt:2deg] animate-drift hover:scale-[1.02] transition-[scale] duration-300"
                  accent="ochre"
                >
                  <div className="flex items-center justify-between mb-3">
                    <Badge tone="ochre">Gardening</Badge>
                    <span className="text-xs text-[var(--color-ink-muted)]">
                      2.1 km away
                    </span>
                  </div>
                  <p className="font-display text-xl leading-snug">
                    Lawn cut & hedge trim, Saturday morning
                  </p>
                  <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
                    Medium yard, Linden, Johannesburg
                  </p>
                  <div className="mt-4 pt-3 border-t border-[var(--color-line)] flex items-center justify-between">
                    <span className="text-xs text-[var(--color-ink-muted)]">
                      Offered
                    </span>
                    <span className="font-display text-2xl text-[var(--color-ochre-600)]">
                      R 280
                    </span>
                  </div>
                </Card>

                <Card
                  className="absolute top-32 left-0 w-72 -rotate-3 [--drift-tilt:-3deg] animate-drift [animation-duration:11s] [animation-delay:1.2s] hover:scale-[1.02] transition-[scale] duration-300"
                  accent="sage"
                >
                  <div className="flex items-center justify-between mb-3">
                    <Badge tone="sage">Plumbing</Badge>
                    <span className="text-xs text-[var(--color-ink-muted)]">
                      Sipho M.
                    </span>
                  </div>
                  <p className="font-display text-xl leading-snug">
                    Geyser leak — can be there in 30 min
                  </p>
                  <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
                    <span className="inline-flex items-center gap-1">
                      <span className="text-[var(--color-ochre-500)]">★</span>{" "}
                      4.9 · 142 jobs
                    </span>
                  </p>
                  <div className="mt-4 pt-3 border-t border-[var(--color-line)] flex items-center justify-between">
                    <span className="text-xs text-[var(--color-ink-muted)]">
                      Counter-offer
                    </span>
                    <span className="font-display text-2xl text-[var(--color-sage-700)]">
                      R 450
                    </span>
                  </div>
                </Card>

                <Card
                  className="absolute bottom-0 right-4 w-64 rotate-1 [--drift-tilt:1deg] animate-drift [animation-duration:10s] [animation-delay:2.4s] hover:scale-[1.02] transition-[scale] duration-300"
                  accent="ink"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[var(--color-ochre-300)] flex items-center justify-center font-display text-lg">
                      N
                    </div>
                    <div>
                      <p className="text-sm font-medium">Nomsa K.</p>
                      <p className="text-xs text-[var(--color-ink-muted)]">
                        Verified · Gold badge
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm italic text-[var(--color-ink-soft)]">
                    &ldquo;She arrived on time and left the place spotless.
                    Booking again next week.&rdquo;
                  </p>
                </Card>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-16 sm:py-20 bg-[var(--color-cream-2)] border-y border-[var(--color-line)]">
        <Container>
          <div className="max-w-2xl" data-reveal>
            <Badge tone="ink">{t("home.how.badge")}</Badge>
            <h2 className="mt-4 font-display text-4xl sm:text-5xl tracking-tight">
              {t("home.how.title")}
            </h2>
            <p className="mt-4 text-[var(--color-ink-soft)]">
              {t("home.how.subtitle")}
            </p>
          </div>

          <div className="mt-12 grid md:grid-cols-3 gap-6" data-reveal-group>
            {steps.map((s) => (
              <div
                key={s.n}
                className="group rounded-xl p-7 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft hover:shadow-lift hover:-translate-y-1 hover:border-[var(--color-ochre-300)] transition-all duration-300"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-ochre-50)] border border-[var(--color-ochre-300)] font-display text-lg text-[var(--color-ochre-600)]">
                    {s.n}
                  </span>
                  <span className="h-px flex-1 bg-[var(--color-line)] group-hover:bg-[var(--color-ochre-300)] transition-colors" />
                </div>
                <h3 className="mt-5 font-display text-2xl">{t(s.titleKey)}</h3>
                <p className="mt-3 text-[var(--color-ink-soft)] leading-relaxed">
                  {t(s.bodyKey)}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* CATEGORIES */}
      <section id="categories" className="py-16 sm:py-20">
        <Container>
          <div className="flex items-end justify-between flex-wrap gap-4 mb-12" data-reveal>
            <div className="max-w-xl">
              <Badge tone="ochre">{t("home.cat.badge")}</Badge>
              <h2 className="mt-4 font-display text-4xl sm:text-5xl tracking-tight">
                {t("home.cat.title")}
              </h2>
            </div>
            <Link
              href="/categories"
              className="link-cta text-sm font-medium text-[var(--color-ochre-600)] hover:text-[var(--color-ochre-700)]"
            >
              {t("home.cat.seeAll")} <span className="link-cta-arrow">→</span>
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5" data-reveal-group>
            {categories.map((c) => (
              <div
                key={c.titleKey}
                className="group rounded-xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)] hover:shadow-lift hover:-translate-y-1 hover:border-[var(--color-ochre-300)] transition-all duration-300"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-cream-2)] border border-[var(--color-line)] text-2xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
                  {c.icon}
                </div>
                <h3 className="font-display text-xl">{t(c.titleKey)}</h3>
                <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
                  {t(c.examplesKey)}
                </p>
                <div className="mt-5">
                  <Badge tone={c.tone}>{t("home.cat.liveAtLaunch")}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* SAFETY */}
      <section
        id="safety"
        className="relative overflow-hidden py-16 sm:py-20 bg-[var(--color-ink)] text-[var(--color-cream)]"
      >
        {/* Warm ember glows so the dark band doesn't read flat */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 right-[-4rem] h-80 w-80 rounded-full bg-[var(--color-ochre-500)] opacity-[0.09] blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-[-6rem] left-[-4rem] h-72 w-72 rounded-full bg-[var(--color-sage-600)] opacity-[0.08] blur-3xl"
        />
        <Container>
          <div className="grid lg:grid-cols-12 gap-10">
            <div className="lg:col-span-4" data-reveal>
              <Badge tone="ochre">{t("home.safety.badge")}</Badge>
              <h2 className="mt-4 font-display text-4xl sm:text-5xl tracking-tight">
                {t("home.safety.title")}
              </h2>
              <p className="mt-5 text-[var(--color-cream-2)]/80 leading-relaxed">
                {t("home.safety.body")}
              </p>
            </div>
            <div className="lg:col-span-8 grid sm:grid-cols-2 gap-4" data-reveal-group>
              {safetyPoints.map((p) => (
                <div
                  key={p.titleKey}
                  className="rounded-xl p-6 border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-colors duration-300"
                >
                  <h3 className="font-display text-xl text-[var(--color-ochre-300)]">
                    {t(p.titleKey)}
                  </h3>
                  <p className="mt-2 text-sm text-[var(--color-cream-2)]/80 leading-relaxed">
                    {t(p.bodyKey)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <Testimonials />

      <Faq />

      {/* FOR WORKERS */}
      <section id="workers" className="py-16 sm:py-20">
        <Container>
          <div
            className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[var(--color-ochre-500)] to-[var(--color-ochre-700)] text-[var(--color-cream)] p-10 sm:p-14 shadow-lift"
            data-reveal
          >
            {/* Soft light pooling in the top corner + beadwork dots for craft */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-20 -right-16 h-72 w-72 rounded-full bg-white/15 blur-3xl"
            />
            <div aria-hidden className="absolute bottom-6 right-8 hidden sm:flex items-center gap-2 opacity-70">
              <span className="h-2 w-2 rounded-full bg-[var(--color-cream)]/80" />
              <span className="h-2 w-2 rounded-full bg-[var(--color-cream)]/50" />
              <span className="h-2 w-2 rounded-full bg-[var(--color-cream)]/30" />
              <span className="h-px w-14 bg-[var(--color-cream)]/40" />
            </div>
            <div className="grid lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7">
                <Badge tone="ink">{t("home.workers.badge")}</Badge>
                <h2 className="mt-4 font-display text-4xl sm:text-5xl tracking-tight">
                  {t("home.workers.title")}
                </h2>
                <p className="mt-5 text-[var(--color-cream)]/90 max-w-xl leading-relaxed">
                  {t("home.workers.body")}
                </p>
              </div>
              <div className="lg:col-span-5 flex flex-col gap-3">
                <Button
                  href="/signup?role=worker"
                  size="lg"
                  variant="secondary"
                  className="w-full"
                >
                  {t("home.workers.cta")}
                </Button>
                <Button
                  href="/verification"
                  size="lg"
                  variant="ghost"
                  className="w-full !text-[var(--color-cream)] hover:!bg-white/10"
                >
                  {t("home.workers.docs")}
                </Button>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <Footer />
    </>
  );
}

function Card({
  children,
  className = "",
  accent,
}: {
  children: React.ReactNode;
  className?: string;
  accent: "ochre" | "sage" | "ink";
}) {
  const accentBar = {
    ochre: "bg-[var(--color-ochre-500)]",
    sage: "bg-[var(--color-sage-600)]",
    ink: "bg-[var(--color-ink)]",
  }[accent];

  return (
    <div
      className={`relative rounded-xl bg-[var(--color-paper)] border border-[var(--color-line)] shadow-lift p-5 ${className}`}
    >
      <span
        className={`absolute left-0 top-5 bottom-5 w-1 rounded-r ${accentBar}`}
      />
      {children}
    </div>
  );
}
