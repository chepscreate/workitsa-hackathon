/**
 * Image moderation via Google Vision API.
 *
 * Triggered when ANY new file lands in Storage. For images, runs SafeSearch
 * detection. If the result is LIKELY or VERY_LIKELY adult/violence/racy,
 * deletes the file and writes a moderation record so admin can review.
 *
 * One-off setup (you do this):
 *   gcloud services enable vision.googleapis.com --project workit-6a927
 *   (or enable via console: APIs & Services → Library → Vision)
 */
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { logger } from "firebase-functions";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import vision from "@google-cloud/vision";

const visionClient = new vision.ImageAnnotatorClient();

function isBad(likelihood?: unknown): boolean {
  return likelihood === "LIKELY" || likelihood === "VERY_LIKELY";
}

export const onUploadedImageModerate = onObjectFinalized(
  {
    // A storage trigger MUST live in the same region as the bucket it listens
    // to. Our default bucket is in africa-south1, so this function has to be
    // there too — otherwise the whole functions codebase fails to deploy with
    // "a function in region us-central1 cannot listen to a bucket in region
    // africa-south1".
    region: "africa-south1",
    // Only need a small machine for this
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (event) => {
    const filePath = event.data.name;
    const contentType = event.data.contentType ?? "";
    const bucket = event.data.bucket;

    // Skip non-images
    if (!contentType.startsWith("image/")) return;

    // Skip files outside our managed prefixes
    if (
      !filePath.startsWith("avatars/")
      && !filePath.startsWith("verification/")
      && !filePath.startsWith("jobs/")
    ) {
      return;
    }

    try {
      const gsUri = `gs://${bucket}/${filePath}`;
      const [result] = await visionClient.safeSearchDetection(gsUri);
      const ss = result.safeSearchAnnotation;
      if (!ss) return;

      const flagged = {
        adult: isBad(ss.adult),
        violence: isBad(ss.violence),
        racy: isBad(ss.racy),
        medical: isBad(ss.medical),
      };
      const isFlagged = flagged.adult || flagged.violence || flagged.racy;

      if (!isFlagged) {
        return;
      }

      logger.warn("Moderation: deleting unsafe upload", { filePath, flagged });

      // Delete the file outright
      await getStorage().bucket(bucket).file(filePath).delete().catch((e) => {
        logger.error("Failed to delete unsafe file", e);
      });

      // Record the event so admin sees it
      await getFirestore().collection("moderationLog").add({
        filePath,
        bucket,
        contentType,
        flagged,
        likelihoods: {
          adult: ss.adult,
          violence: ss.violence,
          racy: ss.racy,
          medical: ss.medical,
        },
        at: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.error("Vision moderation failed", err);
    }
  },
);
