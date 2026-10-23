/**
 * Data-retention enforcement (POPIA).
 *
 * The privacy policy promises: "Job and message history: kept for 5 years to
 * support dispute resolution and legal record-keeping." This scheduled job
 * makes that real — previously it was stated but never enforced
 * (LAUNCH_READINESS.md P2 #8).
 *
 * What it deletes: a job whose record has had NO activity for 5+ years AND is
 * in a terminal state (confirmed or cancelled), together with its messages and
 * offers subcollections (via recursiveDelete).
 *
 * What it NEVER deletes — the safety contract:
 *   - Any job that is open / assigned / in_progress / completed (awaiting
 *     confirmation) — i.e. still live.
 *   - Any DISPUTED job, regardless of age — a contested record must survive.
 *   - Any job missing a timestamp (we can't prove its age, so we keep it).
 * The terminal-status check is independent of the age query, so a recently
 * re-opened or re-disputed job (fresh updatedAt) can never be caught.
 *
 * Note on timing: Workit is months old, so NOTHING qualifies yet — this is
 * enforcement infrastructure that becomes active as records age past 5 years.
 * It is a safe no-op until then. Verified by unit-testing the predicate.
 *
 * Account profiles, verification documents (erased within 30 days of account
 * deletion — see erasure.ts) and anonymous analytics are governed elsewhere /
 * kept indefinitely per the policy, so they are out of scope here.
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { beat } from "./heartbeat";

export const RETENTION_YEARS = 5;
// 365.25 days/yr to absorb leap years over a 5-year window.
export const RETENTION_MS = RETENTION_YEARS * 365.25 * 24 * 60 * 60 * 1000;

/** Terminal states whose records are eligible for purge once they age out. */
const TERMINAL = new Set(["confirmed", "cancelled"]);

export type RetainableJob = {
  status?: string;
  createdAt?: number;
  updatedAt?: number;
  completedAt?: number;
};

/**
 * Pure decision: may this job be permanently deleted now? Kept separate from
 * the scheduled handler so it can be unit-tested without Firestore.
 */
export function isPurgeableJob(job: RetainableJob | undefined, nowMs: number): boolean {
  if (!job) return false;
  const status = job.status ?? "";
  if (status === "disputed") return false;     // contested records always survive
  if (!TERMINAL.has(status)) return false;      // only confirmed / cancelled are terminal
  const lastActivity = Math.max(job.updatedAt ?? 0, job.completedAt ?? 0, job.createdAt ?? 0);
  if (lastActivity <= 0) return false;          // unknown age → keep
  return nowMs - lastActivity > RETENTION_MS;
}

const MAX_PER_RUN = 300; // cap deletions/run; monthly cadence keeps it ample.

export const scheduledRetentionCleanup = onSchedule(
  {
    // 1st of each month, 03:00 SAST — quiet hours. 5-year retention doesn't
    // need a tighter cadence.
    schedule: "1 of month 03:00",
    timeZone: "Africa/Johannesburg",
    // Cloud Scheduler has no africa-south1 region (same note as backups.ts);
    // the deletes still target the africa-south1 database.
    region: "europe-west1",
    retryCount: 1,
    memory: "512MiB",
    timeoutSeconds: 540,
  },
  async () => {
    beat("scheduledRetentionCleanup");
    const db = getFirestore();
    const now = Date.now();
    const cutoff = now - RETENTION_MS;

    // Candidate query: jobs untouched for 5+ years (range on a single field —
    // auto-indexed). The terminal-state guard is applied per-doc below, so the
    // query is a coarse filter and isPurgeableJob is the real gate.
    const snap = await db
      .collection("jobs")
      .where("updatedAt", "<", cutoff)
      .limit(MAX_PER_RUN)
      .get();

    let deleted = 0;
    let skipped = 0;
    for (const doc of snap.docs) {
      if (!isPurgeableJob(doc.data() as RetainableJob, now)) {
        skipped += 1;
        continue;
      }
      try {
        // Deletes the job doc + its messages/offers subcollections.
        await db.recursiveDelete(doc.ref);
        deleted += 1;
      } catch (err) {
        logger.error("retention: recursiveDelete failed", { jobId: doc.id, err: String(err) });
      }
    }

    logger.info("retention cleanup run", {
      cutoffISO: new Date(cutoff).toISOString(),
      retentionYears: RETENTION_YEARS,
      scanned: snap.size,
      deleted,
      skipped,
    });
  },
);
