/**
 * Scheduled Firestore backups.
 *
 * Runs a managed Firestore export every week into a dedicated Cloud Storage
 * bucket. Each run writes a timestamped folder, so you keep weekly snapshots.
 *
 * One-off setup (you do this — see /functions/README.md):
 *   1. Create the backup bucket IN THE SAME REGION as Firestore (africa-south1):
 *        gcloud storage buckets create gs://workit-6a927-backups \
 *          --project workit-6a927 --location africa-south1
 *   2. Grant the function's service account export rights:
 *        gcloud projects add-iam-policy-binding workit-6a927 \
 *          --member "serviceAccount:workit-6a927@appspot.gserviceaccount.com" \
 *          --role "roles/datastore.importExportAdmin"
 *   3. (90-day retention) add a lifecycle rule so old backups auto-delete:
 *        gcloud storage buckets update gs://workit-6a927-backups \
 *          --add-lifecycle-rule="type=Delete,age=90"
 *
 * Restore (manual, when needed):
 *   gcloud firestore import gs://workit-6a927-backups/<timestamp>
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { v1 } from "@google-cloud/firestore";
import { beat } from "./heartbeat";

const BACKUP_BUCKET = "gs://workit-6a927-backups";

const adminClient = new v1.FirestoreAdminClient();

export const scheduledFirestoreBackup = onSchedule(
  {
    // Sunday 02:00 SAST — quiet hours, low traffic.
    schedule: "every sunday 02:00",
    timeZone: "Africa/Johannesburg",
    // Cloud Scheduler has NO africa-south1 location, so this scheduled function
    // can't live there (unlike the rest of our functions). The export is just
    // an API call, so region is irrelevant to where the data ends up — it still
    // backs up the africa-south1 database into the africa-south1 bucket.
    // europe-west1 is a valid Scheduler region and the closest low-latency one.
    region: "europe-west1",
    retryCount: 1,
    memory: "256MiB",
    timeoutSeconds: 540,
  },
  async () => {
    beat("scheduledFirestoreBackup");
    const projectId =
      process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? "workit-6a927";
    const databaseName = adminClient.databasePath(projectId, "(default)");

    // Timestamped folder per run → weekly snapshots, easy to find/restore.
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputUriPrefix = `${BACKUP_BUCKET}/${stamp}`;

    try {
      const [operation] = await adminClient.exportDocuments({
        name: databaseName,
        outputUriPrefix,
        // Empty array = export every collection.
        collectionIds: [],
      });
      logger.info("Firestore backup export started", {
        operation: operation.name,
        outputUriPrefix,
      });
    } catch (err) {
      logger.error("Firestore backup export failed", { err, outputUriPrefix });
      throw err; // let the retry kick in
    }
  },
);
