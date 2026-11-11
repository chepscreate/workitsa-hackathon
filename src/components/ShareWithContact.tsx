"use client";

/**
 * "Share with a trusted contact" — a one-tap safety net for an active job.
 *
 * Before going to (or hosting) a stranger, the worker or employer can fire off a
 * message to family/a friend with what they're doing, where, who with, when, and
 * a link to the job — via the native share sheet (WhatsApp/SMS/etc. on mobile),
 * a direct WhatsApp link, or copy. No backend: it composes a message from the
 * job the person can already see. Knowing someone knows where you are is the
 * single biggest perceived-safety win for low-trust, in-person gig work.
 */

import { useState } from "react";
import { track } from "@/lib/analytics";
import { buildSafetyMessage } from "@/lib/trusted-contact";
import type { Job } from "@/lib/types";

export default function ShareWithContact({
  job,
  role,
  myName,
}: {
  job: Job;
  role: "employer" | "worker";
  myName?: string;
}) {
  const [copied, setCopied] = useState(false);

  const message = buildSafetyMessage(job, role, myName);
  const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      track("safety_share", { method: "copy" });
      setTimeout(() => setCopied(false), 2200);
    } catch {
      /* ignore */
    }
  };

  const nativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Workit — safety check-in", text: message });
        track("safety_share", { method: "native" });
      } catch {
        /* cancelled — no-op */
      }
    } else {
      void copy();
    }
  };

  return (
    <section className="mt-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-cream-2)] p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--color-ink)]">
            🛟 Tell someone where you are
          </p>
          <p className="mt-1 text-xs text-[var(--color-ink-soft)] max-w-md">
            Share this job with a family member or friend before you start — what
            it is, where, who with, and a link. Staying safe is staying seen.
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={nativeShare}
          className="px-4 py-2 rounded-pill text-xs font-medium bg-[var(--color-ink)] text-[var(--color-cream)] hover:opacity-90"
        >
          Share with a contact
        </button>
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track("safety_share", { method: "whatsapp" })}
          className="px-4 py-2 rounded-pill text-xs font-medium border border-[var(--color-sage-400)] text-[var(--color-sage-700)] hover:bg-[var(--color-sage-100)]/50"
        >
          WhatsApp
        </a>
        <button
          type="button"
          onClick={copy}
          className="px-4 py-2 rounded-pill text-xs font-medium border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:bg-[var(--color-cream)]"
        >
          {copied ? "Copied ✓" : "Copy message"}
        </button>
      </div>
    </section>
  );
}
