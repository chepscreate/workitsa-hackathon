"use client";

import { useState } from "react";
import { referralProgress, type UserProfile } from "@/lib/types";
import { track } from "@/lib/analytics";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://workitsa.co.za";

export default function ReferralCard({ profile }: { profile: UserProfile }) {
  const code = profile.referralCode;
  const [copied, setCopied] = useState(false);

  if (!code) return null;

  const count = profile.referralsCount ?? 0;
  const { earned, next } = referralProgress(count);
  const link = `${SITE}/signup?ref=${code}`;
  const message =
    profile.role === "worker"
      ? `I'm on Workit finding honest work near me in South Africa — verified, fair prices, paid on completion. Join free with my code ${code}: ${link}`
      : `I use Workit to get jobs done by trusted, verified workers near me. Join free with my code ${code}: ${link}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

  // Progress toward the next reward badge (or full bar once maxed out).
  const pct = next ? Math.min(100, Math.round((count / next.at) * 100)) : 100;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      track("referral_share", { method: "copy" });
      setTimeout(() => setCopied(false), 2200);
    } catch {
      /* ignore */
    }
  };

  const nativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Join me on Workit", text: message, url: link });
        track("referral_share", { method: "native" });
      } catch {
        /* user cancelled — no-op */
      }
    } else {
      copy();
    }
  };

  return (
    <section className="rounded-2xl p-6 mb-6 bg-[var(--color-cream-2)] border border-[var(--color-line)]">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
            Invite &amp; earn
          </p>
          <p className="mt-1 font-display text-xl text-[var(--color-ink)]">
            Your code · <span className="text-[var(--color-ochre-600)]">{code}</span>
          </p>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)] max-w-md">
            Invite friends to Workit. Each one who joins with your code earns you a
            public badge that shows employers you&apos;re an active, trusted member.
          </p>
        </div>
        {earned && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-xs font-medium bg-[var(--color-sage-100)] text-[var(--color-sage-700)] border border-[var(--color-sage-400)]/40 flex-shrink-0">
            🏅 {earned.label}
          </span>
        )}
      </div>

      {/* Progress to next reward */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between text-xs text-[var(--color-ink-muted)] mb-1.5">
          <span>
            <b className="text-[var(--color-ink)]">{count}</b>{" "}
            {count === 1 ? "friend has" : "friends have"} joined
          </span>
          {next ? (
            <span>
              {next.at - count} more → <b className="text-[var(--color-ink)]">{next.label}</b> badge
            </span>
          ) : (
            <span className="text-[var(--color-sage-700)]">Top tier reached 🎉</span>
          )}
        </div>
        <div className="h-2.5 rounded-full bg-[var(--color-paper)] border border-[var(--color-line)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--color-sage-600)] transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Share actions */}
      <div className="mt-5 flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={nativeShare}
          className="px-5 py-2.5 rounded-pill text-sm font-medium bg-[var(--color-ink)] text-[var(--color-cream)] hover:opacity-90 active:scale-[0.98] transition-[opacity,transform]"
        >
          Share invite
        </button>
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track("referral_share", { method: "whatsapp" })}
          className="px-4 py-2.5 rounded-pill text-sm bg-[var(--color-sage-600)] text-[var(--color-cream)] hover:bg-[var(--color-sage-700)] active:scale-[0.98] transition-[background-color,transform]"
        >
          WhatsApp
        </a>
        <button
          type="button"
          onClick={copy}
          className="px-4 py-2.5 rounded-pill text-sm border border-[var(--color-line)] bg-[var(--color-paper)] hover:bg-[var(--color-cream)] text-[var(--color-ink)] active:scale-[0.98] transition-[background-color,transform]"
        >
          {copied ? "Copied ✓" : "Copy link"}
        </button>
      </div>
    </section>
  );
}
