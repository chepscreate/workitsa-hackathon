"use client";

/**
 * Firebase Performance Monitoring.
 *
 * Captures automatic traces (page load, network requests) plus the named custom
 * traces below. Like analytics, this is telemetry, so it's gated on cookie
 * consent (POPIA) and no-ops during SSR / before consent / without config.
 *
 * Custom traces:
 *   post_job                 — createJob Firestore write
 *   load_jobs_list           — find-work feed first paint (realtime subscribe)
 *   upload_verification_doc  — verification document upload
 */
import { getPerformance, trace, type FirebasePerformance } from "firebase/performance";
import { firebaseConfigured, getFirebaseApp } from "./firebase";

const CONSENT_KEY = "workit_cookie_consent_v2"; // must match CookieBanner.tsx

let perf: FirebasePerformance | null = null;
let triedInit = false;

function hasConsent(): boolean {
  try {
    return window.localStorage.getItem(CONSENT_KEY) === "accepted";
  } catch {
    return false;
  }
}

function getPerf(): FirebasePerformance | null {
  if (typeof window === "undefined" || !firebaseConfigured || !hasConsent()) {
    return null;
  }
  if (!perf && !triedInit) {
    triedInit = true;
    try {
      perf = getPerformance(getFirebaseApp());
    } catch {
      perf = null;
    }
  }
  return perf;
}

/**
 * Call once early (client mount) so the automatic page-load + network traces
 * start collecting. Consent-gated; safe to call before consent (no-ops, and the
 * next call after consent initialises it).
 */
export function initPerformance(): void {
  getPerf();
}

/**
 * Wrap an async operation in a custom trace. Never throws and never changes the
 * wrapped result — analytics/perf must never break a real user action.
 */
export async function measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const p = getPerf();
  if (!p) return fn();
  let t: ReturnType<typeof trace> | null = null;
  try {
    t = trace(p, name);
    t.start();
  } catch {
    t = null;
  }
  try {
    return await fn();
  } finally {
    try {
      t?.stop();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Start a custom trace and get back a one-shot stop(). For flows that aren't a
 * single promise — e.g. a realtime subscription where "done" is the first
 * snapshot. Calling stop() more than once is a no-op.
 */
export function startTrace(name: string): () => void {
  const p = getPerf();
  if (!p) return () => {};
  let t: ReturnType<typeof trace> | null = null;
  try {
    t = trace(p, name);
    t.start();
  } catch {
    return () => {};
  }
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    try {
      t?.stop();
    } catch {
      /* ignore */
    }
  };
}
