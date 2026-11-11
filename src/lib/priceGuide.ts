import type { CategoryId } from "./types";

/**
 * Fair-price guidance shown when posting a job.
 *
 * Typical price bands (ZAR) for everyday gig work in Gauteng — a *nudge*, not a
 * rule. Deliberately broad (category-level), since within a category the spread
 * is wide. These are launch defaults; the plan is to refine them from real
 * agreed-price data per category/area once there's enough volume (the band
 * shape stays the same, so the UI never changes).
 *
 * Why this exists: "what do I even pay?" is the #1 posting friction, and
 * under-priced posts sit unfilled. A visible typical range gets more posts
 * priced where workers actually accept — which is what fills the marketplace.
 */
const BANDS: Record<CategoryId, { low: number; typical: number; high: number }> = {
  "home-garden": { low: 200, typical: 350, high: 700 },
  trades: { low: 350, typical: 700, high: 2500 },
  "moving-errands": { low: 200, typical: 450, high: 1200 },
  personal: { low: 150, typical: 300, high: 600 },
  "beauty-wellness": { low: 150, typical: 350, high: 900 },
  "events-catering": { low: 300, typical: 700, high: 2000 },
  "driving-delivery": { low: 150, typical: 400, high: 1200 },
  "tutoring-education": { low: 150, typical: 300, high: 600 },
  care: { low: 200, typical: 400, high: 900 },
  "construction-labour": { low: 250, typical: 500, high: 1500 },
  "tech-digital": { low: 200, typical: 500, high: 1500 },
};

const FALLBACK = { low: 150, typical: 350, high: 1000 };

export type PriceBand = { low: number; typical: number; high: number };
export type PriceVerdict = "low" | "fair" | "high";

export function priceBand(category: CategoryId): PriceBand {
  return BANDS[category] ?? FALLBACK;
}

/**
 * Compare an entered price to the category band.
 * `verdict` is null until a valid positive price is entered. We allow a 15%
 * grace below `low` before nudging, so we don't nag on reasonable values.
 */
export function assessPrice(
  category: CategoryId,
  price: number,
): { band: PriceBand; verdict: PriceVerdict | null } {
  const band = priceBand(category);
  if (!Number.isFinite(price) || price <= 0) return { band, verdict: null };
  if (price < band.low * 0.85) return { band, verdict: "low" };
  if (price > band.high) return { band, verdict: "high" };
  return { band, verdict: "fair" };
}

/** "R 1 200" — non-breaking space + en-ZA thousands grouping. */
export function formatRand(n: number): string {
  return "R " + Math.round(n).toLocaleString("en-ZA");
}
