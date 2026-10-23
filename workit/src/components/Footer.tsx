"use client";

import Link from "next/link";
import Container from "./Container";
import Logo from "./Logo";
import WhatsAppSupport from "./WhatsAppSupport";
import { useTranslation } from "@/contexts/LocaleContext";

export default function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="mt-16 sm:mt-24 border-t border-[var(--color-line)] bg-[var(--color-cream-2)]">
      <Container className="py-12 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo size="md" showTagline />
          <p className="mt-4 max-w-sm text-sm text-[var(--color-ink-muted)]">
            {t("footer.tagline")}
          </p>
          {/* Renders nothing until NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER is set. */}
          <div className="mt-4">
            <WhatsAppSupport variant="link" label={t("footer.support")} />
          </div>
        </div>

        <div>
          <h4 className="font-display text-base mb-3">{t("footer.useWorkit")}</h4>
          <ul className="space-y-2 text-sm text-[var(--color-ink-soft)]">
            <li><Link href="/post-a-job">{t("nav.postJob")}</Link></li>
            <li><Link href="/find-work">{t("nav.findWork")}</Link></li>
            <li><Link href="/workers">{t("footer.browseWorkers")}</Link></li>
            <li><Link href="/categories">{t("footer.browseCategories")}</Link></li>
            <li><Link href="/how-it-works">{t("nav.howItWorks")}</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-display text-base mb-3">{t("footer.trustSafety")}</h4>
          <ul className="space-y-2 text-sm text-[var(--color-ink-soft)]">
            <li><Link href="/verification">{t("footer.verification")}</Link></li>
            <li><Link href="/safety">{t("footer.safetyGuide")}</Link></li>
            <li><Link href="/acceptable-use">{t("footer.acceptableUse")}</Link></li>
            <li><Link href="/terms">{t("footer.terms")}</Link></li>
            <li><Link href="/privacy">{t("footer.privacy")}</Link></li>
          </ul>
        </div>
      </Container>

      {/* Beadwork-inspired divider strip */}
      <div
        aria-hidden
        className="h-2 w-full"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, var(--color-ochre-500) 0 14px, var(--color-ink) 14px 22px, var(--color-sage-600) 22px 36px, var(--color-cream) 36px 44px)",
        }}
      />

      <div className="border-t border-[var(--color-line)]">
        <Container className="py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[var(--color-ink-muted)]">
          <div className="space-y-1">
            <p>
              Built by{" "}
              <span className="text-[var(--color-ink-soft)] font-medium">
                Tshepo M
              </span>{" "}
              ·{" "}
              <a
                href="mailto:tshepowayne@workitsa.co.za"
                className="underline decoration-[var(--color-ochre-300)] underline-offset-2 hover:text-[var(--color-ink)]"
              >
                tshepowayne@workitsa.co.za
              </a>
            </p>
            <p>
              A{" "}
              <span className="font-display italic text-[var(--color-ink-soft)]">
                Furthersky Solutions
              </span>{" "}
              product · © {new Date().getFullYear()} Workit
            </p>
          </div>
          <span className="text-right">
            Launching in Gauteng — coming soon to your province.
          </span>
        </Container>
      </div>
    </footer>
  );
}
