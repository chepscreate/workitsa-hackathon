import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const BASE =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://workitsa.co.za";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  // Public, content-rich pages only. Gated routes (find-work, workers, profile,
  // post-a-job, verification, account) redirect to sign-in, so they're thin for
  // crawlers and are intentionally left out. Internal pages (/setup /sentry-test)
  // and private routes are also blocked in robots.txt.
  const pages = [
    { url: "/", priority: 1.0, changeFrequency: "weekly" as const },
    { url: "/how-it-works", priority: 0.9, changeFrequency: "monthly" as const },
    { url: "/categories", priority: 0.8, changeFrequency: "monthly" as const },
    { url: "/safety", priority: 0.6, changeFrequency: "monthly" as const },
    { url: "/help", priority: 0.6, changeFrequency: "monthly" as const },
    { url: "/acceptable-use", priority: 0.3, changeFrequency: "yearly" as const },
    { url: "/terms", priority: 0.3, changeFrequency: "yearly" as const },
    { url: "/privacy", priority: 0.3, changeFrequency: "yearly" as const },
  ];
  return pages.map((p) => ({
    // Trailing slash to match the served URL (next.config trailingSlash:true +
    // Firebase trailingSlash:true). Without it the sitemap points at the
    // pre-redirect URL and Search Console files every entry as
    // "Page with redirect" → not indexed.
    url: `${BASE}${p.url === "/" ? "/" : `${p.url}/`}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
