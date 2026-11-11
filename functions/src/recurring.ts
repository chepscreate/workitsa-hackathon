/**
 * Recurring auto-rebooking — phase 2 of the Rebooking retention loop.
 *
 * Phase 1 gave employers a one-tap "Book again" on a confirmed job. This makes
 * it a true schedule: on a confirmed "template" job the employer turns on a
 * weekly / fortnightly / monthly cadence (writes a `recurrence` map — see the
 * JobRecurrence type / setJobRecurrence client fn), and this scheduled function
 * mints a fresh OPEN copy each time the schedule falls due.
 *
 * Design:
 *   - The schedule lives on the original confirmed job. Minted copies carry
 *     `recurrenceParent` + `rebookedFrom` but NOT `recurrence`, so they never
 *     recur themselves.
 *   - Runs daily (05:00 SAST) and mints any schedule whose `nextRunAt` is due.
 *     `nextRunAt` is advanced relative to its previous value (not "now"), so a
 *     schedule that fell behind catches up one copy per daily run rather than
 *     minting a backlog all at once.
 *   - Copies the same reusable fields as the client `rebookJob` (priced at what
 *     was actually paid; date-specific `dueAt`/`urgent` are intentionally NOT
 *     carried over) and re-invites the worker/crew when `inviteSameWorker`.
 *   - If the employer's account is gone or no longer approved, the schedule is
 *     deactivated (stops noise; the employer can turn it back on).
 *
 * The minted copy is created with the Admin SDK (bypasses Firestore rules). The
 * usual create-time triggers still fire on it — including onJobVisibleAlertWorkers,
 * which sends the invited worker(s) the dedicated "you've been invited back" push.
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { beat } from "./heartbeat";

export type RecurrenceFrequency = "weekly" | "fortnightly" | "monthly";

type Recurrence = {
  frequency?: RecurrenceFrequency;
  active?: boolean;
  nextRunAt?: number;
  inviteSameWorker?: boolean;
  count?: number;
};

type AssignedWorkerDoc = { uid?: string; status?: string };

type SourceJob = {
  employerId?: string;
  employerName?: string;
  employerPhotoURL?: string | null;
  employerIsBusiness?: boolean;
  title?: string;
  description?: string;
  category?: string;
  subcategory?: string;
  suggestedPrice?: number;
  agreedPrice?: number;
  suburb?: string;
  city?: string;
  province?: string;
  lat?: number;
  lng?: number;
  photoURLs?: string[];
  toolsProvided?: string;
  transportIncluded?: boolean;
  trainingProvided?: boolean;
  experienceLevel?: string;
  estimatedHours?: number;
  estimatedUnit?: string;
  paymentMethod?: string;
  workersNeeded?: number;
  workerPreference?: Record<string, unknown>;
  assignedWorkerId?: string;
  assignedWorkers?: AssignedWorkerDoc[];
  recurrence?: Recurrence;
};

/**
 * Add one interval and floor to UTC midnight. MUST mirror the client
 * `nextRecurrenceAt` in src/lib/types.ts — the two packages don't share code.
 */
export function nextRecurrenceAt(fromMs: number, freq: RecurrenceFrequency): number {
  const d = new Date(fromMs);
  if (freq === "weekly") d.setDate(d.getDate() + 7);
  else if (freq === "fortnightly") d.setDate(d.getDate() + 14);
  else {
    const day = d.getDate();
    d.setMonth(d.getMonth() + 1);
    if (d.getDate() < day) d.setDate(0); // clamp e.g. Jan 31 → last day of Feb
  }
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

/** The worker(s) to re-invite — single assigned worker, or the live crew. */
function inviteTargets(job: SourceJob): string[] {
  if (Array.isArray(job.assignedWorkers) && job.assignedWorkers.length > 0) {
    return job.assignedWorkers
      .filter((w) => w?.status !== "removed" && typeof w?.uid === "string")
      .map((w) => w.uid as string);
  }
  return job.assignedWorkerId ? [job.assignedWorkerId] : [];
}

/**
 * Build the new OPEN job doc from a template job — mirrors the field selection
 * in the client `createJob`/`rebookJob`. Only includes fields that are present
 * (Firestore rejects `undefined` values).
 */
function buildCopy(job: SourceJob, sourceId: string): Record<string, unknown> {
  const now = Date.now();
  const invite = job.recurrence?.inviteSameWorker ?? true;
  const invited = invite ? inviteTargets(job) : [];
  const isCrew = typeof job.workersNeeded === "number" && job.workersNeeded > 1;

  return {
    employerId: job.employerId,
    employerName: job.employerName,
    employerPhotoURL: job.employerPhotoURL ?? null,
    ...(job.employerIsBusiness ? { employerIsBusiness: true } : {}),
    title: job.title,
    description: job.description,
    category: job.category,
    ...(job.subcategory ? { subcategory: job.subcategory } : {}),
    suggestedPrice: job.agreedPrice ?? job.suggestedPrice,
    suburb: job.suburb,
    city: job.city,
    province: job.province,
    status: "open",
    offerCount: 0,
    ...(Array.isArray(job.photoURLs) && job.photoURLs.length > 0
      ? { photoURLs: job.photoURLs }
      : {}),
    ...(typeof job.lat === "number" && typeof job.lng === "number"
      ? { lat: job.lat, lng: job.lng }
      : {}),
    ...(job.toolsProvided ? { toolsProvided: job.toolsProvided } : {}),
    ...(typeof job.transportIncluded === "boolean"
      ? { transportIncluded: job.transportIncluded }
      : {}),
    ...(typeof job.trainingProvided === "boolean"
      ? { trainingProvided: job.trainingProvided }
      : {}),
    ...(job.experienceLevel ? { experienceLevel: job.experienceLevel } : {}),
    ...(typeof job.estimatedHours === "number" && job.estimatedHours > 0
      ? { estimatedHours: job.estimatedHours, estimatedUnit: job.estimatedUnit ?? "hours" }
      : {}),
    ...(job.paymentMethod ? { paymentMethod: job.paymentMethod } : {}),
    ...(isCrew
      ? { workersNeeded: job.workersNeeded, assignedWorkers: [], assignedWorkerIds: [] }
      : {}),
    ...(job.workerPreference ? { workerPreference: job.workerPreference } : {}),
    ...(invited.length > 0 ? { invitedWorkerIds: invited } : {}),
    rebookedFrom: sourceId,
    recurrenceParent: sourceId,
    createdAt: now,
    updatedAt: now,
    createdAtServer: FieldValue.serverTimestamp(),
  };
}

const MAX_PER_RUN = 200;

export const scheduledRecurringJobs = onSchedule(
  {
    // Every morning, 05:00 SAST — the copy is live before the day's work starts.
    schedule: "every day 05:00",
    timeZone: "Africa/Johannesburg",
    // Cloud Scheduler has no africa-south1 region (same note as retention.ts /
    // backups.ts); the writes still target the africa-south1 database.
    region: "europe-west1",
    retryCount: 1,
    memory: "512MiB",
    timeoutSeconds: 540,
  },
  async () => {
    beat("scheduledRecurringJobs");
    const db = getFirestore();
    const now = Date.now();

    const snap = await db
      .collection("jobs")
      .where("recurrence.active", "==", true)
      .limit(MAX_PER_RUN)
      .get();

    let minted = 0;
    let skipped = 0;
    let deactivated = 0;

    for (const docSnap of snap.docs) {
      const job = docSnap.data() as SourceJob;
      const rec = job.recurrence ?? {};

      if (typeof rec.nextRunAt !== "number" || rec.nextRunAt > now) {
        skipped += 1;
        continue;
      }
      if (!rec.frequency || !job.employerId) {
        skipped += 1;
        continue;
      }

      // Don't keep posting on behalf of a deleted / suspended employer.
      const empSnap = await db.doc(`users/${job.employerId}`).get();
      const empStatus = (empSnap.data()?.accountStatus as string) ?? "approved";
      if (!empSnap.exists || empStatus !== "approved") {
        try {
          await docSnap.ref.update({
            "recurrence.active": false,
            "recurrence.stoppedAt": now,
            updatedAt: now,
          });
        } catch (err) {
          logger.error("recurring: deactivate failed", { jobId: docSnap.id, err: String(err) });
        }
        deactivated += 1;
        continue;
      }

      try {
        const newRef = await db.collection("jobs").add(buildCopy(job, docSnap.id));
        await docSnap.ref.update({
          "recurrence.nextRunAt": nextRecurrenceAt(rec.nextRunAt, rec.frequency),
          "recurrence.lastRunAt": now,
          "recurrence.lastJobId": newRef.id,
          "recurrence.count": (rec.count ?? 0) + 1,
          updatedAt: now,
        });
        minted += 1;
      } catch (err) {
        logger.error("recurring: mint failed", { jobId: docSnap.id, err: String(err) });
      }
    }

    logger.info("recurring jobs run", { scanned: snap.size, minted, skipped, deactivated });
  },
);
