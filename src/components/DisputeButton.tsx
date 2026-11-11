"use client";

import { useState } from "react";
import Button from "@/components/Button";
import { raiseDispute } from "@/lib/jobs";
import type { DisputeReason, Job, UserProfile } from "@/lib/types";

const REASONS: { id: DisputeReason; label: string }[] = [
  { id: "no_show", label: "Worker / employer didn't show up" },
  { id: "quality", label: "Work quality issue" },
  { id: "unsafe", label: "Unsafe situation" },
  { id: "payment", label: "Payment disagreement" },
  { id: "scope_changed", label: "Scope of work changed" },
  { id: "other", label: "Something else" },
];

export default function DisputeButton({
  job,
  me,
}: {
  job: Job;
  me: UserProfile;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<DisputeReason>("quality");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (description.trim().length < 10) {
      setError("Please describe the problem in at least 10 characters.");
      return;
    }
    setSubmitting(true);
    try {
      await raiseDispute({ job, raiser: me, reason, description });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not raise dispute.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-[var(--color-brick)] hover:underline"
      >
        Report a problem
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
          onClick={() => !submitting && setOpen(false)}
        >
          <form
            onSubmit={onSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl bg-[var(--color-paper)] p-6 shadow-lift space-y-4"
          >
            <div>
              <h2 className="font-display text-2xl">Report a problem</h2>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                The job will be frozen — neither side can mark it complete
                or rate it. A Workit admin will review and resolve.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">What happened?</label>
              <div className="space-y-2">
                {REASONS.map((r) => (
                  <label
                    key={r.id}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                      reason === r.id
                        ? "border-[var(--color-ochre-500)] bg-[var(--color-ochre-50)]"
                        : "border-[var(--color-line)] hover:bg-[var(--color-cream-2)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={r.id}
                      checked={reason === r.id}
                      onChange={() => setReason(r.id)}
                      className="accent-[var(--color-ochre-500)]"
                    />
                    <span className="text-sm">{r.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Tell us more
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Be specific. Times, amounts, what was promised vs. what happened."
                className="w-full px-4 py-3 rounded-md bg-[var(--color-paper)] border border-[var(--color-line)] focus:border-[var(--color-ochre-500)] focus:outline-none"
                required
                maxLength={1500}
              />
            </div>

            {error && (
              <p className="text-sm text-[var(--color-brick)]">{error}</p>
            )}

            <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setOpen(false)}
                className="px-5 py-3 rounded-pill text-[var(--color-ink-soft)] hover:bg-[var(--color-cream-2)]"
              >
                Cancel
              </button>
              <Button type="submit" variant="danger" loading={submitting} loadingText="Submitting…">
                Raise dispute
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
