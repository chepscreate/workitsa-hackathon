/**
 * Ratings — server-authored.
 *
 * SECURITY (2026-06-17): ratings used to be a client write to the job doc that a
 * background trigger (`onJobRatingWritten`) then aggregated. Background triggers
 * carry no auth context, so the trigger trusted WHOEVER wrote `employerRating` /
 * `workerRating`. Because the rules let the assigned worker write any field on
 * their own job, a worker could write their own 5-star `employerRating` and the
 * trigger would credit it to them. That broke the core trust signal.
 *
 * Now a single `submitRating` callable is the ONLY writer of ratings + the only
 * thing that moves `ratingAvg` / `ratingCount`. It verifies the caller's role
 * from their auth token (employer ⇄ worker), checks the work is confirmed, and
 * writes the rating + the aggregate atomically in one transaction. The trigger
 * is gone, so even a stray client-side rating field on a job doc can never
 * affect anyone's real reputation.
 *
 * `onJobConfirmedCountWork` keeps the (previously dormant) per-worker
 * `jobsCompleted` tally truthful + tamper-proof — it's the input to worker
 * levels + experience badges, and the rules now forbid clients from writing it.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import {
  getFirestore,
  FieldValue,
  type DocumentReference,
  type DocumentSnapshot,
  type Transaction,
} from "firebase-admin/firestore";

type Rating = { stars: number; text?: string; at: number };

type CrewMember = {
  uid: string;
  status?: string;
  employerRating?: Rating;
  workerRating?: Rating;
  [k: string]: unknown;
};

type JobShape = {
  employerId?: string;
  assignedWorkerId?: string;
  assignedWorkerIds?: string[];
  status?: string;
  employerRating?: Rating;
  workerRating?: Rating;
  assignedWorkers?: CrewMember[];
};

/** Re-average a user's rating inside the same transaction (merge-create safe). */
function applyAggregate(
  tx: Transaction,
  ref: DocumentReference,
  snap: DocumentSnapshot,
  stars: number,
): void {
  const prev = (snap.exists ? snap.data() : {}) ?? {};
  const count = ((prev.ratingCount as number) ?? 0) + 1;
  const avg = (((prev.ratingAvg as number) ?? 0) * (count - 1) + stars) / count;
  tx.set(
    ref,
    {
      ratingAvg: Math.round(avg * 100) / 100,
      ratingCount: count,
      ratingUpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Submit a rating for a finished job. The caller's identity decides direction:
 *   - employer  → rates the worker  (single: assignedWorkerId; crew: workerUid)
 *   - the worker → rates the employer
 * One rating per side per job/slot; the work must be confirmed first.
 */
export const submitRating = onCall({ timeoutSeconds: 30 }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in.");
  const caller = req.auth.uid;
  const jobId = String(req.data?.jobId ?? "");
  const stars = Number(req.data?.stars);
  const textRaw = req.data?.text;
  const text = typeof textRaw === "string" ? textRaw.trim().slice(0, 1000) : "";
  const targetWorkerUid = req.data?.workerUid ? String(req.data.workerUid) : undefined;

  if (!jobId) throw new HttpsError("invalid-argument", "Missing jobId.");
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    throw new HttpsError("invalid-argument", "Stars must be a whole number 1–5.");
  }

  const db = getFirestore();
  const jobRef = db.doc(`jobs/${jobId}`);
  const rating: Rating = { stars, at: Date.now(), ...(text ? { text } : {}) };

  await db.runTransaction(async (tx) => {
    const jobSnap = await tx.get(jobRef);
    if (!jobSnap.exists) throw new HttpsError("not-found", "Job not found.");
    const job = jobSnap.data() as JobShape;
    const roster = Array.isArray(job.assignedWorkers) ? job.assignedWorkers : [];
    const isCrew = roster.length > 0;

    // ---- Employer rates a worker ----
    if (job.employerId === caller) {
      if (isCrew) {
        if (!targetWorkerUid) throw new HttpsError("invalid-argument", "workerUid required for crew jobs.");
        const idx = roster.findIndex((w) => w.uid === targetWorkerUid);
        if (idx < 0) throw new HttpsError("not-found", "That worker isn't on this job.");
        if (roster[idx].status !== "confirmed") throw new HttpsError("failed-precondition", "Confirm the work first.");
        if (roster[idx].employerRating) throw new HttpsError("already-exists", "You already rated this worker.");
        const userRef = db.doc(`users/${targetWorkerUid}`);
        const userSnap = await tx.get(userRef);
        tx.update(jobRef, {
          assignedWorkers: roster.map((w, i) => (i === idx ? { ...w, employerRating: rating } : w)),
          updatedAt: Date.now(),
        });
        applyAggregate(tx, userRef, userSnap, stars);
      } else {
        if (!job.assignedWorkerId) throw new HttpsError("failed-precondition", "No worker is assigned.");
        if (job.status !== "confirmed") throw new HttpsError("failed-precondition", "Confirm the work first.");
        if (job.employerRating) throw new HttpsError("already-exists", "You already rated this worker.");
        const userRef = db.doc(`users/${job.assignedWorkerId}`);
        const userSnap = await tx.get(userRef);
        tx.update(jobRef, { employerRating: rating, updatedAt: Date.now() });
        applyAggregate(tx, userRef, userSnap, stars);
      }
      return;
    }

    // ---- Worker rates the employer ----
    if (!job.employerId) throw new HttpsError("failed-precondition", "Job has no employer.");
    const crewIdx = roster.findIndex((w) => w.uid === caller && w.status !== "removed");
    const isCrewMember = isCrew && crewIdx >= 0;
    const isSingleWorker = !isCrew && job.assignedWorkerId === caller;
    if (!isCrewMember && !isSingleWorker) {
      throw new HttpsError("permission-denied", "You weren't part of this job.");
    }
    const empRef = db.doc(`users/${job.employerId}`);

    if (isCrewMember) {
      if (roster[crewIdx].status !== "confirmed") throw new HttpsError("failed-precondition", "Not confirmed yet.");
      if (roster[crewIdx].workerRating) throw new HttpsError("already-exists", "You already rated this employer.");
      const empSnap = await tx.get(empRef);
      tx.update(jobRef, {
        assignedWorkers: roster.map((w, i) => (i === crewIdx ? { ...w, workerRating: rating } : w)),
        updatedAt: Date.now(),
      });
      applyAggregate(tx, empRef, empSnap, stars);
    } else {
      if (job.status !== "confirmed") throw new HttpsError("failed-precondition", "Not confirmed yet.");
      if (job.workerRating) throw new HttpsError("already-exists", "You already rated this employer.");
      const empSnap = await tx.get(empRef);
      tx.update(jobRef, { workerRating: rating, updatedAt: Date.now() });
      applyAggregate(tx, empRef, empSnap, stars);
    }
  });

  return { ok: true };
});

/**
 * Keep each worker's lifetime `jobsCompleted` tally current as their slot is
 * confirmed (single job → status 'confirmed'; crew → that worker's slot flips
 * to 'confirmed'). This is the input to worker levels + the experience badges;
 * it was never being written, so those were stuck at zero. Server-only now —
 * the rules forbid clients from touching it.
 *
 * Consistent with the other stats triggers, this is best-effort at-least-once
 * (no dedupe marker) — fine at launch volume.
 */
export const onJobConfirmedCountWork = onDocumentWritten("jobs/{jobId}", async (event) => {
  const before = event.data?.before.exists ? (event.data.before.data() as JobShape) : null;
  const after = event.data?.after.exists ? (event.data.after.data() as JobShape) : null;
  if (!after) return;

  const incs: Record<string, number> = {};
  const afterCrew = Array.isArray(after.assignedWorkers) && after.assignedWorkers.length > 0;

  if (!afterCrew) {
    if (before?.status !== "confirmed" && after.status === "confirmed" && after.assignedWorkerId) {
      incs[after.assignedWorkerId] = 1;
    }
  } else {
    const beforeMap = new Map<string, CrewMember>();
    (before?.assignedWorkers ?? []).forEach((w) => beforeMap.set(w.uid, w));
    for (const w of after.assignedWorkers ?? []) {
      if (beforeMap.get(w.uid)?.status !== "confirmed" && w.status === "confirmed") {
        incs[w.uid] = (incs[w.uid] ?? 0) + 1;
      }
    }
  }

  const entries = Object.entries(incs);
  if (entries.length === 0) return;
  // Each newly-confirmed worker slot is also one successful "hire" for the
  // employer — their public track record (shown to workers deciding whether to
  // take a job at a stranger's place).
  const employerInc = entries.reduce((sum, [, n]) => sum + n, 0);
  try {
    const db = getFirestore();
    const batch = db.batch();
    for (const [uid, n] of entries) {
      batch.set(db.doc(`users/${uid}`), { jobsCompleted: FieldValue.increment(n) }, { merge: true });
    }
    if (employerInc > 0 && after.employerId) {
      batch.set(
        db.doc(`users/${after.employerId}`),
        { employerJobsHired: FieldValue.increment(employerInc) },
        { merge: true },
      );
    }
    await batch.commit();
  } catch (err) {
    logger.error("onJobConfirmedCountWork failed", err);
  }
});
