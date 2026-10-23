"use client";

/**
 * Auto-arm safety share — surfaced the moment a worker taps "I'm on my way".
 * Pre-fills a WhatsApp safety check-in to a saved trusted contact (one tap to
 * send); if none is saved yet, an inline mini-form captures one. The contact
 * lives only on this device (see lib/trusted-contact.ts) — it's never sent to
 * our servers, only into the WhatsApp message the worker chooses to send.
 */

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import {
  buildSafetyMessage,
  getTrustedContact,
  isPlausiblePhone,
  onTrustedContactChange,
  setTrustedContact,
  toWaNumber,
  type TrustedContact,
} from "@/lib/trusted-contact";
import type { Job } from "@/lib/types";

export default function TrustedContactArm({
  job,
  role,
  myName,
}: {
  job: Job;
  role: "employer" | "worker";
  myName?: string;
}) {
  const [contact, setContact] = useState<TrustedContact | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const sync = () => setContact(getTrustedContact());
    sync();
    return onTrustedContactChange(sync);
  }, []);

  const message = buildSafetyMessage(job, role, myName);
  const waHref = (p: string) =>
    `https://wa.me/${toWaNumber(p)}?text=${encodeURIComponent(message)}`;

  const flashSent = () => {
    setSent(true);
    setTimeout(() => setSent(false), 2500);
  };

  const saveAndSend = () => {
    if (!isPlausiblePhone(phone)) return;
    const c = { name: name.trim() || "My contact", phone: phone.trim() };
    setTrustedContact(c);
    setContact(c);
    setEditing(false);
    track("trusted_contact_saved");
    // The click is the user gesture, so window.open is allowed here.
    window.open(waHref(c.phone), "_blank", "noopener,noreferrer");
    track("trusted_contact_armed", { saved: true });
    flashSent();
  };

  const inputCls =
    "rounded-md bg-[var(--color-paper)] border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-sage-400)]";

  return (
    <section className="rounded-xl border border-[var(--color-sage-400)] bg-[var(--color-sage-100)]/40 p-4">
      <p className="text-sm font-medium text-[var(--color-ink)]">
        🛟 Let someone know you&apos;re heading out
      </p>

      {contact && !editing ? (
        <>
          <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
            One tap sends {contact.name} a safety check-in — the job, where it is, who
            with, and a link.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a
              href={waHref(contact.phone)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                track("trusted_contact_armed", { saved: false });
                flashSent();
              }}
              className="px-4 py-2 rounded-pill text-xs font-medium bg-[var(--color-sage-700)] text-white hover:opacity-90"
            >
              {sent ? "Sent ✓" : `Send to ${contact.name} on WhatsApp`}
            </a>
            <button
              type="button"
              onClick={() => {
                setName(contact.name);
                setPhone(contact.phone);
                setEditing(true);
              }}
              className="px-3 py-2 rounded-pill text-xs font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-cream)]"
            >
              Change contact
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
            Save a family member or friend (kept only on this phone). We&apos;ll pre-fill a
            WhatsApp safety message to them each time you head to a job.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input
              aria-label="Trusted contact name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (e.g. Mom)"
              className={inputCls}
            />
            <input
              aria-label="Trusted contact WhatsApp number"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="WhatsApp number (082…)"
              className={inputCls}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveAndSend}
              disabled={!isPlausiblePhone(phone)}
              className="px-4 py-2 rounded-pill text-xs font-medium bg-[var(--color-sage-700)] text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save &amp; send on WhatsApp
            </button>
            {contact && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-3 py-2 rounded-pill text-xs font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-cream)]"
              >
                Cancel
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
