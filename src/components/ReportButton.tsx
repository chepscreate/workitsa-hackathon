"use client";

/**
 * Universal "Report this" button + modal. Drop it on any job / profile /
 * message / offer page. Writes to the `reports` Firestore collection which
 * the admin Moderation tab subscribes to.
 *
 * Guests are pushed to sign-in (reporters must be identifiable so we can
 * follow up + spot retaliatory false reports).
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { createReport } from "@/lib/reports";
import type { ReportReason, ReportTargetType } from "@/lib/types";
import Button from "./Button";

const REASONS: { id: ReportReason; label: string; hint: string }[] = [
  { id: "illegal", label: "Illegal activity", hint: "Drugs, weapons, stolen goods, money mule." },
  { id: "sexual", label: "Sexual services", hint: "Sex work, escorting, sexual solicitation." },
  { id: "scam", label: "Scam / fraud", hint: "Pay-to-apply, fake placements, advance fees." },
  { id: "harassment", label: "Harassment", hint: "Threats, racism, slurs, abuse." },
  { id: "violence", label: "Violence", hint: "Threats of harm, graphic content." },
  { id: "csam", label: "Child sexual content", hint: "Always escalated — no questions asked." },
  { id: "spam", label: "Spam", hint: "Duplicate posts, MLM, schemes." },
  { id: "other", label: "Something else", hint: "Explain in the box below." },
];

export default function ReportButton({
  targetType,
  targetId,
  targetParentId,
  targetUserUid,
  label = "Report",
  size = "sm",
  className = "",
}: {
  targetType: ReportTargetType;
  targetId: string;
  targetParentId?: string;
  /** UID of the user being reported (helps the admin queue group reports). */
  targetUserUid?: string;
  label?: string;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  // Portal target only exists client-side; gate on mount to stay SSR-safe.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [reason, setReason] = useState<ReportReason>("illegal");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onOpen = () => {
    if (!user) {
      router.push(`/signin?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname + window.location.search : "/")}`);
      return;
    }
    setOpen(true);
    setDone(false);
    setError(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (description.trim().length < 5) {
      setError("Add a short note (at least 5 characters) so we can act on this.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createReport({
        reporter: profile,
        targetType,
        targetId,
        ...(targetParentId ? { targetParentId } : {}),
        ...(targetUserUid ? { targetUserUid } : {}),
        reason,
        description: description.trim(),
      });
      setDone(true);
      setDescription("");
      setReason("illegal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send report.");
    } finally {
      setBusy(false);
    }
  };

  const sizeCls =
    size === "xs"
      ? "text-[11px] px-2 py-1"
      : size === "md"
        ? "text-sm px-4 py-2"
        : "text-xs px-3 py-1.5";

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        className={`inline-flex items-center gap-1 rounded-pill border border-[var(--color-line)] text-[var(--color-ink-muted)] hover:text-[var(--color-brick)] hover:border-[var(--color-brick)]/40 transition-colors ${sizeCls} ${className}`}
      >
        <span aria-hidden>⚑</span>
        {label}
      </button>

      {open && mounted && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-[var(--color-paper)] border border-[var(--color-line)] shadow-lift p-6 max-h-[90vh] overflow-y-auto"
          >
            {done ? (
              <>
                <h2 className="font-display text-2xl text-[var(--color-ink)]">
                  Thanks — we&apos;ve got it.
                </h2>
                <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
                  An admin will review your report between 06:00 and 22:00
                  SAST. The reported party won&apos;t see who reported them.
                  Urgent? Email{" "}
                  <a
                    href="mailto:tshepowayne@workitsa.co.za"
                    className="underline text-[var(--color-ochre-600)]"
                  >
                    tshepowayne@workitsa.co.za
                  </a>
                  .
                </p>
                <div className="mt-5 flex justify-end">
                  <Button onClick={() => setOpen(false)} variant="primary">
                    Done
                  </Button>
                </div>
              </>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <h2 className="font-display text-xl text-[var(--color-ink)]">
                    Report this {targetType}
                  </h2>
                  <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                    Reports are anonymous to the reported party. False
                    reports may affect your own account.
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-[var(--color-ink)] mb-2">
                    What&apos;s the problem?
                  </p>
                  <div className="space-y-1.5">
                    {REASONS.map((r) => (
                      <label
                        key={r.id}
                        className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                          reason === r.id
                            ? "border-[var(--color-ochre-500)] bg-[var(--color-ochre-50)]"
                            : "border-[var(--color-line)] hover:bg-[var(--color-cream-2)]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="report-reason"
                          checked={reason === r.id}
                          onChange={() => setReason(r.id)}
                          className="mt-1 accent-[var(--color-ochre-500)]"
                        />
                        <span>
                          <span className="block text-sm font-medium text-[var(--color-ink)]">
                            {r.label}
                          </span>
                          <span className="block text-[11px] text-[var(--color-ink-muted)]">
                            {r.hint}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="report-desc"
                    className="block text-sm font-medium text-[var(--color-ink)] mb-1.5"
                  >
                    Tell us what happened
                  </label>
                  <textarea
                    id="report-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="What did you see? Be specific."
                    className="w-full px-4 py-3 rounded-xl bg-[var(--color-paper)] border border-[var(--color-line)] focus:border-[var(--color-ochre-500)] focus:outline-none text-[var(--color-ink)] text-sm"
                    required
                  />
                  <p className="text-[10px] text-[var(--color-ink-muted)] text-right mt-1">
                    {description.length}/500
                  </p>
                </div>

                {error && (
                  <p className="text-sm text-[var(--color-brick)]">{error}</p>
                )}

                <div className="flex flex-wrap gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="px-5 py-2.5 rounded-pill text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                  >
                    Cancel
                  </button>
                  <Button type="submit" variant="primary" loading={busy} loadingText="Sending…">
                    Send report
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
