/**
 * Payment handshake — server-authored.
 *
 * Money never moves through Workit (cash/EFT is handed over in person), so the
 * platform can't tell whether a confirmed job was actually PAID. This closes
 * that gap with a two-tap handshake once the work is confirmed: the employer
 * taps "I've paid", the worker taps "Payment received" — in either order. When
 * both have tapped, the job (or crew slot) carries `paymentConfirmedAt` and
 * each side's lifetime tally moves: `paymentsConfirmedCount` on the worker and
 * `employerPaymentsConfirmed` on the employer. Those tallies are trust signals
 * (payment reliability shown to workers; payment history feeding the worker's
 * shareable Work Record), so — exactly like ratings (ratings.ts) — they must
 * be tamper-proof: this callable is their ONLY writer. It verifies the caller
 * from their auth token, requires the work to be confirmed first, and writes
 * the stamp + tallies atomically in one transaction. firestore.rules blacklist
 * the payment fields on job docs and the tallies on user docs for clients.
 *
 * Residual (accepted, same as ratings): on a crew job the roster array itself
 * is client-writable for lifecycle updates, so a participant could forge a
 * cosmetic paidAt/receivedAt inside their own entry — but the tallies (the
 * real signal) only ever move through this callable.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

type CrewMember = {
  uid: string;
  status?: string;
  paidAt?: number;
  receivedAt?: number;
  paymentConfirmedAt?: number;
  [k: string]: unknown;
};

type JobShape = {
  employerId?: string;
  assignedWorkerId?: string;
  status?: string;
  paymentPaidAt?: number;
  paymentReceivedAt?: number;
  paymentConfirmedAt?: number;
  assignedWorkers?: CrewMember[];
};

/**
 * Record the caller's half of the payment handshake on a confirmed job.
 *   - employer  → "I've paid"      (crew jobs: workerUid names the slot)
 *   - the worker → "I received it"
 * One tap per side per job/slot; the second tap completes the handshake and
 * bumps both parties' payment tallies.
 */
export const confirmPayment = onCall({ timeoutSeconds: 30 }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in.");
  const caller = req.auth.uid;
  const jobId = String(req.data?.jobId ?? "");
  const targetWorkerUid = req.data?.workerUid ? String(req.data.workerUid) : undefined;
  if (!jobId) throw new HttpsError("invalid-argument", "Missing jobId.");

  const db = getFirestore();
  const jobRef = db.doc(`jobs/${jobId}`);
  const now = Date.now();

  await db.runTransaction(async (tx) => {
    const jobSnap = await tx.get(jobRef);
    if (!jobSnap.exists) throw new HttpsError("not-found", "Job not found.");
    const job = jobSnap.data() as JobShape;
    const roster = Array.isArray(job.assignedWorkers) ? job.assignedWorkers : [];
    const isCrew = roster.length > 0;

    // Both tallies move together, only when the handshake completes.
    const completeHandshake = (workerUid: string) => {
      tx.set(
        db.doc(`users/${workerUid}`),
        { paymentsConfirmedCount: FieldValue.increment(1) },
        { merge: true },
      );
      if (job.employerId) {
        tx.set(
          db.doc(`users/${job.employerId}`),
          { employerPaymentsConfirmed: FieldValue.increment(1) },
          { merge: true },
        );
      }
    };

    // ---- Employer marks a payment as made ----
    if (job.employerId === caller) {
      if (isCrew) {
        if (!targetWorkerUid) throw new HttpsError("invalid-argument", "workerUid required for crew jobs.");
        const idx = roster.findIndex((w) => w.uid === targetWorkerUid);
        if (idx < 0) throw new HttpsError("not-found", "That worker isn't on this job.");
        if (roster[idx].status !== "confirmed") throw new HttpsError("failed-precondition", "Confirm the work first.");
        if (roster[idx].paidAt) throw new HttpsError("already-exists", "You already marked this payment.");
        const done = !!roster[idx].receivedAt;
        tx.update(jobRef, {
          assignedWorkers: roster.map((w, i) =>
            i === idx ? { ...w, paidAt: now, ...(done ? { paymentConfirmedAt: now } : {}) } : w,
          ),
          updatedAt: now,
        });
        if (done) completeHandshake(targetWorkerUid);
      } else {
        if (!job.assignedWorkerId) throw new HttpsError("failed-precondition", "No worker is assigned.");
        if (job.status !== "confirmed") throw new HttpsError("failed-precondition", "Confirm the work first.");
        if (job.paymentPaidAt) throw new HttpsError("already-exists", "You already marked this payment.");
        const done = !!job.paymentReceivedAt;
        tx.update(jobRef, {
          paymentPaidAt: now,
          ...(done ? { paymentConfirmedAt: now } : {}),
          updatedAt: now,
        });
        if (done) completeHandshake(job.assignedWorkerId);
      }
      return;
    }

    // ---- Worker confirms the payment arrived ----
    const crewIdx = roster.findIndex((w) => w.uid === caller && w.status !== "removed");
    const isCrewMember = isCrew && crewIdx >= 0;
    const isSingleWorker = !isCrew && job.assignedWorkerId === caller;
    if (!isCrewMember && !isSingleWorker) {
      throw new HttpsError("permission-denied", "You weren't part of this job.");
    }

    if (isCrewMember) {
      if (roster[crewIdx].status !== "confirmed") throw new HttpsError("failed-precondition", "Not confirmed yet.");
      if (roster[crewIdx].receivedAt) throw new HttpsError("already-exists", "You already confirmed this payment.");
      const done = !!roster[crewIdx].paidAt;
      tx.update(jobRef, {
        assignedWorkers: roster.map((w, i) =>
          i === crewIdx ? { ...w, receivedAt: now, ...(done ? { paymentConfirmedAt: now } : {}) } : w,
        ),
        updatedAt: now,
      });
      if (done) completeHandshake(caller);
    } else {
      if (job.status !== "confirmed") throw new HttpsError("failed-precondition", "Not confirmed yet.");
      if (job.paymentReceivedAt) throw new HttpsError("already-exists", "You already confirmed this payment.");
      const done = !!job.paymentPaidAt;
      tx.update(jobRef, {
        paymentReceivedAt: now,
        ...(done ? { paymentConfirmedAt: now } : {}),
        updatedAt: now,
      });
      if (done) completeHandshake(caller);
    }
  });

  return { ok: true };
});
