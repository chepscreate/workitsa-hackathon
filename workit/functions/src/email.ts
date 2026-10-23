/**
 * Firestore-triggered notification emails via SendGrid (offers, accepts,
 * ratings). The SendGrid transport + HTML shell live in ./mailer, shared with
 * the custom auth emails in ./authEmails.
 */
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { getFirestore } from "firebase-admin/firestore";
import {
  send,
  shell,
  APP_URL,
  SENDGRID_API_KEY,
  SENDGRID_FROM_EMAIL,
} from "./mailer";

type UserDoc = {
  email?: string;
  displayName?: string;
  // user can opt out of emails per channel
  emailPrefs?: { offers?: boolean; updates?: boolean };
};

async function userEmail(uid: string): Promise<{ email: string; name: string; offersOptIn: boolean } | null> {
  const snap = await getFirestore().doc(`users/${uid}`).get();
  if (!snap.exists) return null;
  const data = snap.data() as UserDoc;
  if (!data.email) return null;
  const offersOptIn = data.emailPrefs?.offers !== false; // default on
  return {
    email: data.email,
    name: data.displayName ?? "there",
    offersOptIn,
  };
}

// --- 1) New offer on a job → email the employer -----------------------------

export const onOfferCreatedSendEmail = onDocumentCreated(
  {
    document: "jobs/{jobId}/offers/{offerId}",
    secrets: [SENDGRID_API_KEY, SENDGRID_FROM_EMAIL],
  },
  async (event) => {
    const offer = event.data?.data();
    if (!offer) return;
    const jobId = event.params.jobId;

    const jobSnap = await getFirestore().doc(`jobs/${jobId}`).get();
    if (!jobSnap.exists) return;
    const job = jobSnap.data() as { title: string; employerId: string };
    const employer = await userEmail(job.employerId);
    if (!employer || !employer.offersOptIn) return;

    const jobUrl = `${APP_URL}/jobs?id=${jobId}`;
    await send({
      to: employer.email,
      subject: `New offer on "${job.title}"`,
      text: `${offer.workerName} offered R ${offer.price} on your job "${job.title}". Open Workit to review: ${jobUrl}`,
      html: shell(
        "You've got a new offer",
        `<p><b>${offer.workerName}</b> offered <b>R ${offer.price}</b> on your job <b>"${job.title}"</b>.</p>
         ${offer.message ? `<p style="font-style:italic;color:#7a6a5e;">"${offer.message}"</p>` : ""}`,
        { href: jobUrl, label: "Review offer" },
      ),
    });
  },
);

// --- 2) Offer accepted → email the worker -----------------------------------

export const onOfferAcceptedSendEmail = onDocumentUpdated(
  {
    document: "jobs/{jobId}/offers/{offerId}",
    secrets: [SENDGRID_API_KEY, SENDGRID_FROM_EMAIL],
  },
  async (event) => {
    const before = event.data?.before.data() as { status?: string };
    const after = event.data?.after.data() as
      | { status?: string; workerId?: string; price?: number }
      | undefined;
    if (!before || !after) return;
    if (before.status === "accepted" || after.status !== "accepted") return;

    const jobId = event.params.jobId;
    const jobSnap = await getFirestore().doc(`jobs/${jobId}`).get();
    if (!jobSnap.exists) return;
    const job = jobSnap.data() as { title: string };

    if (!after.workerId) return;
    const worker = await userEmail(after.workerId);
    if (!worker || !worker.offersOptIn) return;

    const jobUrl = `${APP_URL}/jobs?id=${jobId}`;
    await send({
      to: worker.email,
      subject: `Your offer was accepted — "${job.title}"`,
      text: `Your offer of R ${after.price} on "${job.title}" was accepted. Open Workit to coordinate: ${jobUrl}`,
      html: shell(
        "Your offer was accepted",
        `<p>Congratulations — your offer of <b>R ${after.price}</b> on <b>"${job.title}"</b> was accepted.</p>
         <p>Open the job to chat with the employer, share your live location, and mark it complete when done.</p>`,
        { href: jobUrl, label: "Open the job" },
      ),
    });
  },
);

// --- 3) Job confirmed → email both sides asking for a rating ----------------

export const onJobConfirmedSendEmail = onDocumentUpdated(
  {
    document: "jobs/{jobId}",
    secrets: [SENDGRID_API_KEY, SENDGRID_FROM_EMAIL],
  },
  async (event) => {
    const before = event.data?.before.data() as { status?: string };
    const after = event.data?.after.data() as
      | {
          status?: string;
          title?: string;
          employerId?: string;
          assignedWorkerId?: string;
          agreedPrice?: number;
        }
      | undefined;
    if (!before || !after) return;
    if (before.status === "confirmed" || after.status !== "confirmed") return;
    if (!after.employerId || !after.assignedWorkerId) return;

    const jobUrl = `${APP_URL}/jobs?id=${event.params.jobId}`;
    const title = after.title ?? "a job";

    const [employer, worker] = await Promise.all([
      userEmail(after.employerId),
      userEmail(after.assignedWorkerId),
    ]);

    if (employer) {
      await send({
        to: employer.email,
        subject: `Rate the worker — "${title}"`,
        text: `The job "${title}" is confirmed complete. Please leave a rating: ${jobUrl}`,
        html: shell(
          "How did it go?",
          `<p>The job <b>"${title}"</b> is confirmed complete.</p>
           <p>Please leave a rating — both ratings stay private until both sides have submitted, so your honest feedback is safe.</p>`,
          { href: jobUrl, label: "Rate the worker" },
        ),
      });
    }
    if (worker) {
      await send({
        to: worker.email,
        subject: `Rate the employer — "${title}"`,
        text: `The job "${title}" is confirmed (R ${after.agreedPrice ?? "—"}). Please leave a rating: ${jobUrl}`,
        html: shell(
          "How was the employer?",
          `<p>Nice work — the job <b>"${title}"</b> is confirmed (R ${after.agreedPrice ?? "—"}).</p>
           <p>Please rate the employer. Good ratings here help other workers decide which jobs to take.</p>`,
          { href: jobUrl, label: "Rate the employer" },
        ),
      });
    }
  },
);
