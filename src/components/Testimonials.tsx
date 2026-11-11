"use client";

import Container from "./Container";
import Badge from "./Badge";
import { useTranslation } from "@/contexts/LocaleContext";
import type { Messages } from "@/i18n/locales";

type Quote = {
  name: string;
  roleKey: keyof Messages;
  area: string;
  initial: string;
  tint: "ochre" | "sage" | "ink";
  quoteKey: keyof Messages;
  jobKey: keyof Messages;
};

// Names and areas are illustrative and stay as-is; the spoken copy (quote,
// job tag, role) flows through translation keys so the language switcher
// transforms it. See src/i18n.
const quotes: Quote[] = [
  {
    name: "Refiloe M.",
    roleKey: "stories.rolePosted",
    area: "Soweto",
    initial: "R",
    tint: "ochre",
    jobKey: "stories.q1.job",
    quoteKey: "stories.q1.quote",
  },
  {
    name: "Sipho M.",
    roleKey: "stories.roleWorker",
    area: "Tembisa",
    initial: "S",
    tint: "sage",
    jobKey: "stories.q2.job",
    quoteKey: "stories.q2.quote",
  },
  {
    name: "Anele T.",
    roleKey: "stories.rolePosted",
    area: "Sandton",
    initial: "A",
    tint: "ink",
    jobKey: "stories.q3.job",
    quoteKey: "stories.q3.quote",
  },
];

const tintBg: Record<Quote["tint"], string> = {
  ochre: "bg-[var(--color-ochre-300)]",
  sage: "bg-[var(--color-sage-400)]",
  ink: "bg-[var(--color-ink-soft)] text-[var(--color-cream)]",
};

export default function Testimonials() {
  const { t } = useTranslation();
  return (
    <section id="stories" className="py-16 sm:py-20">
      <Container>
        <div className="flex items-end justify-between flex-wrap gap-4 mb-12" data-reveal>
          <div className="max-w-xl">
            <Badge tone="sage">{t("stories.badge")}</Badge>
            <h2 className="mt-4 font-display text-4xl sm:text-5xl tracking-tight">
              {t("stories.title")}
            </h2>
            <p className="mt-3 text-[var(--color-ink-soft)]">
              {t("stories.subtitle")}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-5" data-reveal-group>
          {quotes.map((q) => (
            <figure
              key={q.name}
              className="relative rounded-xl p-7 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft flex flex-col hover:shadow-lift hover:-translate-y-1 hover:border-[var(--color-ochre-300)] transition-all duration-300"
            >
              {/* Big quotation mark */}
              <span
                aria-hidden
                className="absolute -top-4 left-6 font-display text-7xl leading-none text-[var(--color-ochre-300)] select-none"
              >
                &ldquo;
              </span>

              <span aria-hidden className="mt-4 text-sm tracking-[0.2em] text-[var(--color-ochre-500)]">
                ★★★★★
              </span>
              <blockquote className="font-display text-lg leading-snug text-[var(--color-ink)] mt-2">
                {t(q.quoteKey)}
              </blockquote>

              {/* The job tag used to sit in its own right-aligned column,
                  which squeezed the name+role to ~80px on a 3-col grid and
                  forced "Posted a job" to wrap. Stacking it under role/area
                  inside the same flex-1 column gives the name room to breathe
                  and reads as a single attribution block. */}
              <figcaption className="mt-6 pt-5 border-t border-[var(--color-line)] flex items-center gap-3">
                <span
                  className={`w-11 h-11 rounded-full flex items-center justify-center font-display text-lg flex-shrink-0 ${tintBg[q.tint]}`}
                >
                  {q.initial}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{q.name}</p>
                  <p className="text-xs text-[var(--color-ink-muted)]">
                    {t(q.roleKey)} · {q.area}
                  </p>
                  <p className="mt-1.5 text-[10px] uppercase tracking-widest text-[var(--color-ink-muted)]">
                    {t(q.jobKey)}
                  </p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>

        <p className="mt-8 text-xs text-[var(--color-ink-muted)] italic">
          {t("stories.disclaimer")}
        </p>
      </Container>
    </section>
  );
}
