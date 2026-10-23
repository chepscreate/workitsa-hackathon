/**
 * Work Record — a worker's verifiable proof-of-work certificate.
 *
 * SA gig workers usually can't prove income or work history, which locks them
 * out of renting, loans, and formal job applications. Workit already holds the
 * evidence: confirmed jobs, agreed prices, ratings, verification status, and
 * the payment handshake (payments.ts). `generateWorkRecord` aggregates all of
 * it SERVER-SIDE (so a record can never be self-authored) into a single doc at
 * `workRecords/{token}` that the public /record?t={token} page renders and
 * anyone with the link can verify.
 *
 * Sharing model: the token doc id IS the bearer secret (same pattern as the
 * job publicShareToken) — a Firestore auto-id (~119 bits) is unguessable, the
 * collection can't be listed (rules allow only direct get), and the record
 * holds ONLY what the worker chose to publish by generating it. Employer names
 * / uids are deliberately left out of the job lines — a record shared with a
 * landlord shouldn't leak who the worker worked for, only what they did.
 * Regenerating refreshes the same token (stable link); `rotate: true` deletes
 * the old doc and mints a new token (kills previously shared links).
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

type CrewMember = {
  uid: string;
  status?: string;
  agreedPrice?: number;
  confirmedAt?: number;
  paymentConfirmedAt?: number;
  employerRating?: { stars: number };
};

type JobDoc = {
  title?: string;
  category?: string;
  suburb?: string;
  city?: string;
  status?: string;
  agreedPrice?: number;
  suggestedPrice?: number;
  createdAt?: number;
  completedAt?: number;
  updatedAt?: number;
  paymentConfirmedAt?: number;
  employerRating?: { stars: number };
  assignedWorkers?: CrewMember[];
};

/** One confirmed job as published on the record (no employer identifiers). */
type RecordJobLine = {
  title: string;
  category: string;
  area: string;
  at: number;
  price: number;
  stars?: number;
  paymentConfirmed: boolean;
};

const MAX_JOB_LINES = 40;

/**
 * Build (or refresh) a worker's Work Record server-side and return its public
 * token. Shared by the `generateWorkRecord` callable (worker-triggered) and the
 * WhatsApp proof-of-work trigger (fires when a job is confirmed). Throws
 * HttpsError for the callable's benefit; callers in a trigger wrap it.
 */
export async function upsertWorkRecord(
  uid: string,
  opts?: { rotate?: boolean },
): Promise<{ token: string; totalJobs: number; totalEarned: number }> {
  const rotate = opts?.rotate === true;

  const db = getFirestore();
  const profileSnap = await db.doc(`users/${uid}`).get();
  if (!profileSnap.exists) throw new HttpsError("not-found", "Profile not found.");
  const profile = profileSnap.data() as Record<string, unknown>;
  if (profile.role !== "worker") {
    throw new HttpsError("failed-precondition", "Work Records are for worker accounts.");
  }

  // ---- Gather every confirmed piece of work (single + crew) ----
  const [singleSnap, crewSnap] = await Promise.all([
    db.collection("jobs")
      .where("assignedWorkerId", "==", uid)
      .where("status", "==", "confirmed")
      .get(),
    db.collection("jobs")
      .where("assignedWorkerIds", "array-contains", uid)
      .get(),
  ]);

  const lines: RecordJobLine[] = [];
  let totalEarned = 0;
  const byCategory = new Map<string, { count: number; earned: number }>();

  const add = (line: RecordJobLine) => {
    lines.push(line);
    totalEarned += line.price;
    const c = byCategory.get(line.category) ?? { count: 0, earned: 0 };
    c.count += 1;
    c.earned += line.price;
    byCategory.set(line.category, c);
  };

  for (const d of singleSnap.docs) {
    const j = d.data() as JobDoc;
    add({
      title: j.title ?? "Job",
      category: j.category ?? "other",
      area: [j.suburb, j.city].filter(Boolean).join(", "),
      at: j.completedAt ?? j.updatedAt ?? j.createdAt ?? 0,
      price: j.agreedPrice ?? j.suggestedPrice ?? 0,
      ...(j.employerRating?.stars ? { stars: j.employerRating.stars } : {}),
      paymentConfirmed: !!j.paymentConfirmedAt,
    });
  }
  for (const d of crewSnap.docs) {
    const j = d.data() as JobDoc;
    const me = (j.assignedWorkers ?? []).find((w) => w.uid === uid);
    if (!me || me.status !== "confirmed") continue;
    add({
      title: j.title ?? "Job",
      category: j.category ?? "other",
      area: [j.suburb, j.city].filter(Boolean).join(", "),
      at: me.confirmedAt ?? j.updatedAt ?? j.createdAt ?? 0,
      price: me.agreedPrice ?? 0,
      ...(me.employerRating?.stars ? { stars: me.employerRating.stars } : {}),
      paymentConfirmed: !!me.paymentConfirmedAt,
    });
  }

  lines.sort((a, b) => b.at - a.at);

  // ---- Reuse the caller's existing token unless they asked to rotate ----
  const existing = await db.collection("workRecords").where("uid", "==", uid).limit(1).get();
  let ref;
  if (!existing.empty && rotate) {
    await existing.docs[0].ref.delete();
    ref = db.collection("workRecords").doc();
  } else if (!existing.empty) {
    ref = existing.docs[0].ref;
  } else {
    ref = db.collection("workRecords").doc();
  }

  const record = {
    uid,
    displayName: (profile.displayName as string) ?? "Workit worker",
    ...(profile.photoURL ? { photoURL: profile.photoURL as string } : {}),
    memberSince: (profile.createdAt as number) ?? 0,
    generatedAt: Date.now(),
    verified: profile.verificationStatus === "approved",
    backgroundVerified: profile.backgroundVerified === true,
    ratingAvg: (profile.ratingAvg as number) ?? 0,
    ratingCount: (profile.ratingCount as number) ?? 0,
    paymentsConfirmed: (profile.paymentsConfirmedCount as number) ?? 0,
    totalJobs: lines.length,
    totalEarned,
    ...(lines.length > 0 ? { firstJobAt: lines[lines.length - 1].at, lastJobAt: lines[0].at } : {}),
    categories: [...byCategory.entries()]
      .map(([id, c]) => ({ id, count: c.count, earned: c.earned }))
      .sort((a, b) => b.count - a.count),
    jobs: lines.slice(0, MAX_JOB_LINES),
  };

  await ref.set(record);
  return { token: ref.id, totalJobs: lines.length, totalEarned };
}

export const generateWorkRecord = onCall({ timeoutSeconds: 60 }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in.");
  const { token } = await upsertWorkRecord(req.auth.uid, { rotate: req.data?.rotate === true });
  return { token };
});
