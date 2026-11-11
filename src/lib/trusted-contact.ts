"use client";

/**
 * Trusted contact — a "safety net" person a worker can notify when they head out
 * to a job. Stored per-device in localStorage only (NO Firestore): a third
 * party's phone number is their personal info, and keeping it on-device avoids
 * processing/storing it server-side (POPIA-friendly) — it never leaves the phone
 * except into the WhatsApp message the worker themselves sends.
 *
 * Powers the "auto-arm" safety loop: when the worker taps "I'm on my way", we
 * pre-fill a WhatsApp safety check-in to their saved contact — one tap to send,
 * so being seen is the default rather than a button people forget to press.
 */

import type { Job } from "./types";

export type TrustedContact = { name: string; phone: string };

const KEY = "workit_trusted_contact_v1";
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://workitsa.co.za";

export function getTrustedContact(): TrustedContact | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p && typeof p.name === "string" && typeof p.phone === "string" && p.phone.trim()) {
      return { name: p.name, phone: p.phone };
    }
    return null;
  } catch {
    return null;
  }
}

export function setTrustedContact(c: TrustedContact | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!c || !c.phone.trim()) {
      window.localStorage.removeItem(KEY);
    } else {
      window.localStorage.setItem(
        KEY,
        JSON.stringify({ name: c.name.trim(), phone: c.phone.trim() }),
      );
    }
    window.dispatchEvent(new CustomEvent("workit-trusted-contact"));
  } catch {
    /* ignore quota */
  }
}

/** Subscribe to changes (same-tab + cross-tab). Returns an unsubscribe fn. */
export function onTrustedContactChange(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("workit-trusted-contact", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("workit-trusted-contact", cb);
    window.removeEventListener("storage", cb);
  };
}

/**
 * Normalise an SA phone number to wa.me international format (digits only):
 *   082 123 4567 → 27821234567 · +27 82 … → 2782… · already-27 kept as-is.
 */
export function toWaNumber(phone: string): string {
  let d = phone.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  d = d.replace(/\D/g, "");
  if (d.startsWith("0")) d = `27${d.slice(1)}`;
  return d;
}

/** Loose check that a number is plausibly dialable (after normalising). */
export function isPlausiblePhone(phone: string): boolean {
  const d = toWaNumber(phone);
  return d.length >= 10 && d.length <= 15;
}

/**
 * The safety check-in message shared with a trusted contact — what the job is,
 * where, who with, a map pin (when known) and a link. Shared by ShareWithContact
 * and the auto-arm flow so the wording stays identical.
 */
export function buildSafetyMessage(
  job: Job,
  role: "employer" | "worker",
  myName?: string,
): string {
  const otherName =
    role === "worker" ? job.employerName : job.assignedWorkerName ?? "the other person";
  const where = [job.suburb, job.city].filter(Boolean).join(", ");
  const mapLink =
    typeof job.lat === "number" && typeof job.lng === "number"
      ? ` Location: https://www.google.com/maps?q=${job.lat},${job.lng}.`
      : "";
  const jobUrl = `${SITE}/jobs?id=${job.id}`;
  const me = myName?.split(" ")[0] ?? "I";

  return (
    `🛟 Safety check-in from ${me} on Workit.\n`
    + `I'm ${role === "worker" ? "doing a job" : "having work done"}: "${job.title}"`
    + `${where ? ` in ${where}` : ""}, with ${otherName}.${mapLink}\n`
    + `Details: ${jobUrl}\n`
    + `If you don't hear from me, please check in. Emergencies: SAPS 10111.`
  );
}
