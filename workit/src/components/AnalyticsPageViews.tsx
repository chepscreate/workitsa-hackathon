"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics";

/**
 * Logs a GA4 page_view on every SPA route change. Firebase Analytics only
 * captures the initial page load by itself; without this, navigation inside
 * the PWA is invisible and funnels can't be measured.
 *
 * Deliberately pathname-only (no query string) — job/user ids in URLs stay
 * out of analytics.
 */
export default function AnalyticsPageViews() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname) return;
    // Don't send admin navigation to product analytics — it's internal ops,
    // not user behaviour, and would skew the funnel.
    if (pathname.startsWith("/admin")) return;
    track("page_view", { page_path: pathname });
  }, [pathname]);
  return null;
}
