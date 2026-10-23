/**
 * "New job near you" — pushes matching workers when a job becomes publicly
 * visible. This is the demand→supply loop: without it a worker only finds
 * work by remembering to open the app.
 *
 * Trigger design: a job is "visible" when it exists, status === "open" and it
 * carries no moderationStatus. Two paths get a job there:
 *
 *   1. Fresh create that the screens never flag. But the text screen and the
 *      first-post / rate-limit holds run asynchronously seconds after create,
 *      so on create we WAIT (ALERT_SETTLE_MS), re-read the doc, and only send
 *      if it's still visible.
 *   2. An admin releasing a held job (moderationStatus cleared on update) —
 *      fires immediately on the invisible→visible transition. This is the
 *      normal path for first posts from new accounts, which are always held.
 *
 * The push uses tag `newjob-{jobId}`, so the two paths can never double-notify
 * a device — the second send replaces the first notification.
 *
 * Targeting (in-memory over the workers list — fine at launch volume; move to
 * indexed queries / the planned stats doc when worker count grows):
 *   - role worker, account approved, not the employer, no block either way
 *   - category matches the worker's chosen categories (no categories = open
 *     to anything)
 *   - within RADIUS_KM when both sides have coordinates; otherwise same city;
 *     otherwise same province as a last resort
 *   - nearest first, capped at MAX_RECIPIENTS
 */

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { dispatchPush } from "./notify";

const ALERT_SETTLE_MS = 45_000;
const RADIUS_KM = 25;
const MAX_RECIPIENTS = 50;

type JobDoc = {
  title?: string;
  status?: string;
  moderationStatus?: string;
  employerId?: string;
  employerName?: string;
  category?: string;
  suggestedPrice?: number;
  suburb?: string;
  city?: string;
  province?: string;
  lat?: number;
  lng?: number;
  urgent?: boolean;
  /** Workers the employer explicitly invited (profile invite, "Book again",
   *  or a recurring mint). They're always notified — see below. */
  invitedWorkerIds?: string[];
  /** Present when this job is a clone of an earlier one — switches the invited
   *  worker's copy from "invited" to "invited back". */
  rebookedFrom?: string;
};

type WorkerDoc = {
  uid: string;
  role?: string;
  accountStatus?: string;
  categories?: string[];
  approxLat?: number;
  approxLng?: number;
  city?: string;
  province?: string;
  blockedUserIds?: string[];
};

const isVisible = (j: JobDoc | undefined | null): boolean =>
  !!j && j.status === "open" && !j.moderationStatus;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const norm = (s?: string) => (s ?? "").trim().toLowerCase();

export const onJobVisibleAlertWorkers = onDocumentWritten(
  { document: "jobs/{jobId}", timeoutSeconds: 120 },
  async (event) => {
    const jobId = event.params.jobId;
    const before = event.data?.before.exists ? (event.data.before.data() as JobDoc) : null;
    let after = event.data?.after.exists ? (event.data.after.data() as JobDoc) : null;

    if (!isVisible(after) || isVisible(before)) return;

    // Fresh create: give the text screen + first-post/rate-limit holds time to
    // land, then re-read. If a hold arrived, the release path (admin clearing
    // moderationStatus) triggers this function again later.
    if (!before) {
      await sleep(ALERT_SETTLE_MS);
      const snap = await getFirestore().doc(`jobs/${jobId}`).get();
      after = snap.exists ? (snap.data() as JobDoc) : null;
      if (!isVisible(after)) {
        logger.info("jobAlerts: job no longer visible after settle, skipping", { jobId });
        return;
      }
    }

    const job = after!;
    if (!job.employerId) return;

    const db = getFirestore();
    const [workersSnap, employerSnap] = await Promise.all([
      db.collection("users").where("role", "==", "worker").get(),
      db.doc(`users/${job.employerId}`).get(),
    ]);
    const employerBlocked: string[] = (employerSnap.data()?.blockedUserIds as string[]) ?? [];

    const jobCity = norm(job.city);
    const jobProvince = norm(job.province);
    const hasCoords = typeof job.lat === "number" && typeof job.lng === "number";

    const invitedIds = new Set((job.invitedWorkerIds ?? []).filter(Boolean));
    const invited: string[] = [];
    const candidates: Array<{ uid: string; distanceKm: number | null }> = [];
    workersSnap.forEach((d) => {
      const w = { ...(d.data() as WorkerDoc), uid: d.id };
      if ((w.accountStatus ?? "approved") !== "approved") return;
      if (w.uid === job.employerId) return;
      if (employerBlocked.includes(w.uid)) return;
      if ((w.blockedUserIds ?? []).includes(job.employerId!)) return;

      // Invited workers are notified regardless of category or distance — the
      // employer asked for them by name (a rebooking or a profile invite). They
      // get the dedicated "invited (back)" copy and are kept out of the generic
      // nearby pool so they're never double-notified for the same job.
      if (invitedIds.has(w.uid)) {
        invited.push(w.uid);
        return;
      }

      // Category preference: an empty list means "open to anything".
      if (w.categories && w.categories.length > 0 && job.category && !w.categories.includes(job.category)) return;

      const workerHasCoords = typeof w.approxLat === "number" && typeof w.approxLng === "number";
      if (hasCoords && workerHasCoords) {
        const km = haversineKm(job.lat!, job.lng!, w.approxLat!, w.approxLng!);
        if (km <= RADIUS_KM) candidates.push({ uid: w.uid, distanceKm: km });
        return;
      }
      if (jobCity && norm(w.city) === jobCity) {
        candidates.push({ uid: w.uid, distanceKm: null });
        return;
      }
      // Last resort for workers with no pin and no city on file.
      if (!workerHasCoords && !norm(w.city) && jobProvince && norm(w.province) === jobProvince) {
        candidates.push({ uid: w.uid, distanceKm: null });
      }
    });

    // Nearest first; city/province matches (no distance) after measured ones.
    candidates.sort((a, b) => (a.distanceKm ?? RADIUS_KM + 1) - (b.distanceKm ?? RADIUS_KM + 1));
    const nearby = candidates.slice(0, MAX_RECIPIENTS);

    if (invited.length === 0 && nearby.length === 0) {
      logger.info("jobAlerts: no matching workers", { jobId });
      return;
    }

    const where = [job.suburb, job.city].filter(Boolean).join(", ");
    const priceStr = `R ${job.suggestedPrice ?? "—"}`;
    const tag = `newjob-${jobId}`;
    const href = `/jobs?id=${jobId}`;

    // Generic "new job near you" copy for the radius pool.
    const nearbyTitle = `${job.urgent ? "🔥 " : ""}New job near you`;
    const nearbyBody = `${(job.title ?? "A job").slice(0, 60)} — ${priceStr}${where ? ` · ${where}` : ""}`;

    // Dedicated copy for the worker(s) the employer invited by name. A clone of
    // an earlier job (rebookedFrom) reads as "invited back"; a first-time
    // profile invite reads as "invited".
    const employerName = job.employerName?.trim() || "An employer";
    const invitedTitle = job.rebookedFrom ? "You've been invited back 🎉" : "You're invited to a job";
    const invitedBody = `${employerName} wants you for ${(job.title ?? "a job").slice(0, 50)} — ${priceStr}${where ? ` · ${where}` : ""}`;

    const results = await Promise.allSettled([
      ...invited.map((uid) =>
        dispatchPush({ toUid: uid, title: invitedTitle, body: invitedBody, href, tag }),
      ),
      ...nearby.map((r) =>
        dispatchPush({ toUid: r.uid, title: nearbyTitle, body: nearbyBody, href, tag }),
      ),
    ]);
    const failed = results.filter((r) => r.status === "rejected").length;
    logger.info("jobAlerts: dispatched", {
      jobId,
      invited: invited.length,
      nearby: nearby.length,
      failed,
    });
  },
);
