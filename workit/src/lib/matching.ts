import type { Offer, Job } from "./types";

/**
 * Relevance score for an offer, from the employer's point of view. Higher =
 * stronger candidate. Pure function of the denormalised fields already on the
 * offer (rating, jobs done, verification, badges, price) plus the job's
 * suggested price — so ranking costs zero extra Firestore reads.
 *
 * Weighting (rough max ~90):
 *   verified worker          +25   (a real, ID-checked person)
 *   background-verified      +20   (police clearance — top safety tier)
 *   rating                   +20   (avg, scaled by how many reviews back it)
 *   track record             +15   (completed jobs, capped)
 *   price                    +10 / −up to 15  (at/under your price is a plus;
 *                                              big counter-offers cost points)
 */
export function scoreOffer(o: Offer, job: Pick<Job, "suggestedPrice">): number {
  let s = 0;
  if (o.workerVerified) s += 25;
  if (o.backgroundVerified) s += 20;

  const avg = o.workerRatingAvg ?? 0;
  const count = o.workerRatingCount ?? 0;
  if (count > 0) {
    // Trust the average more when more reviews back it (confidence 0–1).
    const confidence = Math.min(count, 10) / 10;
    s += (avg / 5) * 20 * confidence;
  }

  const done = o.workerJobsCompleted ?? 0;
  s += (Math.min(done, 50) / 50) * 15;

  const suggested = job.suggestedPrice || o.price;
  if (suggested > 0) {
    if (o.price <= suggested) s += 10;
    else s -= Math.min(15, (o.price / suggested - 1) * 30);
  }
  return s;
}

/**
 * Relevance of a job to a *worker*, for the "Best for you" feed sort. Surfaces
 * jobs that fit the worker's own skills first, then nearer + fresher ones.
 * Pure, cheap — no extra reads (uses the worker's profile categories + the
 * distance the feed already computes).
 *
 *   category in your skills   +100   (dominant signal)
 *   distance                  +0–50  (closer is better; 0 at ≥50 km / unknown)
 *   recency                   +0–20  (newer over a rolling 7-day window)
 */
export function scoreJobForWorker(
  job: Pick<Job, "category" | "createdAt">,
  opts: { categories?: string[]; km?: number },
): number {
  let s = 0;
  if (opts.categories && opts.categories.includes(job.category)) s += 100;
  if (typeof opts.km === "number") s += Math.max(0, 50 - opts.km);
  const ageHours = (Date.now() - (job.createdAt ?? 0)) / 3_600_000;
  s += 20 * Math.max(0, 1 - ageHours / 168);
  return s;
}

/**
 * Return a new array of offers sorted best-match first. Stable for equal
 * scores (preserves the caller's order, which is newest-first), so a tie never
 * reshuffles on every snapshot.
 */
export function rankOffers<T extends Offer>(
  offers: T[],
  job: Pick<Job, "suggestedPrice">,
): T[] {
  return offers
    .map((o, i) => ({ o, i, s: scoreOffer(o, job) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.o);
}
