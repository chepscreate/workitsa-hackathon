"use client";

/**
 * Firebase Analytics (GA4) — product funnel events.
 *
 * POPIA / consent: analytics only runs after the user taps "Accept" on the
 * cookie banner (localStorage `workit_cookie_consent_v2` — see
 * CookieBanner.tsx). Decline or no answer = every call is a silent no-op,
 * which makes the banner a real runtime gate rather than a signal.
 *
 * `track()` is fire-and-forget and never throws — analytics must never break
 * a signup or a job post. It also no-ops during SSR, in unsupported browsers
 * (some in-app webviews), and when the measurementId env is absent.
 *
 * Funnel events used (keep this list current):
 *   sign_up { method, role, user_type }   — profile doc created (all auth paths)
 *   profile_completed { role }            — first profile save post-signup
 *   job_posted { job_category, job_budget, area, has_photos }
 *   job_offer_sent { job_category, offer_type }   — worker accepts/counters
 *   job_accepted { job_category, is_crew_job }    — employer picks a worker
 *   job_started { job_category }                  — status → in_progress
 *   job_completed { job_category, value, currency } — worker marked done
 *   job_confirmed { price }               — employer confirmed; funnel's end
 *   rating_submitted { rater_type, rating }
 *   worker_verification_submitted         — worker submits ID/proof docs
 *   worker_verified { badge }             — admin approves a worker
 *   sos_triggered                         — SOS pressed (no PII/location)
 *   page_view                             — SPA route changes (AnalyticsPageViews)
 *
 * User property: user_type { worker | customer } — set after login.
 */

import {
  getAnalytics,
  isSupported,
  logEvent,
  setUserProperties,
  type Analytics,
} from "firebase/analytics";
import { firebaseConfigured, getFirebaseApp } from "./firebase";

const CONSENT_KEY = "workit_cookie_consent_v2"; // must match CookieBanner.tsx

let initPromise: Promise<Analytics | null> | null = null;

function hasConsent(): boolean {
  try {
    return window.localStorage.getItem(CONSENT_KEY) === "accepted";
  } catch {
    return false;
  }
}

/**
 * Local/test hosts are excluded so the founder's own testing never pollutes the
 * GA4 funnel. The one exception is debug mode (below): add `?ga_debug=1` to the
 * URL to send events to GA4 DebugView while developing — those land in DebugView
 * and are easy to tell apart from real traffic.
 */
function isLocalhost(): boolean {
  try {
    const h = window.location.hostname;
    return (
      h === "localhost"
      || h === "127.0.0.1"
      || h === "::1"
      || h.endsWith(".local")
      || h.endsWith(".test")
    );
  } catch {
    return false;
  }
}

/** DebugView toggle: `?ga_debug=1` once, or localStorage `workit_ga_debug=1`. */
function debugEnabled(): boolean {
  try {
    if (window.location.search.includes("ga_debug=1")) {
      window.localStorage.setItem("workit_ga_debug", "1");
      return true;
    }
    return window.localStorage.getItem("workit_ga_debug") === "1";
  } catch {
    return false;
  }
}

/** True when analytics should actually send (consent + not a silent test host). */
function enabled(): boolean {
  if (typeof window === "undefined" || !hasConsent()) return false;
  if (isLocalhost() && !debugEnabled()) return false;
  return true;
}

function init(): Promise<Analytics | null> {
  if (!initPromise) {
    initPromise = (async () => {
      if (
        !firebaseConfigured
        || !process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
      ) {
        return null;
      }
      try {
        if (!(await isSupported())) return null;
        return getAnalytics(getFirebaseApp());
      } catch {
        return null;
      }
    })();
  }
  return initPromise;
}

/** Log a product event. Safe to call from anywhere client-side. */
export function track(
  event: string,
  params?: Record<string, string | number | boolean>,
): void {
  if (!enabled()) return;
  const debug = debugEnabled();
  void init().then((a) => {
    if (!a) return;
    try {
      logEvent(a, event, debug ? { ...params, debug_mode: true } : params);
    } catch {
      /* never let analytics surface an error */
    }
  });
}

/**
 * Set the "user_type" GA4 user property (worker | customer) after login, so the
 * funnel can be segmented by audience. Consent- and host-gated like track().
 */
export function setUserType(type: "worker" | "customer"): void {
  if (!enabled()) return;
  void init().then((a) => {
    if (!a) return;
    try {
      setUserProperties(a, { user_type: type });
    } catch {
      /* never let analytics surface an error */
    }
  });
}
