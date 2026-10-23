/**
 * Server-side handling of worker verification state changes.
 *
 * Two responsibilities:
 *
 *  1. First-time submission — promote `verificationStatus` from "none" to
 *     "pending" so the admin queue picks it up. (Workers can't write this
 *     field themselves; Firestore rules block self-approval.)
 *
 *  2. Re-submission after rejection — when a previously-rejected worker
 *     uploads new docs, flip them BACK to "pending" so the admin queue
 *     surfaces them. We also stamp `verification.resubmittedAt` so the UI
 *     can show a "resubmitted N times" badge.
 *
 * Idempotent: only fires when `verification.submittedAt` actually changed.
 */
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

type UserDoc = {
  role?: string;
  verificationStatus?: string;
  verification?: { submittedAt?: number; reviewedAt?: number };
};

export const onUserVerificationSubmitted = onDocumentWritten(
  "users/{uid}",
  async (event) => {
    const before = event.data?.before.data() as UserDoc | undefined;
    const after = event.data?.after.data() as UserDoc | undefined;
    if (!after) return; // user deleted

    // Workers MUST verify (it gates their account); employers/businesses may
    // OPTIONALLY verify their identity to earn the trust badge workers see.
    // Both use the same verificationStatus + private verification doc, so the
    // same promote-to-pending logic serves all three. (Admins never submit.)
    if (after.role !== "worker" && after.role !== "employer" && after.role !== "business") return;

    const beforeSubmittedAt = before?.verification?.submittedAt;
    const afterSubmittedAt = after.verification?.submittedAt;
    if (!afterSubmittedAt || afterSubmittedAt === beforeSubmittedAt) return;

    const status = after.verificationStatus ?? "none";
    const ref = getFirestore().doc(`users/${event.params.uid}`);

    // Brand-new submission
    if (status === "none") {
      try {
        await ref.update({ verificationStatus: "pending" });
        logger.info("Promoted worker to verification pending", { uid: event.params.uid });
      } catch (err) {
        logger.error("Failed first-time pending promotion", { uid: event.params.uid, err });
      }
      return;
    }

    // Re-submission after rejection OR a requested fix — back into the queue.
    if (status === "rejected" || status === "changes_requested") {
      try {
        await ref.update({
          verificationStatus: "pending",
          "verification.resubmittedAt": afterSubmittedAt,
          "verification.resubmissionCount": FieldValue.increment(1),
        });
        logger.info("Re-promoted worker to pending after resubmission", {
          uid: event.params.uid,
          from: status,
        });
      } catch (err) {
        logger.error("Failed re-pending promotion", { uid: event.params.uid, err });
      }
      return;
    }

    // Already-approved worker uploaded fresh docs — record the resubmission
    // so admins can see they touched their verification, but don't downgrade.
    if (status === "approved") {
      try {
        await ref.update({
          "verification.resubmittedAt": afterSubmittedAt,
          "verification.resubmissionCount": FieldValue.increment(1),
        });
      } catch (err) {
        logger.error("Failed to record approved-user resubmission", { uid: event.params.uid, err });
      }
      return;
    }

    // status === "pending" → no-op (already in queue)
  },
);
