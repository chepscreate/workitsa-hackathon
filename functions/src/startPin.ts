/**
 * Job start PIN — a doorstep handshake (repurposed from Uber's rider PIN).
 *
 * When a job has `requireStartPin`, the worker must enter a 4-digit code the
 * employer reads out at the door before the job can start. This:
 *   - confirms the right (verified) worker is physically at the right place,
 *   - confirms the employer is present (they have to share the code),
 *   - stamps a trustworthy arrival time (`startVerifiedAt`).
 *
 * SECURITY: job docs are world-readable (`allow read: if true`), so the code
 * CANNOT live on the job doc — a 4-digit code is trivially brute-forced even if
 * hashed. It lives in `jobs/{jobId}/secure/start`, which is fully locked to all
 * clients (firestore.rules). The employer fetches the plaintext code via
 * `getJobStartPin` (Admin SDK, employer-only); the worker's entry is checked by
 * `verifyJobStartPin` (Admin SDK), which flips the job to in_progress. Wrong
 * guesses are rate-limited (locked after MAX_ATTEMPTS until the employer
 * re-opens the job, which clears the lock).
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const MAX_ATTEMPTS = 5;

type CrewMember = { uid: string; status?: string; [k: string]: unknown };

type JobShape = {
  employerId?: string;
  assignedWorkerId?: string;
  assignedWorkers?: CrewMember[];
  status?: string;
};

const liveUids = (roster: CrewMember[]): string[] =>
  roster.filter((w) => w.status !== "removed").map((w) => w.uid);

/**
 * Employer fetches (lazily generating) the job's 4-digit start code. Re-opening
 * the job also clears any wrong-attempt lock so a worker who fat-fingered the
 * code isn't stuck.
 */
export const getJobStartPin = onCall({ timeoutSeconds: 30 }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in.");
  const caller = req.auth.uid;
  const jobId = String(req.data?.jobId ?? "");
  if (!jobId) throw new HttpsError("invalid-argument", "Missing jobId.");

  const db = getFirestore();
  const jobRef = db.doc(`jobs/${jobId}`);
  const jobSnap = await jobRef.get();
  if (!jobSnap.exists) throw new HttpsError("not-found", "Job not found.");
  const job = jobSnap.data() as JobShape;
  if (job.employerId !== caller) {
    throw new HttpsError("permission-denied", "Only the employer can see the start code.");
  }
  if (job.status !== "assigned" && job.status !== "in_progress") {
    throw new HttpsError("failed-precondition", "Assign a worker first.");
  }

  const secRef = db.doc(`jobs/${jobId}/secure/start`);
  const pin = await db.runTransaction(async (tx) => {
    const s = await tx.get(secRef);
    const existing = s.exists ? (s.data() as { pin?: string; attempts?: number }) : null;
    if (existing?.pin) {
      if ((existing.attempts ?? 0) !== 0) tx.update(secRef, { attempts: 0 });
      return String(existing.pin);
    }
    const newPin = String(Math.floor(1000 + Math.random() * 9000));
    tx.set(secRef, { pin: newPin, createdAt: Date.now(), attempts: 0 });
    return newPin;
  });

  return { pin };
});

/**
 * Worker enters the code to start the job. On a correct code the job (or the
 * caller's crew slot) flips to in_progress and records `startVerifiedAt`.
 */
export const verifyJobStartPin = onCall({ timeoutSeconds: 30 }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in.");
  const caller = req.auth.uid;
  const jobId = String(req.data?.jobId ?? "");
  const entered = String(req.data?.pin ?? "").replace(/\D/g, "").slice(0, 4);
  if (!jobId) throw new HttpsError("invalid-argument", "Missing jobId.");

  const db = getFirestore();
  const jobRef = db.doc(`jobs/${jobId}`);
  const jobSnap = await jobRef.get();
  if (!jobSnap.exists) throw new HttpsError("not-found", "Job not found.");
  const job = jobSnap.data() as JobShape;

  const roster = Array.isArray(job.assignedWorkers) ? job.assignedWorkers : [];
  const isCrew = roster.length > 0;
  const crewIdx = roster.findIndex((w) => w.uid === caller && w.status !== "removed");
  const isCrewMember = isCrew && crewIdx >= 0;
  const isSingleWorker = !isCrew && job.assignedWorkerId === caller;
  if (!isCrewMember && !isSingleWorker) {
    throw new HttpsError("permission-denied", "You're not the assigned worker on this job.");
  }

  // Status guard (allow re-verify if already started — idempotent).
  const slotStatus = isCrewMember ? roster[crewIdx].status : job.status;
  if (slotStatus !== "assigned" && slotStatus !== "in_progress") {
    throw new HttpsError("failed-precondition", "This job can't be started right now.");
  }

  const secRef = db.doc(`jobs/${jobId}/secure/start`);
  const secSnap = await secRef.get();
  if (!secSnap.exists) {
    throw new HttpsError(
      "failed-precondition",
      "The employer hasn't shared a start code yet — ask them to open the job.",
    );
  }
  const sec = secSnap.data() as { pin?: string; attempts?: number };
  const attempts = Number(sec.attempts ?? 0);
  if (attempts >= MAX_ATTEMPTS) {
    throw new HttpsError(
      "resource-exhausted",
      "Too many wrong codes. Ask the employer to re-open the job to refresh the code.",
    );
  }

  if (String(sec.pin ?? "") !== entered || entered.length !== 4) {
    // Persist the failed attempt OUTSIDE any transaction (a throw would roll a
    // transactional write back, and the rate limit must survive the throw).
    await secRef.update({ attempts: FieldValue.increment(1), lastAttemptAt: Date.now() });
    const remaining = Math.max(0, MAX_ATTEMPTS - (attempts + 1));
    throw new HttpsError(
      "invalid-argument",
      remaining > 0
        ? `That code isn't right. ${remaining} ${remaining === 1 ? "try" : "tries"} left.`
        : "That code isn't right. Ask the employer to re-open the job to refresh the code.",
    );
  }

  // Correct code → start the job / slot + stamp verified arrival.
  const now = Date.now();
  if (isCrewMember) {
    const next = roster.map((w, i) =>
      i === crewIdx ? { ...w, status: "in_progress", startVerifiedAt: now } : w,
    );
    await jobRef.update({
      assignedWorkers: next,
      assignedWorkerIds: liveUids(next),
      status: "in_progress",
      updatedAt: now,
    });
  } else {
    await jobRef.update({ status: "in_progress", startVerifiedAt: now, updatedAt: now });
  }
  await secRef.update({ attempts: 0, verifiedAt: now });

  return { ok: true };
});
