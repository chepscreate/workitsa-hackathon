"use client";

import {
  addDoc,
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getDb, getFunctionsInstance } from "./firebase";
import { track } from "./analytics";
import { measure } from "./performance";
import type { AssignedWorker, CategoryId, ChatMessage, Dispute, DisputeReason, DisputeResolution, Job, JobStatus, Offer, OfferStatus, RecurrenceFrequency, UserProfile } from "./types";
import { activeCrew, computeBadges, isCrewJob, nextRecurrenceAt } from "./types";

function jobFromDoc(d: QueryDocumentSnapshot<DocumentData>): Job {
  return { id: d.id, ...d.data() } as Job;
}

/** Open jobs older than this are considered stale and hidden from the feed. */
export const STALE_JOB_MS = 7 * 24 * 60 * 60 * 1000;
export function isStale(job: Job, now: number = Date.now()): boolean {
  return job.status === "open" && (job.createdAt ?? 0) < now - STALE_JOB_MS;
}
function offerFromDoc(d: QueryDocumentSnapshot<DocumentData>): Offer {
  return { id: d.id, ...d.data() } as Offer;
}

// ---------- JOBS ----------

export async function createJob(input: {
  employer: UserProfile;
  title: string;
  description: string;
  category: CategoryId;
  subcategory?: string;
  suggestedPrice: number;
  suburb: string;
  city: string;
  province: string;
  photoURLs?: string[];
  lat?: number;
  lng?: number;
  // Structured specs
  toolsProvided?: "employer" | "worker" | "shared" | "na";
  transportIncluded?: boolean;
  trainingProvided?: boolean;
  experienceLevel?: "any" | "some" | "experienced";
  estimatedHours?: number;
  estimatedUnit?: "hours" | "days";
  dueAt?: number;
  paymentMethod?: "cash" | "eft";
  workersNeeded?: number;
  invitedWorkerIds?: string[];
  workerPreference?: { gender?: "male" | "female" | "any"; ageMin?: number; ageMax?: number };
  urgent?: boolean;
  /** Set when this job is a "Book again" / recurring copy of an earlier one. */
  rebookedFrom?: string;
}): Promise<string> {
  const now = Date.now();
  const ref = await measure("post_job", () => addDoc(collection(getDb(), "jobs"), {
    employerId: input.employer.uid,
    // Businesses post under their trading name + logo so workers see who's
    // hiring; employerIsBusiness lets job views link to the business profile.
    employerName: input.employer.businessName || input.employer.displayName,
    employerPhotoURL:
      input.employer.businessLogoURL || input.employer.photoURL || null,
    ...(input.employer.role === "business" ? { employerIsBusiness: true } : {}),
    title: input.title,
    description: input.description,
    category: input.category,
    ...(input.subcategory ? { subcategory: input.subcategory } : {}),
    suggestedPrice: input.suggestedPrice,
    suburb: input.suburb,
    city: input.city,
    province: input.province,
    status: "open" satisfies JobStatus,
    offerCount: 0,
    ...(input.photoURLs && input.photoURLs.length > 0
      ? { photoURLs: input.photoURLs }
      : {}),
    ...(typeof input.lat === "number" && typeof input.lng === "number"
      ? { lat: input.lat, lng: input.lng }
      : {}),
    ...(input.toolsProvided ? { toolsProvided: input.toolsProvided } : {}),
    ...(typeof input.transportIncluded === "boolean"
      ? { transportIncluded: input.transportIncluded }
      : {}),
    ...(typeof input.trainingProvided === "boolean"
      ? { trainingProvided: input.trainingProvided }
      : {}),
    ...(input.experienceLevel ? { experienceLevel: input.experienceLevel } : {}),
    ...(typeof input.estimatedHours === "number" && input.estimatedHours > 0
      ? { estimatedHours: input.estimatedHours, estimatedUnit: input.estimatedUnit ?? "hours" }
      : {}),
    ...(typeof input.dueAt === "number" && input.dueAt > 0 ? { dueAt: input.dueAt } : {}),
    ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
    ...(typeof input.workersNeeded === "number" && input.workersNeeded > 1
      ? { workersNeeded: input.workersNeeded, assignedWorkers: [], assignedWorkerIds: [] }
      : {}),
    ...(input.invitedWorkerIds && input.invitedWorkerIds.length > 0
      ? { invitedWorkerIds: input.invitedWorkerIds }
      : {}),
    ...(input.workerPreference
      && (input.workerPreference.gender && input.workerPreference.gender !== "any"
          || typeof input.workerPreference.ageMin === "number"
          || typeof input.workerPreference.ageMax === "number")
      ? { workerPreference: input.workerPreference }
      : {}),
    ...(input.urgent ? { urgent: true } : {}),
    ...(input.rebookedFrom ? { rebookedFrom: input.rebookedFrom } : {}),
    createdAt: now,
    updatedAt: now,
    createdAtServer: serverTimestamp(),
  }));
  track("job_posted", {
    job_category: input.category,
    job_budget: input.suggestedPrice,
    area: input.suburb || input.city || "",
    has_photos: !!(input.photoURLs && input.photoURLs.length > 0),
  });
  return ref.id;
}

/**
 * Re-post a finished job — the "Book again" retention loop.
 *
 * Copies the reusable details from a confirmed job into a fresh open job,
 * priced at what was actually paid last time (agreedPrice), and — by default —
 * invites the worker(s) who did it so they're flagged on the new post. Goes
 * through createJob, so it stays rules-compliant and re-fires the worker alert.
 * Date-specific fields (dueAt, urgent) are intentionally NOT carried over.
 */
export async function rebookJob(
  source: Job,
  employer: UserProfile,
  opts?: { inviteSameWorker?: boolean },
): Promise<string> {
  const invite = opts?.inviteSameWorker ?? true;
  const invitedWorkerIds = invite
    ? isCrewJob(source)
      ? activeCrew(source).map((w) => w.uid)
      : source.assignedWorkerId
        ? [source.assignedWorkerId]
        : []
    : [];
  const newId = await createJob({
    employer,
    title: source.title,
    description: source.description,
    category: source.category,
    subcategory: source.subcategory,
    suggestedPrice: source.agreedPrice ?? source.suggestedPrice,
    suburb: source.suburb,
    city: source.city,
    province: source.province,
    photoURLs: source.photoURLs,
    lat: source.lat,
    lng: source.lng,
    toolsProvided: source.toolsProvided,
    transportIncluded: source.transportIncluded,
    trainingProvided: source.trainingProvided,
    experienceLevel: source.experienceLevel,
    estimatedHours: source.estimatedHours,
    estimatedUnit: source.estimatedUnit,
    paymentMethod: source.paymentMethod,
    workersNeeded: source.workersNeeded,
    workerPreference: source.workerPreference,
    rebookedFrom: source.id,
    ...(invitedWorkerIds.length > 0 ? { invitedWorkerIds } : {}),
  });
  track("job_rebooked", { invited: invitedWorkerIds.length > 0, from: source.id });
  return newId;
}

/**
 * Turn on (or update) a recurring auto-schedule on a confirmed job. The
 * scheduledRecurringJobs Cloud Function mints a fresh open copy each interval
 * — see JobRecurrence. The schedule lives on this (template) job; the minted
 * copies never carry it, so they don't recur themselves.
 */
export async function setJobRecurrence(
  jobId: string,
  frequency: RecurrenceFrequency,
  inviteSameWorker: boolean,
): Promise<void> {
  const now = Date.now();
  await updateDoc(doc(getDb(), "jobs", jobId), {
    recurrence: {
      frequency,
      active: true,
      inviteSameWorker,
      nextRunAt: nextRecurrenceAt(now, frequency),
      createdAt: now,
      count: 0,
    },
    updatedAt: now,
  });
  track("job_recurrence_set", { frequency, invited: inviteSameWorker });
}

/** Stop a recurring auto-schedule (keeps the record so the UI can show history). */
export async function cancelJobRecurrence(jobId: string): Promise<void> {
  await updateDoc(doc(getDb(), "jobs", jobId), {
    "recurrence.active": false,
    "recurrence.stoppedAt": Date.now(),
    updatedAt: Date.now(),
  });
  track("job_recurrence_cancelled");
}

// ---------- START PIN (doorstep handshake) ----------

/** Employer toggles whether a 4-digit start code is needed to begin the job. */
export async function setRequireStartPin(jobId: string, required: boolean): Promise<void> {
  await updateDoc(doc(getDb(), "jobs", jobId), {
    requireStartPin: required,
    updatedAt: Date.now(),
  });
  track(required ? "start_pin_enabled" : "start_pin_disabled");
}

/**
 * Employer fetches the job's 4-digit start code (server-generated, employer-only).
 * The code never travels on the public job doc — see functions/src/startPin.ts.
 */
export async function getJobStartPin(jobId: string): Promise<string> {
  const fn = httpsCallable<{ jobId: string }, { pin: string }>(
    getFunctionsInstance(),
    "getJobStartPin",
  );
  const res = await fn({ jobId });
  return res.data.pin;
}

/** Worker enters the start code; on success the server flips the job to in_progress. */
export async function verifyJobStartPin(jobId: string, pin: string): Promise<void> {
  const fn = httpsCallable<{ jobId: string; pin: string }, { ok: boolean }>(
    getFunctionsInstance(),
    "verifyJobStartPin",
  );
  await fn({ jobId, pin });
  track("start_pin_verified");
}

export async function getJob(jobId: string): Promise<Job | null> {
  const snap = await getDoc(doc(getDb(), "jobs", jobId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Job, "id">) };
}

// One-shot queries (kept for non-realtime callers)
export async function listOpenJobs(category?: CategoryId): Promise<Job[]> {
  const base = collection(getDb(), "jobs");
  const q = category
    ? query(base, where("status", "==", "open"), where("category", "==", category), orderBy("createdAt", "desc"))
    : query(base, where("status", "==", "open"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(jobFromDoc);
}

export async function getUserProfile(uid: string) {
  const snap = await getDoc(doc(getDb(), "users", uid));
  if (!snap.exists()) return null;
  return { uid, ...(snap.data() as object) };
}

export async function listMyJobs(employerId: string): Promise<Job[]> {
  const q = query(collection(getDb(), "jobs"), where("employerId", "==", employerId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(jobFromDoc);
}

export async function listMyAssignedJobs(workerId: string): Promise<Job[]> {
  const q = query(collection(getDb(), "jobs"), where("assignedWorkerId", "==", workerId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(jobFromDoc);
}

/**
 * A worker's "proof of work" gallery for their public profile — the completion
 * photos from their confirmed jobs (real evidence, not self-curated). Equality-
 * only query (no orderBy) so it needs no composite index; sorted + capped client
 * side. Single-assigned jobs only for now (crew completion photos are shared).
 */
export async function listWorkerProofOfWork(
  workerId: string,
  max = 12,
): Promise<{ url: string; jobId: string; title: string }[]> {
  try {
    const snap = await getDocs(
      query(
        collection(getDb(), "jobs"),
        where("assignedWorkerId", "==", workerId),
        where("status", "==", "confirmed"),
      ),
    );
    const jobs = snap.docs
      .map(jobFromDoc)
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    const out: { url: string; jobId: string; title: string }[] = [];
    for (const j of jobs) {
      for (const url of j.completionPhotoURLs ?? []) {
        out.push({ url, jobId: j.id, title: j.title });
        if (out.length >= max) return out;
      }
    }
    return out;
  } catch {
    return [];
  }
}

// ---------- REAL-TIME SUBSCRIPTIONS ----------

export function subscribeOpenJobs(
  category: CategoryId | undefined,
  cb: (jobs: Job[]) => void,
): Unsubscribe {
  const base = collection(getDb(), "jobs");
  const q = category
    ? query(base, where("status", "==", "open"), where("category", "==", category), orderBy("createdAt", "desc"))
    : query(base, where("status", "==", "open"), orderBy("createdAt", "desc"));
  // Filter stale (>7-day-old) open jobs out of the public feed.
  return onSnapshot(q, (snap) => {
    const now = Date.now();
    cb(
      snap.docs
        .map(jobFromDoc)
        // Drop stale jobs AND anything held for moderation review or removed.
        .filter((j) => !isStale(j, now))
        .filter((j) => !j.moderationStatus),
    );
  });
}

export function subscribeMyJobs(
  employerId: string,
  cb: (jobs: Job[]) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "jobs"),
    where("employerId", "==", employerId),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map(jobFromDoc)));
}

/**
 * All jobs the given worker is currently attached to — both the legacy
 * single-worker field (`assignedWorkerId`) and the crew roster
 * (`assignedWorkerIds` array). Firestore doesn't support OR across two
 * fields in a single query, so we run two subscriptions in parallel and
 * merge the results in the callback (deduped by job id).
 */
export function subscribeMyAssignedJobs(
  workerId: string,
  cb: (jobs: Job[]) => void,
): Unsubscribe {
  const merged = new Map<string, Job>();
  let legacyReady = false;
  let crewReady = false;

  const fire = () => {
    if (!legacyReady || !crewReady) return;
    const all = Array.from(merged.values()).sort(
      (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
    );
    cb(all);
  };

  const legacyQ = query(
    collection(getDb(), "jobs"),
    where("assignedWorkerId", "==", workerId),
    orderBy("createdAt", "desc"),
  );
  const crewQ = query(
    collection(getDb(), "jobs"),
    where("assignedWorkerIds", "array-contains", workerId),
    orderBy("createdAt", "desc"),
  );

  const unsubLegacy = onSnapshot(
    legacyQ,
    (snap) => {
      // Wipe and reinsert the legacy slice (handles deletes)
      for (const id of Array.from(merged.keys())) {
        const j = merged.get(id);
        if (j?.assignedWorkerId === workerId
            && !(j.assignedWorkerIds?.includes(workerId))) {
          merged.delete(id);
        }
      }
      snap.docs.map(jobFromDoc).forEach((j) => merged.set(j.id, j));
      legacyReady = true;
      fire();
    },
    (err) => {
      // Don't let one failing query (e.g. a missing index) block the other
      // slice from ever delivering. Mark ready so fire() can proceed.
      console.error("[subscribeMyAssignedJobs] legacy query error", err);
      legacyReady = true;
      fire();
    },
  );

  const unsubCrew = onSnapshot(
    crewQ,
    (snap) => {
    // Wipe and reinsert the crew slice
    for (const id of Array.from(merged.keys())) {
      const j = merged.get(id);
      if (j?.assignedWorkerIds?.includes(workerId)
          && j.assignedWorkerId !== workerId) {
        merged.delete(id);
      }
    }
    snap.docs.map(jobFromDoc).forEach((j) => merged.set(j.id, j));
    crewReady = true;
    fire();
    },
    (err) => {
      console.error("[subscribeMyAssignedJobs] crew query error", err);
      crewReady = true;
      fire();
    },
  );

  return () => {
    unsubLegacy();
    unsubCrew();
  };
}

export function subscribeJob(
  jobId: string,
  cb: (job: Job | null) => void,
): Unsubscribe {
  return onSnapshot(doc(getDb(), "jobs", jobId), (snap) => {
    if (!snap.exists()) cb(null);
    else cb({ id: snap.id, ...(snap.data() as Omit<Job, "id">) });
  });
}

export function subscribeOffersForJob(
  jobId: string,
  cb: (offers: Offer[]) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "jobs", jobId, "offers"),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map(offerFromDoc)));
}

// Subscribe to a single worker's offer on a job (workers can read their own
// offer per Firestore rules; this lets them see "you already offered" state).
export function subscribeMyOfferForJob(
  jobId: string,
  workerId: string,
  cb: (offer: Offer | null) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "jobs", jobId, "offers"),
    where("workerId", "==", workerId),
  );
  return onSnapshot(q, (snap) => {
    if (snap.empty) cb(null);
    else cb(offerFromDoc(snap.docs[0]));
  });
}

// ---------- OFFERS ----------

/** Total completed (confirmed) jobs for a worker — denormalised onto offers
 *  so the employer sees experience at a glance. */
async function countCompletedJobs(workerId: string): Promise<number> {
  try {
    const snap = await getDocs(
      query(
        collection(getDb(), "jobs"),
        where("assignedWorkerId", "==", workerId),
        where("status", "==", "confirmed"),
      ),
    );
    return snap.size;
  } catch {
    return 0;
  }
}

export async function createOffer(input: {
  jobId: string;
  worker: UserProfile;
  price: number;
  message?: string;
}): Promise<string> {
  const now = Date.now();
  const jobsCompleted = await countCompletedJobs(input.worker.uid);
  const ref = await addDoc(
    collection(getDb(), "jobs", input.jobId, "offers"),
    {
      jobId: input.jobId,
      workerId: input.worker.uid,
      workerName: input.worker.displayName,
      workerPhotoURL: input.worker.photoURL ?? null,
      workerRatingAvg: input.worker.ratingAvg ?? null,
      workerRatingCount: input.worker.ratingCount ?? 0,
      workerJobsCompleted: jobsCompleted,
      backgroundVerified: input.worker.backgroundVerified ?? false,
      workerVerified: input.worker.verificationStatus === "approved",
      workerBadges: computeBadges(input.worker).map((b) => b.id),
      price: input.price,
      ...(input.message ? { message: input.message } : {}),
      status: "pending" satisfies OfferStatus,
      createdAt: now,
    },
  );
  // Bump parent job's activity counters + push worker photo into the cap-5
  // social-proof stack. Best-effort — don't fail the offer if this errors.
  try {
    const patch: Record<string, unknown> = {
      lastOfferAt: now,
      offerCount: increment(1),
      updatedAt: now,
    };
    if (input.worker.photoURL) {
      patch.offerWorkerPhotos = arrayUnion(input.worker.photoURL);
    }
    await updateDoc(doc(getDb(), "jobs", input.jobId), patch);
  } catch {
    /* ignore */
  }
  // Enrich the event with the job's category + whether this is an accept (at the
  // asking price) or a counter (a different price). Best-effort read — never fail
  // the offer over analytics.
  const parentJob = await getJob(input.jobId).catch(() => null);
  track("job_offer_sent", {
    job_category: parentJob?.category ?? "unknown",
    offer_type:
      parentJob && input.price !== parentJob.suggestedPrice ? "counter" : "accept",
  });
  return ref.id;
}

export async function listOffersForJob(jobId: string): Promise<Offer[]> {
  const snap = await getDocs(
    query(collection(getDb(), "jobs", jobId, "offers"), orderBy("createdAt", "desc")),
  );
  return snap.docs.map(offerFromDoc);
}

export async function updateOffer(
  jobId: string,
  offerId: string,
  patch: Partial<Offer>,
): Promise<void> {
  await updateDoc(doc(getDb(), "jobs", jobId, "offers", offerId), patch);
}

// ---------- MESSAGES ----------

export async function sendMessage(input: {
  jobId: string;
  sender: UserProfile;
  text: string;
  imageURL?: string;
}): Promise<void> {
  const text = input.text.trim();
  // Allow image-only messages (empty text + an image).
  if (!text && !input.imageURL) return;
  const now = Date.now();
  await addDoc(collection(getDb(), "jobs", input.jobId, "messages"), {
    jobId: input.jobId,
    senderId: input.sender.uid,
    senderName: input.sender.displayName,
    senderPhotoURL: input.sender.photoURL ?? null,
    text,
    ...(input.imageURL ? { imageURL: input.imageURL } : {}),
    createdAt: now,
  });
  try {
    await updateDoc(doc(getDb(), "jobs", input.jobId), {
      lastMessageAt: now,
      messageCount: increment(1),
      updatedAt: now,
    });
  } catch {
    /* ignore */
  }
}

export function subscribeMessages(
  jobId: string,
  cb: (msgs: ChatMessage[]) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "jobs", jobId, "messages"),
    orderBy("createdAt", "asc"),
  );
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChatMessage, "id">) }))),
  );
}

// ---------- LIVE LOCATION ----------

export async function updateWorkerLocation(
  jobId: string,
  lat: number,
  lng: number,
): Promise<void> {
  await updateDoc(doc(getDb(), "jobs", jobId), {
    workerLocation: { lat, lng, updatedAt: Date.now() },
    workerLocationSharing: true,
  });
}

export async function stopSharingLocation(jobId: string): Promise<void> {
  await updateDoc(doc(getDb(), "jobs", jobId), {
    workerLocationSharing: false,
  });
}

// ---------- DISPUTES ----------

export async function raiseDispute(input: {
  job: Job;
  raiser: UserProfile;
  reason: DisputeReason;
  description: string;
}): Promise<void> {
  const role: "employer" | "worker" =
    input.raiser.uid === input.job.employerId ? "employer" : "worker";
  const dispute: Dispute = {
    raisedBy: input.raiser.uid,
    raisedByName: input.raiser.displayName,
    raisedByRole: role,
    reason: input.reason,
    description: input.description.trim(),
    raisedAt: Date.now(),
    previousStatus: input.job.status,
  };
  await updateDoc(doc(getDb(), "jobs", input.job.id), {
    status: "disputed" satisfies JobStatus,
    dispute,
    updatedAt: Date.now(),
  });
}

export async function resolveDispute(
  jobId: string,
  resolution: DisputeResolution,
  resolverNote: string,
  newStatus: JobStatus,
): Promise<void> {
  await updateDoc(doc(getDb(), "jobs", jobId), {
    status: newStatus,
    "dispute.resolution": resolution,
    "dispute.resolverNote": resolverNote,
    "dispute.resolvedAt": Date.now(),
    updatedAt: Date.now(),
  });
}

/** Stream all jobs (admin only). Used by the suburb heatmap. */
export function subscribeAllJobs(cb: (jobs: Job[]) => void): Unsubscribe {
  const q = query(collection(getDb(), "jobs"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map(jobFromDoc)));
}

export function subscribeDisputedJobs(cb: (jobs: Job[]) => void): Unsubscribe {
  const q = query(
    collection(getDb(), "jobs"),
    where("status", "==", "disputed"),
    orderBy("updatedAt", "desc"),
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map(jobFromDoc)));
}

// ---------- EMERGENCY ----------

/**
 * Best-effort GPS for an SOS, with a hard timeout. The SAPS call must NEVER
 * wait on this — the caller races it against a short deadline and proceeds with
 * whatever (if anything) came back.
 */
export function captureLocation(
  timeoutMs = 6000,
): Promise<{ lat: number; lng: number; accuracy?: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      resolve(null);
      return;
    }
    let settled = false;
    const done = (v: { lat: number; lng: number; accuracy?: number } | null) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };
    const t = setTimeout(() => done(null), timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(t);
        done({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
      },
      () => {
        clearTimeout(t);
        done(null);
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: timeoutMs },
    );
  });
}

/**
 * Raise an SOS on an active job. Writes the structured `emergency` record (with
 * any GPS captured at the moment) which the `onJobEmergencyAlert` function turns
 * into a real-time alert to the safety team. Legacy emergencyTriggeredBy/At are
 * kept in lockstep for back-compat.
 */
export async function triggerEmergency(
  jobId: string,
  uid: string,
  opts?: {
    name?: string;
    role?: "employer" | "worker";
    location?: { lat: number; lng: number; accuracy?: number } | null;
  },
): Promise<void> {
  const at = Date.now();
  const emergency: Record<string, unknown> = {
    triggeredBy: uid,
    at,
    status: "active",
    ...(opts?.name ? { triggeredByName: opts.name } : {}),
    ...(opts?.role ? { triggeredByRole: opts.role } : {}),
    ...(opts?.location
      ? {
          lat: opts.location.lat,
          lng: opts.location.lng,
          ...(opts.location.accuracy != null ? { accuracy: opts.location.accuracy } : {}),
        }
      : {}),
  };
  await updateDoc(doc(getDb(), "jobs", jobId), {
    emergency,
    emergencyTriggeredBy: uid,
    emergencyTriggeredAt: at,
  });
  // No location, uid, name or role in the event — POPIA: a bare count only.
  track("sos_triggered");
}

/** Live stream of jobs with an ACTIVE SOS, newest first (admin safety queue). */
export function subscribeActiveEmergencies(cb: (jobs: Job[]) => void): Unsubscribe {
  const q = query(collection(getDb(), "jobs"), where("emergency.status", "==", "active"));
  return onSnapshot(
    q,
    (snap) => {
      const jobs = snap.docs.map((d) => jobFromDoc(d));
      jobs.sort((a, b) => (b.emergency?.at ?? 0) - (a.emergency?.at ?? 0));
      cb(jobs);
    },
    () => cb([]),
  );
}

/** Admin marks an SOS as handled (keeps the record for the safety log). */
export async function resolveEmergency(
  jobId: string,
  adminUid: string,
  adminName: string,
  note?: string,
): Promise<void> {
  await updateDoc(doc(getDb(), "jobs", jobId), {
    "emergency.status": "resolved",
    "emergency.resolvedBy": adminUid,
    "emergency.resolvedByName": adminName,
    "emergency.resolvedAt": Date.now(),
    ...(note ? { "emergency.note": note } : {}),
  });
}

// ---------- HIGH-LEVEL TRANSITIONS ----------

export async function updateJob(jobId: string, patch: Partial<Job>): Promise<void> {
  await updateDoc(doc(getDb(), "jobs", jobId), { ...patch, updatedAt: Date.now() });
}

/**
 * Feature/boost a job to the top of the find-work feed for `days` (default 7).
 * Monetization mechanic — FREE during launch; a paywall wraps the call later.
 * Extends from the current boost end (or now) so re-boosting stacks fairly.
 */
export async function boostJob(jobId: string, days = 7): Promise<void> {
  const job = await getJob(jobId);
  const base = Math.max(Date.now(), job?.boostedUntil ?? 0);
  await updateJob(jobId, { boostedUntil: base + days * 24 * 60 * 60 * 1000 });
  track("job_boosted", { days });
}

/**
 * Accept an offer.
 *
 * - Single-worker job (workersNeeded === 1 or undefined): legacy behaviour —
 *   the accepted worker is set on the top-level fields, the job flips to
 *   "assigned", and every other pending offer is auto-rejected.
 * - Crew job (workersNeeded > 1): the worker is added to the assignedWorkers
 *   array. Other pending offers stay open. The job stays "open" until the
 *   crew is full, at which point we flip to "assigned" AND auto-reject the
 *   remaining pending offers.
 */
export async function acceptOffer(jobId: string, offer: Offer): Promise<void> {
  await updateOffer(jobId, offer.id, { status: "accepted" });

  // Re-read the job to decide single vs crew (avoids races with stale snapshots).
  const job = await getJob(jobId);
  if (!job) throw new Error("Job not found");
  track("job_accepted", { job_category: job.category, is_crew_job: isCrewJob(job) });

  if (!isCrewJob(job)) {
    // Legacy single-worker path. We also write assignedWorkerIds: [uid] so
    // the worker-side subscription + Firestore rules work the same as for
    // crews (single source of truth for "is this worker on this job").
    await updateJob(jobId, {
      status: "assigned",
      assignedWorkerId: offer.workerId,
      assignedWorkerName: offer.workerName,
      ...(offer.workerPhotoURL ? { assignedWorkerPhotoURL: offer.workerPhotoURL } : {}),
      assignedWorkerIds: [offer.workerId],
      agreedPrice: offer.price,
      // First-hire timestamp for the admin time-to-fill metric. Set once.
      ...(job.assignedAt ? {} : { assignedAt: Date.now() }),
      // Safety default: require a doorstep start code. The employer can turn it
      // off on the job if they won't be present (gardening while at work, etc.).
      requireStartPin: true,
    });
    const offers = await listOffersForJob(jobId);
    await Promise.all(
      offers
        .filter((o) => o.id !== offer.id && o.status === "pending")
        .map((o) => updateOffer(jobId, o.id, { status: "rejected" })),
    );
    return;
  }

  // Crew path: append to roster, decide if job is now full.
  const newWorker: AssignedWorker = {
    uid: offer.workerId,
    name: offer.workerName,
    ...(offer.workerPhotoURL ? { photoURL: offer.workerPhotoURL } : {}),
    agreedPrice: offer.price,
    status: "assigned",
    joinedAt: Date.now(),
  };
  const crew = activeCrew(job);
  // Don't double-accept the same worker
  if (crew.some((w) => w.uid === offer.workerId)) return;
  const nextRoster = [...(job.assignedWorkers ?? []), newWorker];
  const filled = nextRoster.filter((w) => w.status !== "removed").length;
  const needed = job.workersNeeded ?? 1;
  const isFull = filled >= needed;

  await updateJob(jobId, {
    status: isFull ? "assigned" : "open",
    assignedWorkers: nextRoster,
    assignedWorkerIds: liveUids(nextRoster),
    // First-hire timestamp for the admin time-to-fill metric. Set once, on the
    // first crew member hired (even if the job isn't full yet).
    ...(job.assignedAt ? {} : { assignedAt: Date.now() }),
    // Safety default (see single-worker path) — a doorstep start code per worker.
    requireStartPin: true,
  });

  if (isFull) {
    const offers = await listOffersForJob(jobId);
    await Promise.all(
      offers
        .filter((o) => o.status === "pending")
        .map((o) => updateOffer(jobId, o.id, { status: "rejected" })),
    );
  }
}

/**
 * A worker (single or crew) leaves a job before they've started.
 *
 * For crew jobs: same as removeWorkerFromCrew — the slot auto-reopens so
 * other workers can fill it.
 * For legacy single-worker jobs: clear the assignedWorker fields, reset to
 * "open" so the employer can pick another offer (or workers can send new ones).
 *
 * Only allowed when the worker's slot status is "assigned" (not yet in
 * progress). Disputes are the right tool after work has started.
 */
export async function leaveJob(jobId: string, workerUid: string): Promise<void> {
  const job = await getJob(jobId);
  if (!job) throw new Error("Job not found");

  if (isCrewJob(job)) {
    const me = (job.assignedWorkers ?? []).find((w) => w.uid === workerUid);
    if (!me) throw new Error("You're not on this job's crew");
    if (me.status !== "assigned") {
      throw new Error(
        "You've already started this job — raise a dispute if you need to step away.",
      );
    }
    await removeWorkerFromCrew(jobId, workerUid);
    return;
  }

  // Legacy single-worker path
  if (job.assignedWorkerId !== workerUid) {
    throw new Error("You're not the assigned worker on this job");
  }
  if (job.status !== "assigned") {
    throw new Error(
      "You've already started this job — raise a dispute if you need to step away.",
    );
  }
  // Firestore won't strip fields when you assign `undefined` — use deleteField()
  // for the optional ones, and an empty array for the denormalised list.
  await updateDoc(doc(getDb(), "jobs", jobId), {
    status: "open",
    assignedWorkerId: deleteField(),
    assignedWorkerName: deleteField(),
    assignedWorkerPhotoURL: deleteField(),
    assignedWorkerIds: [],
    agreedPrice: deleteField(),
    updatedAt: Date.now(),
  });
}

/**
 * Remove a worker from a crew job. The slot auto-reopens — the job flips back
 * to "open" so other workers can offer. If the employer would rather just run
 * with fewer people, they can call setCrewSize() afterward to close the gap.
 */
export async function removeWorkerFromCrew(jobId: string, workerUid: string): Promise<void> {
  const job = await getJob(jobId);
  if (!job || !isCrewJob(job)) throw new Error("Not a crew job");
  const next = (job.assignedWorkers ?? []).map((w) =>
    w.uid === workerUid && w.status !== "removed"
      ? { ...w, status: "removed" as const, removedAt: Date.now() }
      : w,
  );
  const filled = next.filter((w) => w.status !== "removed").length;
  const needed = job.workersNeeded ?? 1;
  // Re-open so other workers can fill the gap; preserves disputed/cancelled.
  const nextStatus: JobStatus =
    job.status === "disputed" || job.status === "cancelled"
      ? job.status
      : filled < needed
        ? "open"
        : deriveCrewStatus(next);
  await updateJob(jobId, {
    assignedWorkers: next,
    assignedWorkerIds: liveUids(next),
    status: nextStatus,
  });
}

/**
 * Lower (or raise) how many workers a crew job needs. Employer-only.
 * Raising re-opens the job; lowering below the current accepted count is rejected.
 */
export async function setCrewSize(jobId: string, newSize: number): Promise<void> {
  if (!Number.isFinite(newSize) || newSize < 1) throw new Error("Crew size must be >= 1");
  const job = await getJob(jobId);
  if (!job) throw new Error("Job not found");
  const currentFilled = activeCrew(job).length;
  if (newSize < currentFilled) {
    throw new Error(
      `You've already accepted ${currentFilled} workers — remove one first before lowering the crew size below that.`,
    );
  }
  const patch: Partial<Job> = { workersNeeded: newSize };
  // If lowering to current filled count, close intake. If raising, reopen.
  if (newSize === currentFilled && currentFilled > 0) {
    patch.status = deriveCrewStatus(job.assignedWorkers ?? []);
  } else if (newSize > currentFilled && job.status === "assigned") {
    patch.status = "open";
  }
  await updateJob(jobId, patch);
}

/** Denormalised list of active (non-removed) UIDs — used by Firestore rules. */
function liveUids(roster: AssignedWorker[]): string[] {
  return roster.filter((w) => w.status !== "removed").map((w) => w.uid);
}

/**
 * Compute the top-level job status from the crew roster.
 * Used after per-worker mark/confirm so the job header reflects reality.
 */
function deriveCrewStatus(roster: AssignedWorker[]): JobStatus {
  const live = roster.filter((w) => w.status !== "removed");
  if (live.length === 0) return "open";
  if (live.every((w) => w.status === "confirmed")) return "confirmed";
  if (live.every((w) => w.status === "completed" || w.status === "confirmed")) return "completed";
  if (live.some((w) => w.status === "in_progress")) return "in_progress";
  return "assigned";
}

/**
 * Worker taps "I'm on my way". Records enRouteAt but keeps the slot/job in
 * "assigned" — the job only moves to "in_progress" when they tap "Start".
 */
export async function markEnRoute(jobId: string, workerUid?: string) {
  const job = await getJob(jobId);
  if (!job) throw new Error("Job not found");
  const now = Date.now();
  if (!isCrewJob(job)) {
    await updateJob(jobId, { enRouteAt: now });
    return;
  }
  if (!workerUid) throw new Error("workerUid required for crew jobs");
  const next = (job.assignedWorkers ?? []).map((w) =>
    w.uid === workerUid ? { ...w, enRouteAt: now } : w,
  );
  await updateJob(jobId, { assignedWorkers: next, assignedWorkerIds: liveUids(next) });
}

export async function markInProgress(jobId: string, workerUid?: string) {
  const job = await getJob(jobId);
  if (!job) throw new Error("Job not found");
  track("job_started", { job_category: job.category });
  if (!isCrewJob(job)) {
    await updateJob(jobId, { status: "in_progress" });
    return;
  }
  if (!workerUid) throw new Error("workerUid required for crew jobs");
  const next = (job.assignedWorkers ?? []).map((w) =>
    w.uid === workerUid ? { ...w, status: "in_progress" as const } : w,
  );
  await updateJob(jobId, { assignedWorkers: next, assignedWorkerIds: liveUids(next), status: deriveCrewStatus(next) });
}

export async function markCompletedByWorker(jobId: string, workerUid?: string) {
  const job = await getJob(jobId);
  if (!job) throw new Error("Job not found");
  track("job_completed", {
    job_category: job.category,
    value: job.agreedPrice ?? job.suggestedPrice,
    currency: "ZAR",
  });
  if (!isCrewJob(job)) {
    await updateJob(jobId, { status: "completed", completedAt: Date.now() });
    return;
  }
  if (!workerUid) throw new Error("workerUid required for crew jobs");
  const now = Date.now();
  const next = (job.assignedWorkers ?? []).map((w) =>
    w.uid === workerUid ? { ...w, status: "completed" as const, completedAt: now } : w,
  );
  const newStatus = deriveCrewStatus(next);
  await updateJob(jobId, {
    assignedWorkers: next,
    assignedWorkerIds: liveUids(next),
    status: newStatus,
    ...(newStatus === "completed" ? { completedAt: now } : {}),
  });
}

export async function confirmCompletionByEmployer(jobId: string, workerUid?: string) {
  const job = await getJob(jobId);
  if (!job) throw new Error("Job not found");
  track("job_confirmed", { price: job.agreedPrice ?? job.suggestedPrice });
  if (!isCrewJob(job)) {
    await updateJob(jobId, { status: "confirmed" });
    return;
  }
  if (!workerUid) throw new Error("workerUid required for crew jobs");
  const now = Date.now();
  const next = (job.assignedWorkers ?? []).map((w) =>
    w.uid === workerUid ? { ...w, status: "confirmed" as const, confirmedAt: now } : w,
  );
  await updateJob(jobId, { assignedWorkers: next, assignedWorkerIds: liveUids(next), status: deriveCrewStatus(next) });
}

/**
 * Submit a rating through the server (the `submitRating` callable).
 *
 * Ratings are NEVER written from the client any more — the callable verifies
 * the caller's role from their auth token (employer ⇄ worker), checks the work
 * is confirmed, and writes the rating + the reputation aggregate atomically.
 * This is what stops a worker self-authoring their own 5-star review.
 *
 * `workerUid` is only needed when an employer rates a specific member of a crew;
 * for everyone else the callable infers the target from the caller.
 */
export async function submitRating(
  jobId: string,
  stars: number,
  text?: string,
  workerUid?: string,
  raterType?: "customer" | "worker",
): Promise<void> {
  const fn = httpsCallable<
    { jobId: string; stars: number; text?: string; workerUid?: string },
    { ok: boolean }
  >(getFunctionsInstance(), "submitRating");
  await fn({
    jobId,
    stars,
    ...(text ? { text } : {}),
    ...(workerUid ? { workerUid } : {}),
  });
  // raterType tells us the direction (customer→worker or worker→customer). It's
  // passed by the form that knows the caller's side; fall back to "customer".
  track("rating_submitted", { rater_type: raterType ?? "customer", rating: stars });
}

/**
 * Record the caller's half of the payment handshake on a confirmed job —
 * employer's "I've paid" or worker's "payment received". Server-authored
 * (confirmPayment callable): the second tap completes the handshake and bumps
 * both sides' payment tallies. Crew jobs: the employer names the slot.
 */
export async function confirmPayment(jobId: string, workerUid?: string): Promise<void> {
  const fn = httpsCallable<{ jobId: string; workerUid?: string }, { ok: boolean }>(
    getFunctionsInstance(),
    "confirmPayment",
  );
  await fn({ jobId, ...(workerUid ? { workerUid } : {}) });
  track("payment_confirmed_tap");
}
