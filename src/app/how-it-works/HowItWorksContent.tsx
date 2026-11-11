"use client";

import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import PageHero from "@/components/PageHero";
import { useTranslation } from "@/contexts/LocaleContext";

/**
 * How-it-works page body. Client component so every string flows through
 * useTranslation(); the server page.tsx keeps the SEO metadata and renders this.
 */
export default function HowItWorksContent() {
  const { t } = useTranslation();

  return (
    <>
      <Header />
      <main className="flex-1">
        <Container className="py-14 max-w-4xl">
          <PageHero
            eyebrow={t("nav.howItWorks")}
            eyebrowTone="sage"
            title={t("hiw.hero.title")}
            intro={t("hiw.hero.intro")}
          />

          {/* ---------------- EMPLOYERS ---------------- */}
          <section className="mt-12">
            <h2 className="font-display text-3xl text-[var(--color-ink)]" data-reveal>
              {t("hiw.emp.h2")}
            </h2>
            <p className="mt-2 text-[var(--color-ink-soft)]">{t("hiw.emp.sub")}</p>

            <ol className="mt-6 space-y-4" data-reveal-group>
              <Step n={1} title={t("hiw.emp.s1.t")} body={t("hiw.emp.s1.b")} />
              <Step n={2} title={t("hiw.emp.s2.t")} body={t("hiw.emp.s2.b")} />
              <Step n={3} title={t("hiw.emp.s3.t")} body={t("hiw.emp.s3.b")} />
              <Step n={4} title={t("hiw.emp.s4.t")} body={t("hiw.emp.s4.b")} />
              <Step n={5} title={t("hiw.emp.s5.t")} body={t("hiw.emp.s5.b")} />
            </ol>

            <div className="mt-6">
              <Link
                href="/post-a-job"
                className="inline-flex px-6 py-3 rounded-pill bg-[var(--color-ink)] text-[var(--color-cream)] text-sm font-medium hover:opacity-90"
              >
                {t("hiw.emp.cta")}
              </Link>
            </div>
          </section>

          {/* ---------------- WORKERS ---------------- */}
          <section className="mt-16">
            <h2 className="font-display text-3xl text-[var(--color-ink)]" data-reveal>
              {t("hiw.wk.h2")}
            </h2>
            <p className="mt-2 text-[var(--color-ink-soft)]">{t("hiw.wk.sub")}</p>

            <ol className="mt-6 space-y-4" data-reveal-group>
              <Step n={1} title={t("hiw.wk.s1.t")} body={t("hiw.wk.s1.b")} />
              <Step
                n={2}
                title={t("hiw.wk.s2.t")}
                body={t("hiw.wk.s2.b")}
                link={{ href: "/verification", label: t("hiw.wk.s2.link") }}
              />
              <Step
                n={3}
                title={t("hiw.wk.s3.t")}
                body={t("hiw.wk.s3.b")}
                link={{ href: "/find-work", label: t("hiw.wk.s3.link") }}
              />
              <Step n={4} title={t("hiw.wk.s4.t")} body={t("hiw.wk.s4.b")} />
              <Step n={5} title={t("hiw.wk.s5.t")} body={t("hiw.wk.s5.b")} />
            </ol>

            <div className="mt-6">
              <Link
                href="/signup?role=worker"
                className="inline-flex px-6 py-3 rounded-pill bg-[var(--color-ink)] text-[var(--color-cream)] text-sm font-medium hover:opacity-90"
              >
                {t("hiw.wk.cta")}
              </Link>
            </div>
          </section>

          {/* ---------------- KEY THINGS TO KNOW ---------------- */}
          <section className="mt-16">
            <h2 className="font-display text-3xl text-[var(--color-ink)]" data-reveal>
              {t("hiw.know.h2")}
            </h2>

            <div className="mt-6 grid md:grid-cols-2 gap-5" data-reveal-group>
              <Card title={t("hiw.know.pricing.t")} body={t("hiw.know.pricing.b")} />
              <Card title={t("hiw.know.payment.t")} body={t("hiw.know.payment.b")} />
              <Card
                title={t("hiw.know.trust.t")}
                body={t("hiw.know.trust.b")}
                link={{ href: "/safety", label: t("hiw.know.trust.link") }}
              />
              <Card title={t("hiw.know.disputes.t")} body={t("hiw.know.disputes.b")} />
              <Card title={t("hiw.know.where.t")} body={t("hiw.know.where.b")} />
              <Card
                title={t("hiw.know.cats.t")}
                body={t("hiw.know.cats.b")}
                link={{ href: "/categories", label: t("hiw.know.cats.link") }}
              />
            </div>
          </section>

          {/* ---------------- FAQ ---------------- */}
          <section id="faq" className="mt-16 scroll-mt-24">
            <h2 className="font-display text-3xl text-[var(--color-ink)]" data-reveal>
              {t("hiw.faq.h2")}
            </h2>
            <div className="mt-6 space-y-3" data-reveal-group>
              <Faq q={t("hiw.faq.q1")} a={t("hiw.faq.a1")} />
              <Faq q={t("hiw.faq.q2")} a={t("hiw.faq.a2")} />
              <Faq q={t("hiw.faq.q3")} a={t("hiw.faq.a3")} />
              <Faq q={t("hiw.faq.q4")} a={t("hiw.faq.a4")} />
              <Faq q={t("hiw.faq.q5")} a={t("hiw.faq.a5")} />
              <Faq q={t("hiw.faq.q6")} a={t("hiw.faq.a6")} />
            </div>
          </section>

          <div className="mt-16 rounded-2xl p-7 bg-[var(--color-ochre-50)] border border-[var(--color-ochre-300)] text-center">
            <h2 className="font-display text-2xl text-[var(--color-ink)]">
              {t("hiw.cta.h2")}
            </h2>
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              <Link
                href="/post-a-job"
                className="px-6 py-3 rounded-pill bg-[var(--color-ink)] text-[var(--color-cream)] text-sm font-medium hover:opacity-90"
              >
                {t("hiw.cta.post")}
              </Link>
              <Link
                href="/signup?role=worker"
                className="px-6 py-3 rounded-pill border border-[var(--color-ink)]/30 text-[var(--color-ink)] text-sm font-medium hover:bg-white/40"
              >
                {t("hiw.cta.worker")}
              </Link>
            </div>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}

type OptionalLink = { href: string; label: string };

function Step({
  n,
  title,
  body,
  link,
}: {
  n: number;
  title: string;
  body: string;
  link?: OptionalLink;
}) {
  return (
    <li className="rounded-xl p-5 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft flex gap-4 items-start">
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--color-ochre-500)] text-[var(--color-cream)] font-display text-lg flex items-center justify-center">
        {n}
      </div>
      <div>
        <h3 className="font-display text-lg text-[var(--color-ink)]">{title}</h3>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)] leading-relaxed">
          {body}
          {link && (
            <>
              {" "}
              <Link href={link.href} className="underline">
                {link.label}
              </Link>
            </>
          )}
        </p>
      </div>
    </li>
  );
}

function Card({
  title,
  body,
  link,
}: {
  title: string;
  body: string;
  link?: OptionalLink;
}) {
  return (
    <div className="rounded-xl p-5 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
      <h3 className="font-display text-lg text-[var(--color-ink)]">{title}</h3>
      <p className="mt-2 text-sm text-[var(--color-ink-soft)] leading-relaxed">
        {body}
        {link && (
          <>
            {" "}
            <Link href={link.href} className="underline">
              {link.label}
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] open:shadow-soft">
      <summary className="cursor-pointer list-none p-4 flex items-center justify-between gap-3">
        <span className="font-medium text-[var(--color-ink)]">{q}</span>
        <span
          aria-hidden
          className="text-[var(--color-ink-muted)] transition-transform group-open:rotate-45 text-lg"
        >
          +
        </span>
      </summary>
      <div className="px-4 pb-4 text-sm text-[var(--color-ink-soft)] leading-relaxed">
        {a}
      </div>
    </details>
  );
}
