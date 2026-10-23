"use client";

/**
 * Tracks the last ~10 job IDs a user has opened. Stored per-device in
 * localStorage — no Firestore writes, no cost. Used to surface a
 * "Recently viewed" strip on /find-work for fast re-engagement.
 */

const KEY = "workit_recently_viewed_v1";
const MAX = 10;

export function recordView(jobId: string): void {
  if (typeof window === "undefined" || !jobId) return;
  try {
    const list = readList();
    const next = [jobId, ...list.filter((id) => id !== jobId)].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(next));
    // Let same-tab subscribers update immediately
    window.dispatchEvent(new CustomEvent("workit-recently-viewed"));
  } catch {
    /* ignore quota */
  }
}

export function readList(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function clearViewed(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent("workit-recently-viewed"));
}

/** Subscribe to changes. Returns an unsubscribe fn. */
export function onChange(cb: (ids: string[]) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb(readList());
  window.addEventListener("workit-recently-viewed", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("workit-recently-viewed", handler);
    window.removeEventListener("storage", handler);
  };
}
