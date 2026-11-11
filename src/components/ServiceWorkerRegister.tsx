"use client";

import { useEffect } from "react";

/**
 * Register /sw.js once on first client mount. Production-only — in dev
 * the service worker would aggressively cache HMR responses and break
 * the dev loop.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (window.location.hostname === "localhost") return;

    navigator.serviceWorker
      .register("/sw.js")
      .catch(() => {
        /* swallow — site still works without offline support */
      });
  }, []);

  return null;
}
