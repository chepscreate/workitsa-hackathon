/**
 * Web push notifications via Firebase Cloud Messaging (FCM).
 *
 * Mirrors the email-trigger set in email.ts (offer created, offer accepted,
 * job confirmed). For each event we look up the recipient's saved FCM
 * tokens under users/{uid}/fcmTokens and dispatch via the Admin SDK's
 * messaging API. Failed / invalid tokens are pruned automatically.
 *
 * Cost: zero. FCM is free. Adds a few extra reads per triggered event.
 *
 * The architecture is provider-agnostic — see `notify.ts` for the dispatch
 * helper. Adding SMS / WhatsApp later is one adapter function.
 */

import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { dispatchPush } from "./notify";

const APP_URL = "https://workitsa.co.za";

type OfferDoc = {
  status?: string;
  workerId?: string;
  workerName?: string;
  price?: number;
  message?: string;
};

type JobDoc = {
  title?: string;
  employerId?: string;
  employerName?: string;
  assignedWorkerId?: string;
  agreedPrice?: number;
  status?: string;
};

async function getJob(jobId: string): Promise<JobDoc | null> {
  const snap = await getFirestore().doc(`jobs/${jobId}`).get();
  if (!snap.exists) return null;
  return snap.data() as JobDoc;
}

// ----- 1) New offer on a job → push the employer -----
export const onOfferCreatedPush = onDocumentCreated(
  "jobs/{jobId}/offers/{offerId}",
  async (event) => {
    const offer = event.data?.data() as OfferDoc | undefined;
    if (!offer?.workerName) return;
    const job = await getJob(event.params.jobId);
    if (!job?.employerId) return;
    try {
      await dispatchPush({
        toUid: job.employerId,
        title: "New offer on your job",
        body: `${offer.workerName} offered R ${offer.price} on "${job.title ?? "your job"}"`,
        href: `/jobs?id=${event.params.jobId}`,
        tag: `offer-${event.params.jobId}`,
      });
    } catch (err) {
      logger.error("onOfferCreatedPush failed", err);
    }
    void APP_URL;
  },
);

// ----- 2) Offer accepted → push the worker -----
export const onOfferAcceptedPush = onDocumentUpdated(
  "jobs/{jobId}/offers/{offerId}",
  async (event) => {
    const before = event.data?.before.data() as OfferDoc | undefined;
    const after = event.data?.after.data() as OfferDoc | undefined;
    if (!before || !after) return;
    if (before.status === "accepted" || after.status !== "accepted") return;
    if (!after.workerId) return;
    const job = await getJob(event.params.jobId);
    if (!job) return;
    try {
      await dispatchPush({
        toUid: after.workerId,
        title: "Your offer was accepted",
        body: `"${job.title ?? "Job"}" — R ${after.price}. Tap to coordinate.`,
        href: `/jobs?id=${event.params.jobId}`,
        tag: `accept-${event.params.jobId}`,
      });
    } catch (err) {
      logger.error("onOfferAcceptedPush failed", err);
    }
  },
);

// ----- 3) Job confirmed → push both sides asking for a rating -----
export const onJobConfirmedPush = onDocumentUpdated(
  "jobs/{jobId}",
  async (event) => {
    const before = event.data?.before.data() as JobDoc | undefined;
    const after = event.data?.after.data() as JobDoc | undefined;
    if (!before || !after) return;
    if (before.status === "confirmed" || after.status !== "confirmed") return;
    const href = `/jobs?id=${event.params.jobId}`;
    const title = after.title ?? "your job";
    const tasks: Promise<void>[] = [];
    if (after.employerId) {
      tasks.push(
        dispatchPush({
          toUid: after.employerId,
          title: "Rate the worker",
          body: `"${title}" is confirmed. Leave a rating.`,
          href,
          tag: `confirmed-employer-${event.params.jobId}`,
        }),
      );
    }
    if (after.assignedWorkerId) {
      tasks.push(
        dispatchPush({
          toUid: after.assignedWorkerId,
          title: "Rate the employer",
          body: `"${title}" is confirmed (R ${after.agreedPrice ?? "—"}). Leave a rating.`,
          href,
          tag: `confirmed-worker-${event.params.jobId}`,
        }),
      );
    }
    await Promise.allSettled(tasks);
  },
);
