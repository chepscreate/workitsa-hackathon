"use client";

import Container from "./Container";
import Badge from "./Badge";
import { useTranslation } from "@/contexts/LocaleContext";
import type { Messages } from "@/i18n/locales";

type QA = { qKey: keyof Messages; aKey: keyof Messages };

const items: QA[] = [
  { qKey: "faq.q1.q", aKey: "faq.q1.a" },
  { qKey: "faq.q2.q", aKey: "faq.q2.a" },
  { qKey: "faq.q3.q", aKey: "faq.q3.a" },
  { qKey: "faq.q4.q", aKey: "faq.q4.a" },
  { qKey: "faq.q5.q", aKey: "faq.q5.a" },
  { qKey: "faq.q6.q", aKey: "faq.q6.a" },
  { qKey: "faq.q7.q", aKey: "faq.q7.a" },
];

export default function Faq() {
  const { t } = useTranslation();
  return (
    <section
      id="faq"
      className="py-16 sm:py-20 bg-[var(--color-cream-2)] border-y border-[var(--color-line)]"
    >
      <Container>
        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4" data-reveal>
            <Badge tone="ochre">{t("faq.badge")}</Badge>
            <h2 className="mt-4 font-display text-4xl sm:text-5xl tracking-tight">
              {t("faq.title")}
            </h2>
            <p className="mt-4 text-[var(--color-ink-soft)]">
              {t("faq.contactPre")}
              <a
                href="mailto:tshepowayne@workitsa.co.za"
                className="underline decoration-[var(--color-ochre-500)] underline-offset-4 hover:text-[var(--color-ink)]"
              >
                {t("faq.contactLink")}
              </a>
              {t("faq.contactPost")}
            </p>
          </div>
          <div className="lg:col-span-8 divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]" data-reveal>
            {items.map((item, i) => (
              <details key={i} className="group py-5">
                <summary className="flex items-center justify-between gap-6 cursor-pointer list-none">
                  <h3 className="font-display text-xl text-[var(--color-ink)] transition-colors group-hover:text-[var(--color-ochre-600)] group-open:text-[var(--color-ochre-600)]">
                    {t(item.qKey)}
                  </h3>
                  <span
                    aria-hidden
                    className="flex-shrink-0 w-7 h-7 rounded-full border border-[var(--color-line)] flex items-center justify-center text-[var(--color-ink-soft)] transition-all group-open:rotate-45 group-open:border-[var(--color-ochre-300)] group-open:text-[var(--color-ochre-600)] group-hover:border-[var(--color-ochre-300)] bg-[var(--color-paper)]"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-[var(--color-ink-soft)] leading-relaxed max-w-2xl group-open:animate-[slide-up-in_240ms_ease-out_both] motion-reduce:animate-none">
                  {t(item.aKey)}
                </p>
              </details>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
