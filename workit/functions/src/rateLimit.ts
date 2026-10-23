/**
 * Rate-limit + first-post review for new job posts.
 *
 *  - **Rate limit**: more than 10 posts in 24 hours from one employer is a
 *    spam pattern. Past that threshold, new posts are auto-held in
 *    moderationStatus="pending_review" and flagged for admin.
 *  - **First-post review**: brand-new accounts (zero confirmed jobs) get
 *    their first post held for review. Stops drive-by abuse before
 *    anything goes live.
 *
 * Runs after `onJobCreatedTextScreen`. If that function already set
 * moderationStatus we leave it alone (more severe wins).
 */

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";

const RATE_LIMIT_24H = 10;

export const onJobCreatedRateAndFirstPost = onDocumentCreated(
  "jobs/{jobId}",
  async (event) => {
    const job = event.data?.data() as
      | { employerId?: string; createdAt?: number; moderationStatus?: string }
      | undefined;
    if (!job?.employerId) return;
    // Respect any earlier-stronger decision (text screen already removed it).
    if (job.moderationStatus === "removed") return;

    const db = getFirestore();
    const jobRef = db.doc(`jobs/${event.params.jobId}`);

    // ----- Rate limit (24h rolling window) -----
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recent = await db
      .collection("jobs")
      .where("employerId", "==", job.employerId)
      .where("createdAt", ">=", oneDayAgo)
      .get();
    if (recent.size > RATE_LIMIT_24H) {
      await jobRef.update({
        moderationStatus: "pending_review",
        moderationReason: `Rate limit: ${recent.size} jobs in 24h from same employer`,
      });
      await db.collection("moderation").add({
        kind: "rate_limit",
        targetType: "job",
        targetId: event.params.jobId,
        reason: `Employer posted ${recent.size} jobs in last 24h (limit ${RATE_LIMIT_24H})`,
        severity: "medium",
        createdAt: Date.now(),
        autoActioned: true,
      });
      logger.warn("Job held for rate-limit review", {
        jobId: event.params.jobId,
        employerId: job.employerId,
        count: recent.size,
      });
      return;
    }

    // ----- First-post review -----
    // Read the employer's profile. New accounts (no confirmed jobs) get held.
    const userSnap = await db.doc(`users/${job.employerId}`).get();
    if (!userSnap.exists) return;
    const user = userSnap.data() as {
      jobsCompleted?: number;
      accountStatus?: string;
      role?: string;
    };
    const completed = user.jobsCompleted ?? 0;

    // Skip if they're a trusted account (>=2 confirmed jobs) or suspended already.
    if (completed >= 2 || user.accountStatus === "suspended" || user.accountStatus === "rejected") {
      return;
    }

    // First or second post from a new account → hold + flag.
    if (recent.size <= 2) {
      await jobRef.update({
        moderationStatus: "pending_review",
        moderationReason: "First-post review (new account)",
      });
      await db.collection("moderation").add({
        kind: "first_post_review",
        targetType: "job",
        targetId: event.params.jobId,
        reason: `New account first post (${completed} confirmed jobs lifetime)`,
        severity: "low",
        createdAt: Date.now(),
        autoActioned: true,
      });
      logger.info("Job held for first-post review", { jobId: event.params.jobId });
    }
  },
);
