"use client";

import * as Sentry from "@sentry/browser";

/**
 * Initialise Sentry once on the client. No-op if no DSN is configured —
 * so dev/local builds without the env var stay silent.
 *
 * To enable: add NEXT_PUBLIC_SENTRY_DSN=https://… to .env.local
 * Get the DSN from sentry.io → your project → Settings → Client Keys (DSN).
 */
let initialised = false;

export function initSentry(): void {
  if (initialised) return;
  if (typeof window === "undefined") return;

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  // Don't report from local dev. Next's Fast Refresh / HMR throws transient
  // runtime errors (e.g. "async Client Component" while a route recompiles) that
  // aren't real production bugs — and they were paging the founder by email.
  // Sentry stays active only on the deployed site; verify it via /sentry-test on
  // the live URL, not localhost.
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "") return;

  Sentry.init({
    dsn,
    environment: "production",
    // Noise from the Facebook in-app browser (Android): FB injects its own
    // navigation_performance_logger script into the WebView, and its Java
    // bridge throws when the view is torn down mid-call. Not our code, not
    // actionable — and every visitor arriving from a Facebook post triggers
    // it, paging the founder for nothing.
    ignoreErrors: [
      "Java object is gone",
      "Java exception was raised during method invocation",
    ],
    denyUrls: [/navigation_performance_logger/i],
    // Performance tracing — keep light to stay within free tier
    tracesSampleRate: 0.1,
    // Replay only on errors; cheap
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    // Strip personally identifying info from the URL by default
    sendDefaultPii: false,
    // Fetch/XHR breadcrumbs carry full URLs — Firebase Storage download URLs
    // include their access token in the query string (enough to open a private
    // verification doc), so drop query strings from breadcrumb URLs entirely.
    beforeBreadcrumb(crumb) {
      const url = crumb.data?.url;
      if (typeof url === "string" && url.includes("?")) {
        crumb.data = { ...crumb.data, url: url.split("?")[0] };
      }
      return crumb;
    },
    beforeSend(event) {
      // Don't ship events with explicit password / token / secret query params.
      if (event.request?.url) {
        try {
          const u = new URL(event.request.url);
          for (const k of ["password", "token", "secret", "key"]) {
            u.searchParams.delete(k);
          }
          event.request.url = u.toString();
        } catch {
          /* ignore */
        }
      }
      // Scrub email addresses from error text (Firebase auth errors echo them).
      const scrub = (s: string) =>
        s.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]");
      if (event.message) event.message = scrub(event.message);
      for (const ex of event.exception?.values ?? []) {
        if (ex.value) ex.value = scrub(ex.value);
      }
      return event;
    },
  });

  initialised = true;

  // Expose the SDK on window so you can verify from DevTools console:
  //   window.Sentry.captureMessage("hello from console")
  // Safe to expose — DSN is already public (it's a NEXT_PUBLIC_ var).
  try {
    (window as unknown as { Sentry?: typeof Sentry }).Sentry = Sentry;
  } catch {
    /* ignore */
  }
}

/** Attach the signed-in user to all subsequent events (no PII beyond uid). */
export function setSentryUser(uid: string | null): void {
  if (!initialised) return;
  if (uid) Sentry.setUser({ id: uid });
  else Sentry.setUser(null);
}
