/**
 * One-off backfill: set every employer's `employerJobsHired` to their true
 * lifetime count of confirmed worker engagements.
 *
 * The `onJobConfirmedCountWork` trigger only counts forward from when it shipped
 * (2026-06-19), so existing employers show "0 workers hired" on the worker-facing
 * trust panel until this runs once. Admin-only + idempotent: it recomputes the
 * ABSOLUTE total from all jobs and sets it (so re-running is safe and never
 * double-counts — future confirms increment from the correct base).
 *
 * Counting mirrors the trigger: a confirmed single job = 1; a crew job = the
 * number of its workers whose slot reached "confirmed".
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";

type AnyDoc = Record<string, unknown>;
type CrewMember = { status?: string };

export const backfillEmployerHires = onCall(
  { timeoutSeconds: 300, memory: "512MiB" },
  async (req) => {
    if (!req.auth) throw new HttpsError("unauthenticated", "Sign in.");
    const db = getFirestore();
    const me = await db.collection("users").doc(req.auth.uid).get();
    if (!me.exists || (me.data() as AnyDoc).role !== "admin") {
      throw new HttpsError("permission-denied", "Admins only.");
    }

    const jobsSnap = await db.collection("jobs").get();
    const sums = new Map<string, number>();
    for (const d of jobsSnap.docs) {
      const j = d.data() as AnyDoc;
      const employerId = j.employerId as string | undefined;
      if (!employerId) continue;
      const crew = Array.isArray(j.assignedWorkers) ? (j.assignedWorkers as CrewMember[]) : [];
      let hires = 0;
      if (crew.length > 0) {
        hires = crew.filter((w) => w?.status === "confirmed").length;
      } else if (j.status === "confirmed") {
        hires = 1;
      }
      if (hires > 0) sums.set(employerId, (sums.get(employerId) ?? 0) + hires);
    }

    // Write the absolute count to existing user docs only (no orphan stubs).
    let updated = 0;
    for (const [uid, count] of sums) {
      const userRef = db.doc(`users/${uid}`);
      const userSnap = await userRef.get();
      if (!userSnap.exists) continue;
      await userRef.set({ employerJobsHired: count }, { merge: true });
      updated += 1;
    }

    logger.info("backfillEmployerHires complete", {
      jobs: jobsSnap.size,
      employersUpdated: updated,
    });
    return { ok: true, jobs: jobsSnap.size, employersUpdated: updated };
  },
);
