"use client";

/**
 * Firebase App Check (reCAPTCHA Enterprise).
 *
 * App Check attests that requests to Firestore, Storage, Functions and Auth come
 * from *our* real web app, not a script or a stolen API key. It runs for EVERY
 * user (it's a security control, not telemetry) — so, unlike analytics, it is NOT
 * gated on cookie consent.
 *
 * Rollout is safe-by-default:
 *   - No site key configured  → this no-ops, nothing breaks.
 *   - "Monitor only" in the console (enforcement OFF) → tokens are sent and
 *     measured but never block a request. Turn enforcement ON later.
 *   - On localhost we register a DEBUG TOKEN so local dev isn't blocked once
 *     enforcement is on (the token prints to the browser console on first load —
 *     copy it into Firebase Console → App Check → Apps → Manage debug tokens).
 */
import type { FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

let started = false;

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

/** Initialise App Check once, in the browser. Safe to call repeatedly. */
export function initAppCheck(app: FirebaseApp): void {
  if (started || typeof window === "undefined") return;
  const siteKey = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY;
  if (!siteKey) return; // not configured yet → no-op, app keeps working

  // Debug token so a developer on localhost isn't blocked once enforcement is on.
  // Firebase prints the generated token to the console; register it in the console.
  if (isLocalhost()) {
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string })
      .FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
    started = true;
  } catch {
    /* never block the app on App Check init */
  }
}
