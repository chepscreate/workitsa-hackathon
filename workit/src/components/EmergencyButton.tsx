"use client";

import { useState } from "react";
import { captureLocation, triggerEmergency } from "@/lib/jobs";

export default function EmergencyButton({
  jobId,
  uid,
  name,
  role,
}: {
  jobId: string;
  uid: string;
  name?: string;
  role?: "employer" | "worker";
}) {
  const [open, setOpen] = useState(false);
  const [alerting, setAlerting] = useState(false);

  const onConfirm = async () => {
    setAlerting(true);
    // Grab a GPS fix (usually instant when location's been used during the job;
    // hard-capped so the SAPS call is never held up), record the alert so the
    // safety team is paged in real time, then dial.
    let location = null;
    try {
      location = await captureLocation(3000);
    } catch {
      /* no location — proceed anyway */
    }
    try {
      await triggerEmergency(jobId, uid, { name, role, location });
    } catch {
      /* don't block the call */
    }
    window.location.href = "tel:10111";
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Emergency: call SAPS"
        className="fixed z-40 right-4 bottom-20 sm:right-6 sm:bottom-6 w-16 h-16 rounded-full bg-[var(--color-brick-solid)] text-white shadow-lift hover:scale-105 active:scale-95 transition-transform flex items-center justify-center"
      >
        <span className="font-display text-xl leading-none">SOS</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[var(--color-paper)] p-6 shadow-lift"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-2xl text-[var(--color-brick)]">
              Call SAPS — 10111?
            </h2>
            <p className="mt-3 text-[var(--color-ink-soft)] text-sm leading-relaxed">
              This dials the South African Police Service (10111) from your phone
              and pages the Workit safety team in real time — with your current
              location — so we can act immediately. Only use this if you feel
              unsafe right now.
            </p>
            <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2 justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={alerting}
                className="px-5 py-3 rounded-pill text-[var(--color-ink-soft)] hover:bg-[var(--color-cream-2)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={alerting}
                className="px-5 py-3 rounded-pill bg-[var(--color-brick-solid)] text-white font-medium hover:opacity-90 disabled:opacity-70"
              >
                {alerting ? "Alerting + dialling…" : "Yes — call 10111 now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
