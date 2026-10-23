"use client";

import { useState } from "react";
import WhatsAppShare from "./WhatsAppShare";
import type { UserProfile } from "@/lib/types";

/**
 * Compact share card on a public worker profile. Lets the worker (or anyone
 * who likes them) copy the link or send it to a WhatsApp contact in one tap.
 * The URL is built off NEXT_PUBLIC_SITE_URL so it works correctly even when
 * generated on localhost.
 */
export default function ProfileShareCard({ profile }: { profile: UserProfile }) {
  const [copied, setCopied] = useState(false);
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://workitsa.co.za";
  const url = `${base}/u/?id=${profile.uid}`;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — fall back to selecting the input */
      const el = document.getElementById("profile-share-url") as HTMLInputElement | null;
      el?.select();
    }
  };

  return (
    <section className="rounded-2xl p-6 bg-[var(--color-cream-2)] border border-[var(--color-line)]">
      <h2 className="font-display text-xl">Share this profile</h2>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
        Send {profile.displayName.split(" ")[0]}&apos;s Workit page to a
        neighbour, family group or suburb WhatsApp chat.
      </p>

      <div className="mt-4 flex items-center gap-2">
        <input
          id="profile-share-url"
          type="text"
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 min-w-0 px-3 py-2 rounded-md bg-[var(--color-paper)] border border-[var(--color-line)] text-xs text-[var(--color-ink-soft)] font-mono truncate"
        />
        <button
          type="button"
          onClick={onCopy}
          className="px-4 py-2 rounded-pill bg-[var(--color-ink)] text-[var(--color-cream)] text-sm font-medium hover:bg-[var(--color-ink-soft)] flex-shrink-0"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>

      <div className="mt-3">
        <WhatsAppShare
          variant="button"
          text={`Workit — ${profile.displayName}${
            profile.categories?.length
              ? ` · ${profile.categories.slice(0, 3).join(", ")}`
              : ""
          }`}
          url={url}
        />
      </div>
    </section>
  );
}
