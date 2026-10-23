/**
 * Server-maintained platform stats — the scalable data source for admin
 * analytics (BACKLOG: "Cloud-Function-maintained stats document").
 *
 * Two surfaces, both written ONLY by these triggers (rules deny all client
 * writes; reads are admin-only):
 *
 *   stats/totals          — lifetime counters, one doc, O(1) to read.
 *   statsDaily/{yyyy-mm-dd} — per-day counters in SAST, one doc per day, so
 *                             30-day trends are 30 reads instead of streaming
 *                             every user + job ever created.
 *
 * The admin UI still streams collections directly (correct at launch volume,
 * richer data) — these counters accumulate from day one so the dashboard can
 * switch to them when volume demands it, without losing history.
 *
 * Known simplifications (fine at this scale, revisit at the switch-over):
 *   - employer→business self-upgrades don't move the role split counters.
 *   - account erasure tombstones keep their user doc, so usersTotal only
 *     drops on hard admin deletes (onUserDeletedStats).
 */

import {
  onDocumentCreated,
  onDocumentDeleted,
  onDocumentWritten,
} from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

/** yyyy-mm-dd in South African time — en-CA locale formats as ISO. */
function dayKey(ms: number): string {
  return new Date(ms).toLocaleDateString("en-CA", {
    timeZone: "Africa/Johannesburg",
  });
}

type Counters = Record<string, number>;

/** Apply increments to totals + the day bucket in one batch (merge-create). */
async function bump(at: number, counters: Counters): Promise<void> {
  const db = getFirestore();
  const inc: Record<string, FieldValue> = {};
  for (const [k, v] of Object.entries(counters)) {
    if (v !== 0) inc[k] = FieldValue.increment(v);
  }
  if (Object.keys(inc).length === 0) return;
  const stamp = { updatedAt: FieldValue.serverTimestamp() };
  const batch = db.batch();
  batch.set(db.doc("stats/totals"), { ...inc, ...stamp }, { merge: true });
  batch.set(db.doc(`statsDaily/${dayKey(at)}`), { ...inc, ...stamp }, { merge: true });
  await batch.commit();
}

// ---- USERS ----

export const onUserCreatedStats = onDocumentCreated("users/{uid}", async (event) => {
  const u = event.data?.data() as { role?: string; createdAt?: number } | undefined;
  if (!u || u.role === "admin") return;
  try {
    await bump(u.createdAt ?? Date.now(), {
      signups: 1,
      ...(u.role === "worker" ? { signupsWorkers: 1 } : {}),
      ...(u.role === "employer" ? { signupsEmployers: 1 } : {}),
      ...(u.role === "business" ? { signupsBusinesses: 1 } : {}),
    });
  } catch (err) {
    logger.error("onUserCreatedStats failed", err);
  }
});

export const onUserDeletedStats = onDocumentDeleted("users/{uid}", async (event) => {
  const u = event.data?.data() as { role?: string } | undefined;
  if (!u || u.role === "admin") return;
  try {
    // Lifetime signups stay (history); only the daily doc never changes and
    // totals.signups is a lifetime figure, so deletes are tracked separately.
    await bump(Date.now(), { accountsDeleted: 1 });
  } catch (err) {
    logger.error("onUserDeletedStats failed", err);
  }
});

// ---- JOBS ----

type JobDoc = {
  status?: string;
  agreedPrice?: number;
  suggestedPrice?: number;
  dispute?: unknown;
  createdAt?: number;
};

export const onJobWrittenStats = onDocumentWritten("jobs/{jobId}", async (event) => {
  const before = event.data?.before.exists ? (event.data.before.data() as JobDoc) : null;
  const after = event.data?.after.exists ? (event.data.after.data() as JobDoc) : null;
  const now = Date.now();
  const counters: Counters = {};

  if (!before && after) {
    counters.jobsPosted = 1;
  }
  if (after && before?.status !== "confirmed" && after.status === "confirmed") {
    counters.jobsConfirmed = 1;
    counters.gmv = after.agreedPrice ?? after.suggestedPrice ?? 0;
  }
  if (after && !before?.dispute && after.dispute) {
    counters.disputesRaised = 1;
  }
  if (Object.keys(counters).length === 0) return;
  try {
    await bump(now, counters);
  } catch (err) {
    logger.error("onJobWrittenStats failed", err);
  }
});
