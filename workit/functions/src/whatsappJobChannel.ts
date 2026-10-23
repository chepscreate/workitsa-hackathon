/**
 * WhatsApp Job Channel — low-data access to work over WhatsApp.
 *
 * Runs on the SAME Meta app / number as Jarvis + support (Meta allows only one
 * webhook callback URL per number, and that URL already points at jarvisWhatsApp).
 * So instead of a second webhook we expose `handleWhatsAppJobReply`, which
 * jarvisWhatsApp calls from its non-owner branch BEFORE the support fallback:
 *   - a known opted-in worker sending a job command → handled here
 *   - anyone/anything else → returns false, Jarvis routes it to support unchanged
 * The owner → Jarvis path and the public → support path are never touched.
 *
 * Two halves:
 *   1. onJobVisibleWhatsAppAlert — Firestore trigger. When a job becomes
 *      publicly visible, alert opted-in, verified, matching workers (same
 *      category + area logic as jobAlerts.ts). Delivery:
 *        - worker messaged us in the last 24h (open session) → FREE-TEXT alert
 *          with full job detail (no template needed, free)
 *        - otherwise (cold) → the approved `job_alert` TEMPLATE
 *      So the demo works even before the template is approved, as long as the
 *      worker has texted the number once.
 *   2. handleWhatsAppJobReply — maps a worker's message:
 *        "JOBS" / "WORK"        → list open jobs near them, numbered 1..5
 *        a number "1".."5"      → offer on that listed job
 *        "1" / "ACCEPT"         → offer on the last single job we alerted them
 *        "START"                → mark their assigned job in_progress
 *        "DONE"                 → mark their assigned job completed
 *        "STOP"                 → opt out of WhatsApp job alerts
 *      Any inbound from a known worker opens their 24h free-text window.
 *      Mutating replies are idempotent on message ID (waJobInbox/{id}).
 *
 * Analytics: a WhatsApp offer writes a normal offer, START/DONE patch the job
 * exactly like the in-app flow — so onOfferCreatedPush / email / rating counters
 * and the funnel fire through the normal path. Offers carry source:"whatsapp".
 *
 * POPIA: messages carry only job title, category, suburb/city and budget — never
 * ID numbers, exact addresses or customer phone numbers.
 */
import { onDocumentWritten, onDocumentUpdated, onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { upsertWorkRecord } from "./workRecord";

// Shared with jarvisWhatsApp — defineSecret is keyed by name, so these resolve
// to the same secrets/number Jarvis already uses.
const WHATSAPP_TOKEN = defineSecret("WHATSAPP_TOKEN");
const WHATSAPP_PHONE_NUMBER_ID = defineSecret("WHATSAPP_PHONE_NUMBER_ID");

const GRAPH_VERSION = "v21.0";
/** Approved template name (see the ops doc for the exact submitted copy). */
const JOB_ALERT_TEMPLATE = "job_alert";
/** Cold "new offer" notice to an employer. ⚠ Submit + get approved before cold
 *  sends work; in-window (employer texted us in 24h) uses free text instead. */
const OFFER_RECEIVED_TEMPLATE = "offer_received";
const TEMPLATE_LANG = "en";

// --- Matching (mirrors jobAlerts.ts) ---
const RADIUS_KM = 25;
const MAX_RECIPIENTS = 50;
const ALERT_SETTLE_MS = 45_000;
/** WhatsApp "customer service window": a business may send free-form text for
 *  24h after the user's last inbound message. Outside it, templates only. */
const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;
/** How many jobs a "JOBS" pull lists. */
const JOBS_LIST_LIMIT = 5;

const ACCEPT = /^(?:accept|yes|y|yebo|ok|okay)\b/i;
const START = /^(?:start|started|on site|onsite)\b/i;
const DONE = /^(?:done|finished|finish|complete|completed)\b/i;
const STOP = /^(?:stop|cancel|unsubscribe|opt ?out)\b/i;
const JOBS = /^(?:jobs|work|list)\b/i;
const AVAILABLE = /^(?:available|avail|ready|online|i'?m available)\b/i;
const SOS = /^(?:sos|help\s*me|emergency|danger|unsafe|i'?m (?:not safe|in danger))\b/i;
const REPORT = /^report\b/i;
/** OFFER 400 / OFFER R400 / OFFER "400" → counter at a custom price.
 *  Separator class tolerates spaces, straight and curly quotes (phones add them). */
const OFFER = /^offer[\s"'“”‘’]+(?:r\s*)?(\d{2,6})\b/i;
/** A bare "1", or "1 400" / 1 "400" → pick job #1 (optionally counter R400). */
const NUMBER = /^([1-9])(?:[\s"'“”‘’]+(?:r\s*)?(\d{2,6}))?\b/i;

// --- Employer-side commands (accept/decline offers over WhatsApp) ---
/** List the employer's pending offers. */
const OFFERS = /^(?:offers?|my offers?|pending)\b/i;
/** ACCEPT / ACCEPT 1 / HIRE 1 → hire offer #n (or the only pending one).
 *  Explicit word required — a stray "ok"/"yes" must never hire by accident. */
const EMP_ACCEPT = /^(?:accept|hire)\b\s*(\d+)?/i;
/** DECLINE / DECLINE 1 / REJECT 2 / PASS → decline offer #n (or the only one). */
const EMP_DECLINE = /^(?:decline|reject|deny|pass)\b\s*(\d+)?/i;
/** HELP / MENU / a greeting → show the role-aware list of commands, so someone
 *  who doesn't know what to text sees their options. SOS's "help me" is matched
 *  earlier in the worker flow, so safety still wins. */
const MENU = /^(?:menu|help|options|commands|hi+|hey+|hello+|howzit)\b/i;

const isEmployerSideRole = (r?: string) => r === "employer" || r === "business";

const isJobKeyword = (t: string) =>
  ACCEPT.test(t) || START.test(t) || DONE.test(t) || STOP.test(t) || JOBS.test(t)
  || AVAILABLE.test(t) || SOS.test(t) || REPORT.test(t) || OFFER.test(t) || NUMBER.test(t)
  || OFFERS.test(t) || EMP_DECLINE.test(t) || MENU.test(t);

type JobDoc = {
  title?: string;
  status?: string;
  moderationStatus?: string;
  employerId?: string;
  employerName?: string;
  category?: string;
  suggestedPrice?: number;
  agreedPrice?: number;
  suburb?: string;
  city?: string;
  province?: string;
  lat?: number;
  lng?: number;
  urgent?: boolean;
  assignedWorkerId?: string;
  assignedWorkerIds?: string[];
};

const APP_URL = "https://workitsa.co.za";

type WorkerDoc = {
  uid: string;
  role?: string;
  accountStatus?: string;
  displayName?: string;
  photoURL?: string | null;
  ratingAvg?: number;
  ratingCount?: number;
  backgroundVerified?: boolean;
  verificationStatus?: string;
  categories?: string[];
  approxLat?: number;
  approxLng?: number;
  city?: string;
  province?: string;
  blockedUserIds?: string[];
  whatsappJobOptIn?: boolean;
  whatsappNumber?: string;
};

type ThreadDoc = {
  workerUid?: string;
  lastJobId?: string;
  lastJobTitle?: string;
  lastInboundAt?: number;
  lastList?: string[];
  /** Employer's last numbered offers list (for ACCEPT n / DECLINE n). */
  empOfferList?: Array<{ jobId: string; offerId: string }>;
};

const onlyDigits = (s: string) => (s ?? "").replace(/\D/g, "");

/** Normalise any SA number to WhatsApp digits form (27XXXXXXXXX). */
function toWa(raw: string | undefined): string {
  const d = onlyDigits(raw ?? "");
  if (!d) return "";
  if (d.startsWith("27")) return d;
  if (d.startsWith("0")) return "27" + d.slice(1);
  if (d.length === 9) return "27" + d;
  return d;
}

const norm = (s?: string) => (s ?? "").trim().toLowerCase();
const where = (j: JobDoc) => [j.suburb, j.city].filter(Boolean).join(", ") || j.province || "nearby";

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const isVisible = (j: JobDoc | undefined | null): boolean =>
  !!j && j.status === "open" && !j.moderationStatus;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- Meta Cloud API send (production number, shared with Jarvis) ----------

async function metaSend(payload: Record<string, unknown>): Promise<void> {
  const phoneId = WHATSAPP_PHONE_NUMBER_ID.value();
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN.value()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
  });
  if (!res.ok) {
    logger.error("wa job: send failed", { status: res.status, body: await res.text() });
  }
}

/** Free-form text — only valid inside the 24h session window. */
const sendText = (to: string, body: string) =>
  metaSend({ to, type: "text", text: { body: body.slice(0, 4096) } });

/** Business-initiated template send (cold job alert). `params` fills {{1}}..{{3}}. */
const sendTemplate = (to: string, name: string, params: string[]) =>
  metaSend({
    to,
    type: "template",
    template: {
      name,
      language: { code: TEMPLATE_LANG },
      components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }],
    },
  });

/** Copy of the job_alert body for the free-text (in-window) path. */
const alertText = (title: string, area: string, price: string) =>
  `🛠️ New job near you on Workit: *${title}* in ${area} — pay ${price}.\n`
  + "Reply *1* to send an offer, *HELP* for options, or *STOP* to opt out.";

/** What a worker can text — shown on HELP / MENU / a greeting. */
const WORKER_MENU =
  "👋 *Here's what you can text me:*\n\n"
  + "• *JOBS* — see open jobs near you\n"
  + "• a number like *1* — offer on that job (or *1 400* to name your price)\n"
  + "• *AVAILABLE* — show you're available now\n"
  + "• *START* / *DONE* — when you begin / finish a job\n"
  + "• *REPORT …* — tell us about a problem\n"
  + "• *SOS* — emergency, we alert our safety team\n"
  + "• *STOP* — stop job alerts";

/** What an employer can text — shown on HELP / MENU / a greeting. */
const EMPLOYER_MENU =
  "👋 *Here's what you can text me:*\n\n"
  + "• *OFFERS* — see the offers on your jobs\n"
  + "• *ACCEPT 1* — hire the worker in offer #1\n"
  + "• *DECLINE 1* — pass on offer #1\n"
  + "• *STOP* — stop WhatsApp alerts";

// =====================================================================
// 1) Outbound: alert opted-in workers when a job becomes visible
// =====================================================================

export const onJobVisibleWhatsAppAlert = onDocumentWritten(
  {
    document: "jobs/{jobId}",
    secrets: [WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID],
    timeoutSeconds: 120,
  },
  async (event) => {
    const jobId = event.params.jobId;
    const before = event.data?.before.exists ? (event.data.before.data() as JobDoc) : null;
    let after = event.data?.after.exists ? (event.data.after.data() as JobDoc) : null;

    if (!isVisible(after) || isVisible(before)) return;

    const db = getFirestore();

    if (!before) {
      await sleep(ALERT_SETTLE_MS);
      const snap = await db.doc(`jobs/${jobId}`).get();
      after = snap.exists ? (snap.data() as JobDoc) : null;
      if (!isVisible(after)) return;
    }

    const job = after!;
    if (!job.employerId) return;

    const [workersSnap, employerSnap] = await Promise.all([
      db.collection("users").where("role", "==", "worker").get(),
      db.doc(`users/${job.employerId}`).get(),
    ]);
    const employerBlocked: string[] = (employerSnap.data()?.blockedUserIds as string[]) ?? [];

    const jobCity = norm(job.city);
    const jobProvince = norm(job.province);
    const hasCoords = typeof job.lat === "number" && typeof job.lng === "number";

    const recipients: Array<{ wa: string; uid: string; distanceKm: number | null }> = [];
    workersSnap.forEach((d) => {
      const w = { ...(d.data() as WorkerDoc), uid: d.id };
      if (!w.whatsappJobOptIn) return;
      const wa = toWa(w.whatsappNumber);
      if (!wa) return;
      if ((w.accountStatus ?? "approved") !== "approved") return;
      if (w.uid === job.employerId) return;
      if (employerBlocked.includes(w.uid)) return;
      if ((w.blockedUserIds ?? []).includes(job.employerId!)) return;
      if (w.categories && w.categories.length > 0 && job.category && !w.categories.includes(job.category)) return;

      const workerHasCoords = typeof w.approxLat === "number" && typeof w.approxLng === "number";
      if (hasCoords && workerHasCoords) {
        const km = haversineKm(job.lat!, job.lng!, w.approxLat!, w.approxLng!);
        if (km <= RADIUS_KM) recipients.push({ wa, uid: w.uid, distanceKm: km });
        return;
      }
      if (jobCity && norm(w.city) === jobCity) {
        recipients.push({ wa, uid: w.uid, distanceKm: null });
        return;
      }
      if (!workerHasCoords && !norm(w.city) && jobProvince && norm(w.province) === jobProvince) {
        recipients.push({ wa, uid: w.uid, distanceKm: null });
      }
    });

    recipients.sort((a, b) => (a.distanceKm ?? RADIUS_KM + 1) - (b.distanceKm ?? RADIUS_KM + 1));
    const chosen = recipients.slice(0, MAX_RECIPIENTS);
    if (chosen.length === 0) {
      logger.info("wa job: no opted-in matching workers", { jobId });
      return;
    }

    const area = where(job);
    const price = `R${job.suggestedPrice ?? "—"}`;
    const title = (job.title ?? "A job").slice(0, 60);

    const now = Date.now();
    let freeText = 0;
    let template = 0;
    const results = await Promise.allSettled(
      chosen.map(async (r) => {
        // In-window workers get a free-text alert (full detail, no template);
        // cold workers get the approved template.
        const threadSnap = await db.doc(`waJobThreads/${r.wa}`).get();
        const lastInboundAt = Number((threadSnap.data() as ThreadDoc | undefined)?.lastInboundAt ?? 0);
        const inWindow = now - lastInboundAt < SESSION_WINDOW_MS;
        if (inWindow) {
          await sendText(r.wa, alertText(title, area, price));
          freeText++;
        } else {
          await sendTemplate(r.wa, JOB_ALERT_TEMPLATE, [title, area, price]);
          template++;
        }
        await db.doc(`waJobThreads/${r.wa}`).set(
          { workerUid: r.uid, lastJobId: jobId, lastJobTitle: title, lastJobPrice: job.suggestedPrice ?? null, lastJobAt: now },
          { merge: true },
        );
      }),
    );
    const failed = results.filter((x) => x.status === "rejected").length;
    logger.info("wa job: dispatched alert", { jobId, sent: chosen.length, freeText, template, failed });
  },
);

// =====================================================================
// 2) Inbound: handle a worker's message (called by jarvisWhatsApp)
// =====================================================================

async function createWhatsAppOffer(
  jobId: string,
  worker: WorkerDoc,
  priceOverride?: number,
): Promise<"ok" | "gone" | "dupe"> {
  const db = getFirestore();
  const jobSnap = await db.doc(`jobs/${jobId}`).get();
  const job = jobSnap.exists ? (jobSnap.data() as JobDoc) : null;
  if (!isVisible(job)) return "gone";

  const existing = await db
    .collection(`jobs/${jobId}/offers`)
    .where("workerId", "==", worker.uid)
    .where("status", "==", "pending")
    .limit(1)
    .get();
  if (!existing.empty) return "dupe";

  const counter = typeof priceOverride === "number" && priceOverride > 0;
  const now = Date.now();
  await db.collection(`jobs/${jobId}/offers`).add({
    jobId,
    workerId: worker.uid,
    workerName: worker.displayName ?? "A worker",
    workerPhotoURL: worker.photoURL ?? null,
    workerRatingAvg: worker.ratingAvg ?? null,
    workerRatingCount: worker.ratingCount ?? 0,
    backgroundVerified: worker.backgroundVerified ?? false,
    workerVerified: worker.verificationStatus === "approved",
    price: counter ? priceOverride : (job!.suggestedPrice ?? 0),
    message: counter ? `Counter-offer via WhatsApp (R${priceOverride})` : "Accepted via WhatsApp",
    status: "pending",
    source: "whatsapp",
    createdAt: now,
  });
  await db.doc(`jobs/${jobId}`).set(
    { lastOfferAt: now, offerCount: FieldValue.increment(1), updatedAt: now },
    { merge: true },
  );
  return "ok";
}

async function findAssignedJob(workerUid: string, wantStatuses: string[]): Promise<{ id: string; job: JobDoc } | null> {
  const db = getFirestore();
  const snap = await db.collection("jobs").where("assignedWorkerId", "==", workerUid).get();
  let pick: { id: string; job: JobDoc } | null = null;
  snap.forEach((d) => {
    const j = d.data() as JobDoc;
    if (wantStatuses.includes(j.status ?? "")) pick = { id: d.id, job: j };
  });
  return pick;
}

/** Open jobs that match a worker (reverse of the alert matching), nearest first. */
async function openJobsForWorker(worker: WorkerDoc): Promise<Array<{ id: string; job: JobDoc }>> {
  const db = getFirestore();
  const snap = await db.collection("jobs").where("status", "==", "open").get();
  const wHasCoords = typeof worker.approxLat === "number" && typeof worker.approxLng === "number";
  const wCity = norm(worker.city);
  const wProv = norm(worker.province);
  const out: Array<{ id: string; job: JobDoc; d: number | null }> = [];
  snap.forEach((doc) => {
    const j = doc.data() as JobDoc;
    if (j.moderationStatus) return;
    if (j.employerId === worker.uid) return;
    if (worker.categories && worker.categories.length > 0 && j.category && !worker.categories.includes(j.category)) return;
    const jHas = typeof j.lat === "number" && typeof j.lng === "number";
    if (wHasCoords && jHas) {
      const km = haversineKm(worker.approxLat!, worker.approxLng!, j.lat!, j.lng!);
      if (km <= RADIUS_KM) out.push({ id: doc.id, job: j, d: km });
      return;
    }
    if (wCity && norm(j.city) === wCity) {
      out.push({ id: doc.id, job: j, d: null });
      return;
    }
    if (!jHas && wProv && norm(j.province) === wProv) out.push({ id: doc.id, job: j, d: null });
  });
  out.sort((a, b) => (a.d ?? RADIUS_KM + 1) - (b.d ?? RADIUS_KM + 1));
  return out.slice(0, JOBS_LIST_LIMIT).map(({ id, job }) => ({ id, job }));
}

async function lookupWorkerByWa(wa: string): Promise<WorkerDoc | null> {
  const db = getFirestore();
  const snap = await db.collection("users").where("whatsappNumber", "==", wa).limit(1).get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { ...(d.data() as WorkerDoc), uid: d.id };
}

// ---------- Employer side: accept / decline offers over WhatsApp ----------

type OfferFull = {
  status?: string;
  workerId?: string;
  workerName?: string;
  workerPhotoURL?: string | null;
  price?: number;
  createdAt?: number;
};

/** Pending offers across an employer's still-open jobs, oldest first. */
async function listEmployerPendingOffers(
  employerUid: string,
): Promise<Array<{ jobId: string; offerId: string; title: string; workerName: string; price: number }>> {
  const db = getFirestore();
  const jobsSnap = await db.collection("jobs").where("employerId", "==", employerUid).get();
  const out: Array<{ jobId: string; offerId: string; title: string; workerName: string; price: number; at: number }> = [];
  await Promise.all(
    jobsSnap.docs.map(async (jd) => {
      const j = jd.data() as JobDoc;
      if (j.status !== "open") return; // only jobs that can still be filled
      const offersSnap = await db.collection(`jobs/${jd.id}/offers`).where("status", "==", "pending").get();
      offersSnap.forEach((od) => {
        const o = od.data() as OfferFull;
        out.push({
          jobId: jd.id,
          offerId: od.id,
          title: j.title ?? "Job",
          workerName: o.workerName ?? "A worker",
          price: typeof o.price === "number" ? o.price : (j.suggestedPrice ?? 0),
          at: Number(o.createdAt ?? 0),
        });
      });
    }),
  );
  out.sort((a, b) => a.at - b.at);
  return out.slice(0, 9).map(({ at, ...rest }) => { void at; return rest; });
}

/**
 * Accept an offer server-side — mirrors the single-worker path of
 * lib/jobs.ts acceptOffer: flip the offer to accepted, assign the job, and
 * auto-reject the other pending offers. Setting offer.status fires the existing
 * onOfferResolvedWhatsApp (worker gets WhatsApp'd) + onOfferAccepted email/push.
 * Crew jobs (workersNeeded > 1) are deferred to the app.
 */
async function acceptOfferServer(jobId: string, offerId: string): Promise<"ok" | "gone" | "crew"> {
  const db = getFirestore();
  const jobRef = db.doc(`jobs/${jobId}`);
  const jobSnap = await jobRef.get();
  const job = jobSnap.exists ? (jobSnap.data() as JobDoc & { workersNeeded?: number; assignedAt?: number }) : null;
  if (!job || job.status !== "open") return "gone";
  if ((job.workersNeeded ?? 1) > 1) return "crew";

  const offerRef = db.doc(`jobs/${jobId}/offers/${offerId}`);
  const offerSnap = await offerRef.get();
  const offer = offerSnap.exists ? (offerSnap.data() as OfferFull) : null;
  if (!offer || offer.status !== "pending" || !offer.workerId) return "gone";

  const now = Date.now();
  await offerRef.set({ status: "accepted" }, { merge: true });
  await jobRef.set(
    {
      status: "assigned",
      assignedWorkerId: offer.workerId,
      assignedWorkerName: offer.workerName ?? "A worker",
      ...(offer.workerPhotoURL ? { assignedWorkerPhotoURL: offer.workerPhotoURL } : {}),
      assignedWorkerIds: [offer.workerId],
      agreedPrice: typeof offer.price === "number" ? offer.price : (job.suggestedPrice ?? 0),
      ...(job.assignedAt ? {} : { assignedAt: now }),
      // Safety default (matches the in-app accept): doorstep start code on.
      requireStartPin: true,
      updatedAt: now,
    },
    { merge: true },
  );
  // Auto-reject the remaining pending offers (each fires the worker's notice).
  const others = await db.collection(`jobs/${jobId}/offers`).where("status", "==", "pending").get();
  await Promise.all(
    others.docs.filter((d) => d.id !== offerId).map((d) => d.ref.set({ status: "rejected" }, { merge: true })),
  );
  return "ok";
}

/**
 * Handle an employer's WhatsApp message: OFFERS (list), ACCEPT n (hire),
 * DECLINE n (pass). Returns true if handled, false to fall through to support.
 */
async function handleEmployerReply(args: {
  fromRaw: string;
  text: string;
  employer: WorkerDoc;
  threadRef: FirebaseFirestore.DocumentReference;
  send: (to: string, body: string) => Promise<void>;
}): Promise<boolean> {
  const { fromRaw, text, employer, threadRef, send } = args;
  const db = getFirestore();

  // --- HELP / MENU: show the employer what they can text ---
  if (MENU.test(text)) {
    await send(fromRaw, EMPLOYER_MENU);
    return true;
  }

  // --- OFFERS: list pending offers, numbered, and remember the list ---
  if (OFFERS.test(text)) {
    const list = await listEmployerPendingOffers(employer.uid);
    if (list.length === 0) {
      await send(fromRaw, "You have no pending offers right now. We'll WhatsApp you the moment a worker makes one. 👍");
      return true;
    }
    const lines = list.map((x, i) => `*${i + 1}.* ${x.workerName} — *R${x.price}* — "${x.title.slice(0, 40)}"`);
    await threadRef.set(
      { empOfferList: list.map((x) => ({ jobId: x.jobId, offerId: x.offerId })), empOfferListAt: Date.now() },
      { merge: true },
    );
    await send(
      fromRaw,
      `📋 *Your pending offers:*\n\n${lines.join("\n")}\n\nReply *ACCEPT 1* to hire, or *DECLINE 1* to pass.`,
    );
    return true;
  }

  // --- ACCEPT n / DECLINE n (bare ACCEPT/DECLINE work when there's one offer) ---
  const am = text.match(EMP_ACCEPT);
  const dm = text.match(EMP_DECLINE);
  if (am || dm) {
    const isAccept = !!am;
    const numStr = am?.[1] ?? dm?.[1];

    // Prefer the remembered list; otherwise fetch a fresh one.
    const thread = (await threadRef.get()).data() as ThreadDoc | undefined;
    let list = Array.isArray(thread?.empOfferList) ? thread!.empOfferList! : [];
    if (list.length === 0) {
      const fresh = await listEmployerPendingOffers(employer.uid);
      list = fresh.map((x) => ({ jobId: x.jobId, offerId: x.offerId }));
      await threadRef.set({ empOfferList: list, empOfferListAt: Date.now() }, { merge: true });
    }
    if (list.length === 0) {
      await send(fromRaw, "You have no pending offers to act on right now. Text *OFFERS* to check.");
      return true;
    }
    const idx = numStr ? parseInt(numStr, 10) - 1 : list.length === 1 ? 0 : -1;
    if (idx < 0 || idx >= list.length) {
      await send(
        fromRaw,
        `Reply *${isAccept ? "ACCEPT" : "DECLINE"} 1* with the number from your offers list. Text *OFFERS* to see it.`,
      );
      return true;
    }
    const pick = list[idx];

    if (isAccept) {
      const outcome = await acceptOfferServer(pick.jobId, pick.offerId);
      await send(
        fromRaw,
        outcome === "ok"
          ? "✅ *Hired!* The worker has been notified on WhatsApp and the job is now assigned. Other offers on it were declined automatically."
          : outcome === "crew"
            ? "This is a multi-worker (crew) job — please accept crew offers in the app so you can manage the whole team."
            : "That offer is no longer available (the job may have just been filled or closed). Text *OFFERS* to see what's still open.",
      );
    } else {
      const offerRef = db.doc(`jobs/${pick.jobId}/offers/${pick.offerId}`);
      const os = await offerRef.get();
      if (os.exists && (os.data() as OfferFull).status === "pending") {
        await offerRef.set({ status: "rejected" }, { merge: true });
        await send(fromRaw, "👍 Offer declined — the worker has been let know. Text *OFFERS* to review the rest.");
      } else {
        await send(fromRaw, "That offer isn't pending anymore. Text *OFFERS* to see your current offers.");
      }
    }
    return true;
  }

  return false; // not an employer command → let support handle it
}

// =====================================================================
// 2b) WhatsApp-only onboarding — a jobseeker with no app registers as a
//     worker over WhatsApp and immediately starts receiving job alerts.
// =====================================================================

/** A stranger's opening message that starts onboarding. Anything else from an
 *  unknown number falls through to the public support handler. */
const JOIN = /^(?:hi+|hello+|hey+|howzit|molo|sawubona|yebo|work|join|jobs?|start|register|sign\s*up|looking for work|i want work)\b/i;

/** Work types offered during onboarding → canonical category ids
 *  (src/lib/types.ts CATEGORIES). A short, youth-friendly subset. */
const ONB_CATS: Array<[string, string]> = [
  ["home-garden", "Home & garden (cleaning, gardening)"],
  ["trades", "Trades (plumbing, electrical, painting)"],
  ["driving-delivery", "Driving & delivery"],
  ["moving-errands", "Moving & errands"],
  ["care", "Childcare & elderly care"],
  ["beauty-wellness", "Beauty & wellness"],
  ["events-catering", "Events & catering"],
  ["tutoring-education", "Tutoring & lessons"],
  ["construction-labour", "Construction & general labour"],
];

const CATS_PROMPT =
  "What kind of work do you do? Reply with the *number(s)* that apply (e.g. *1 3*):\n\n"
  + ONB_CATS.map((c, i) => `*${i + 1}.* ${c[1]}`).join("\n");

/** Approx coordinates for common Gauteng areas, so an onboarded worker is
 *  distance-matched like any other. Unknown areas fall back to city/province. */
const GAUTENG_COORDS: Record<string, { lat: number; lng: number }> = {
  alberton: { lat: -26.2672, lng: 28.1221 },
  johannesburg: { lat: -26.2041, lng: 28.0473 },
  joburg: { lat: -26.2041, lng: 28.0473 },
  jhb: { lat: -26.2041, lng: 28.0473 },
  soweto: { lat: -26.2678, lng: 27.8585 },
  sandton: { lat: -26.1076, lng: 28.0567 },
  pretoria: { lat: -25.7479, lng: 28.2293 },
  centurion: { lat: -25.8603, lng: 28.1894 },
  midrand: { lat: -25.9992, lng: 28.1263 },
  benoni: { lat: -26.1885, lng: 28.3207 },
  boksburg: { lat: -26.2121, lng: 28.262 },
  germiston: { lat: -26.2178, lng: 28.1699 },
  randburg: { lat: -26.0936, lng: 27.9947 },
  roodepoort: { lat: -26.1625, lng: 27.8725 },
  vereeniging: { lat: -26.6731, lng: 27.9261 },
  vanderbijlpark: { lat: -26.7, lng: 27.8333 },
  kemptonpark: { lat: -26.1, lng: 28.23 },
  tembisa: { lat: -25.9966, lng: 28.2294 },
  katlehong: { lat: -26.3333, lng: 28.15 },
  springs: { lat: -26.2546, lng: 28.4426 },
};

const areaKey = (s: string) => (s ?? "").toLowerCase().replace(/[^a-z]/g, "");
const ONB_CANCEL = /^(?:stop|cancel|quit|exit)\b/i;
const ONB_YES = /^(?:yes|y|yebo|agree|i agree|ok|okay|sure|yep)\b/i;

/** Create an app-less worker from onboarding answers. Keyed by number so a
 *  re-onboard is idempotent; account "approved" so matching works immediately,
 *  but verificationStatus "none" so employers still see them as unverified
 *  until they finish ID verification on the web. */
async function createWhatsAppWorker(
  wa: string,
  name: string,
  area: string,
  categories: string[],
): Promise<string> {
  const db = getFirestore();
  const now = Date.now();
  const coords = GAUTENG_COORDS[areaKey(area)];
  const uid = `wa_${wa}`;
  await db.doc(`users/${uid}`).set(
    {
      role: "worker",
      displayName: name,
      accountStatus: "approved",
      verificationStatus: "none",
      backgroundVerified: false,
      categories,
      suburb: area,
      city: area,
      province: "Gauteng",
      ...(coords ? { approxLat: coords.lat, approxLng: coords.lng } : {}),
      whatsappJobOptIn: true,
      whatsappNumber: wa,
      whatsappConsentAt: now,
      availableNow: true,
      availableNowAt: now,
      ratingAvg: null,
      ratingCount: 0,
      source: "whatsapp_onboarding",
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  );
  return uid;
}

type OnbDoc = { step?: string; name?: string; area?: string; categories?: string[] };

/**
 * Drive the onboarding state machine for an unknown number. Returns true if the
 * message was handled (Jarvis stops), false to fall through to support. State
 * lives in waOnboarding/{wa}; each message is idempotent on messageId.
 */
async function handleOnboarding(args: {
  messageId: string;
  wa: string;
  fromRaw: string;
  text: string;
  send: (to: string, body: string) => Promise<void>;
}): Promise<boolean> {
  const { messageId, wa, fromRaw, send } = args;
  const text = args.text.trim();
  const db = getFirestore();
  const onbRef = db.doc(`waOnboarding/${wa}`);
  const sess = (await onbRef.get()).data() as OnbDoc | undefined;

  // Not onboarding yet: only an opening/join message starts it.
  if (!sess) {
    if (!JOIN.test(text)) return false; // a real support enquiry → support
    if (messageId) {
      try { await db.doc(`waJobInbox/${messageId}`).create({ at: Date.now() }); }
      catch { return true; }
    }
    await onbRef.set({ step: "name", startedAt: Date.now(), updatedAt: Date.now() });
    await send(
      fromRaw,
      "👋 *Welcome to Workit!* Find everyday work near you — *no app, no data needed*, all on WhatsApp.\n\n"
        + "Let's get you started. First, what's your *name*?\n\n_(Reply STOP any time to cancel.)_",
    );
    return true;
  }

  // In onboarding — idempotency per message.
  if (messageId) {
    try { await db.doc(`waJobInbox/${messageId}`).create({ at: Date.now() }); }
    catch { return true; }
  }

  if (ONB_CANCEL.test(text)) {
    await onbRef.delete();
    await send(fromRaw, "No problem — stopped. Text *HI* any time to join Workit and find work. 👋");
    return true;
  }

  const step = sess.step;

  if (step === "name") {
    if (text.replace(/[^a-zA-Z]/g, "").length < 2) {
      await send(fromRaw, "Please reply with your name (e.g. *Thabo Mokoena*).");
      return true;
    }
    const name = text.slice(0, 60);
    await onbRef.set({ name, step: "area", updatedAt: Date.now() }, { merge: true });
    await send(fromRaw, `Thanks, *${name}*! 👋\n\nWhich *area* are you in? (e.g. Alberton, Soweto, Sandton)`);
    return true;
  }

  if (step === "area") {
    if (text.replace(/[^a-zA-Z]/g, "").length < 2) {
      await send(fromRaw, "Please reply with your area (e.g. *Alberton*).");
      return true;
    }
    await onbRef.set({ area: text.slice(0, 60), step: "cats", updatedAt: Date.now() }, { merge: true });
    await send(fromRaw, CATS_PROMPT);
    return true;
  }

  if (step === "cats") {
    const nums = Array.from(new Set((text.match(/\d+/g) ?? []).map((n) => parseInt(n, 10))))
      .filter((n) => n >= 1 && n <= ONB_CATS.length);
    if (nums.length === 0) {
      await send(fromRaw, "Reply with the *number(s)* that match your work, e.g. *1 3*.\n\n" + CATS_PROMPT);
      return true;
    }
    const cats = nums.map((n) => ONB_CATS[n - 1][0]);
    const labels = nums.map((n) => ONB_CATS[n - 1][1]).join(", ");
    await onbRef.set({ categories: cats, step: "consent", updatedAt: Date.now() }, { merge: true });
    await send(
      fromRaw,
      `Great — *${labels}*.\n\nLast step: do you agree to receive job alerts on WhatsApp and for Workit to process your details to match you with work (POPIA)?\n\nReply *YES* to join, or *STOP* to cancel.`,
    );
    return true;
  }

  if (step === "consent") {
    if (!ONB_YES.test(text)) {
      await send(fromRaw, "Reply *YES* to join Workit and start getting job alerts near you, or *STOP* to cancel.");
      return true;
    }
    const name = sess.name ?? "there";
    const area = sess.area ?? "your area";
    const uid = await createWhatsAppWorker(wa, name, area, sess.categories ?? []);
    await onbRef.delete();
    // Open their 24h window so the welcome + an immediate JOBS reply is free-text.
    await db.doc(`waJobThreads/${wa}`).set({ workerUid: uid, lastInboundAt: Date.now() }, { merge: true });
    await send(
      fromRaw,
      `🎉 You're in, *${name}* — welcome to *Workit*!\n\n`
        + `We'll WhatsApp you when a job near *${area}* matches your skills.\n\n`
        + "• Text *JOBS* to see open jobs now\n"
        + "• Text *AVAILABLE* to show you're ready to work\n"
        + "• Text *HELP* any time for options\n\n"
        + "✅ *Next:* finish your free verification at workitsa.co.za — the verified badge means employers trust you and you get hired faster.",
    );
    return true;
  }

  // Unknown/legacy step — reset gracefully.
  await onbRef.delete();
  return false;
}

/**
 * Try to handle an inbound WhatsApp message as a worker job command.
 * Returns true if handled here (Jarvis stops); false if it's not a job
 * interaction and should fall through to the normal support handler.
 *
 * `send(to, body)` is jarvisWhatsApp's own sender. Wrapped by the caller so a
 * throw can never break the support path.
 */
export async function handleWhatsAppJobReply(args: {
  messageId: string;
  fromRaw: string;
  fromDigits: string;
  text: string;
  location?: { lat: number; lng: number };
  send: (to: string, body: string) => Promise<void>;
}): Promise<boolean> {
  const { messageId, fromRaw, fromDigits, text, location, send } = args;

  const wa = toWa(fromDigits);
  const db = getFirestore();
  const worker = await lookupWorkerByWa(wa);

  // Unknown number → WhatsApp-only worker onboarding. If it isn't an onboarding
  // message, handleOnboarding returns false and Jarvis routes it to support.
  if (!worker) {
    return handleOnboarding({ messageId, wa, fromRaw, text, send });
  }

  // Known user: only a shared location or a recognised command is ours; any
  // other free text falls through to support.
  if (!location && !isJobKeyword(text)) return false;

  const threadRef = db.doc(`waJobThreads/${wa}`);

  // Idempotency: a re-delivered message must run once.
  if (messageId) {
    try {
      await db.doc(`waJobInbox/${messageId}`).create({ at: Date.now() });
    } catch {
      return true; // already processed this exact message
    }
  }

  // Any inbound from a known worker opens their 24h free-text window.
  await threadRef.set({ workerUid: worker.uid, lastInboundAt: Date.now() }, { merge: true });

  // --- Shared location: a safety check-in on the active job ---
  if (location) {
    const now = Date.now();
    const found = await findAssignedJob(worker.uid, ["assigned", "in_progress"]);
    if (found) {
      const patch: Record<string, unknown> = {
        lastCheckIn: { lat: location.lat, lng: location.lng, at: now },
        updatedAt: now,
      };
      // If an SOS is active without coordinates yet, attach them (does NOT
      // re-fire the alert — the emergency timestamp is unchanged).
      const emg = (found.job as { emergency?: { status?: string; lat?: number; at?: number } }).emergency;
      if (emg && emg.status === "active" && emg.lat == null) {
        patch.emergency = { ...emg, lat: location.lat, lng: location.lng };
      }
      await db.doc(`jobs/${found.id}`).set(patch, { merge: true });
      await send(fromRaw, "📍 Location received — thank you. It's saved to your job for safety.");
    } else {
      await send(fromRaw, "📍 Thanks for sharing your location. (No active job to attach it to right now.)");
    }
    return true;
  }

  // --- STOP ---
  if (STOP.test(text)) {
    await db.doc(`users/${worker.uid}`).set(
      { whatsappJobOptIn: false, whatsappOptOutAt: Date.now() },
      { merge: true },
    );
    await send(fromRaw, "You've been opted out of WhatsApp job alerts. 👋 Switch them back on anytime in your Workit account.");
    return true;
  }

  // --- Employer side: accept/decline offers over WhatsApp.
  //     Employers never fall through to the worker commands below. ---
  if (isEmployerSideRole(worker.role)) {
    return handleEmployerReply({ fromRaw, text, employer: worker, threadRef, send });
  }

  // --- SOS / emergency (checked early — safety first) ---
  if (SOS.test(text)) {
    const found = await findAssignedJob(worker.uid, ["assigned", "in_progress"]);
    const now = Date.now();
    if (found) {
      await db.doc(`jobs/${found.id}`).set(
        {
          emergency: {
            triggeredBy: worker.uid,
            triggeredByName: worker.displayName ?? "A worker",
            triggeredByRole: "worker",
            at: now,
            status: "active",
          },
          emergencyTriggeredAt: now,
          updatedAt: now,
        },
        { merge: true },
      );
    }
    await send(
      fromRaw,
      "🚨 *SOS received.* If you are in danger, call *SAPS 10111* right now.\n\n"
        + "Our safety team has been alerted. Share your location (tap 📎 → Location → Send) so we can find you fast.",
    );
    return true;
  }

  // --- HELP / MENU: show the worker what they can text (after SOS, so
  //     "help me" still reaches the safety path above). ---
  if (MENU.test(text)) {
    await send(fromRaw, WORKER_MENU);
    return true;
  }

  // --- REPORT: file a report for the admin safety team ---
  if (REPORT.test(text)) {
    const desc = text.replace(/^report\s*:?\s*/i, "").trim() || "(no detail given)";
    const found = await findAssignedJob(worker.uid, ["assigned", "in_progress", "completed", "confirmed"]);
    const thread = (await threadRef.get()).data() as ThreadDoc | undefined;
    const targetId = found?.id ?? thread?.lastJobId ?? "unknown";
    await db.collection("reports").add({
      reporterId: worker.uid,
      reporterName: worker.displayName ?? "A worker",
      targetType: "job",
      targetId,
      reason: "other",
      description: desc,
      status: "open",
      source: "whatsapp",
      createdAt: Date.now(),
    });
    await send(
      fromRaw,
      "Thank you — your report has been sent to our team and we'll look into it. "
        + "If this is an emergency, reply *SOS* or call *SAPS 10111*.",
    );
    return true;
  }

  // --- AVAILABLE: flag available-now (ranks higher + more alerts) ---
  if (AVAILABLE.test(text)) {
    await db.doc(`users/${worker.uid}`).set(
      { availableNow: true, availableNowAt: Date.now() },
      { merge: true },
    );
    await send(
      fromRaw,
      "✅ You're marked *available now* for the next 8 hours — employers see you first. "
        + "Text *JOBS* to browse work nearby.",
    );
    return true;
  }

  // --- JOBS / WORK: list open jobs near the worker ---
  if (JOBS.test(text)) {
    const jobs = await openJobsForWorker(worker);
    if (jobs.length === 0) {
      await send(fromRaw, "No open jobs match your area right now. We'll WhatsApp you as soon as one is posted. 👍");
      return true;
    }
    const lines = jobs.map(
      (x, i) => `*${i + 1}.* ${(x.job.title ?? "Job").slice(0, 40)} — ${where(x.job)} — R${x.job.suggestedPrice ?? "—"}`,
    );
    await threadRef.set({ lastList: jobs.map((x) => x.id), lastListAt: Date.now() }, { merge: true });
    await send(
      fromRaw,
      `🛠️ *Open jobs near you:*\n\n${lines.join("\n")}\n\nReply the number to offer (e.g. *1*), or a number and price to counter (e.g. *1 400*), or *STOP* to opt out.`,
    );
    return true;
  }

  // --- OFFER <price>: counter-offer on the last job we showed this worker ---
  const om = text.match(OFFER);
  if (om) {
    const price = parseInt(om[1], 10);
    const thread = (await threadRef.get()).data() as ThreadDoc | undefined;
    const jobId = thread?.lastJobId ?? (Array.isArray(thread?.lastList) ? thread!.lastList[0] : undefined);
    if (!jobId) {
      await send(fromRaw, "Text *JOBS* to see work first, then reply e.g. *OFFER 400* to propose your price.");
      return true;
    }
    const outcome = await createWhatsAppOffer(jobId, worker, price);
    await send(
      fromRaw,
      outcome === "ok"
        ? `✅ Your offer of *R${price}* has been sent. The employer will be notified — you'll hear back if they accept.`
        : outcome === "dupe"
          ? "You've already sent an offer on that job. 👍"
          : "Sorry, that job has just been taken or closed. Text *JOBS* to see what else is open.",
    );
    return true;
  }

  // --- START ---
  if (START.test(text)) {
    const found = await findAssignedJob(worker.uid, ["assigned"]);
    if (!found) {
      await send(fromRaw, "No job of yours is ready to start right now.");
    } else {
      await db.doc(`jobs/${found.id}`).set({ status: "in_progress", updatedAt: Date.now() }, { merge: true });
      await send(
        fromRaw,
        `👍 Marked "${found.job.title ?? "your job"}" as started. Reply *DONE* when you've finished.\n\n`
          + "🛡️ For your safety: share your location (tap 📎 → Location → Send), and reply *SOS* any time if you feel unsafe.",
      );
    }
    return true;
  }

  // --- DONE ---
  if (DONE.test(text)) {
    const found = await findAssignedJob(worker.uid, ["in_progress", "assigned"]);
    if (!found) {
      await send(fromRaw, "No active job of yours to mark done.");
    } else {
      const now = Date.now();
      await db.doc(`jobs/${found.id}`).set({ status: "completed", completedAt: now, updatedAt: now }, { merge: true });
      await send(fromRaw, `🎉 Marked "${found.job.title ?? "your job"}" as done. The employer will confirm and you can both rate each other.`);
    }
    return true;
  }

  // --- A number (pick from the last JOBS list), optionally with a price
  //     ("1 400" → offer R400 on job 1), or ACCEPT/1 (the last single alert) ---
  const m = text.match(NUMBER);
  const n = m ? parseInt(m[1], 10) : ACCEPT.test(text) ? 1 : null;
  if (n != null) {
    const inlinePrice = m && m[2] ? parseInt(m[2], 10) : undefined;
    const thread = (await threadRef.get()).data() as ThreadDoc | undefined;
    let jobId: string | undefined;
    let jobTitle: string | undefined;
    if (thread?.lastList && Array.isArray(thread.lastList) && n >= 1 && n <= thread.lastList.length) {
      jobId = thread.lastList[n - 1];
    } else if (thread?.lastJobId && (n === 1 || ACCEPT.test(text))) {
      jobId = thread.lastJobId;
      jobTitle = thread.lastJobTitle;
    }
    if (!jobId) {
      await send(fromRaw, "No job with that number right now. Text *JOBS* to see open jobs near you.");
      return true;
    }
    const outcome = await createWhatsAppOffer(jobId, worker, inlinePrice);
    const priceLine = inlinePrice ? ` of *R${inlinePrice}*` : "";
    await send(
      fromRaw,
      outcome === "ok"
        ? `✅ Offer${priceLine} sent${jobTitle ? ` for "${jobTitle}"` : ""}. The employer will be notified — you'll hear back if they accept.`
        : outcome === "dupe"
          ? "You've already sent an offer on that job. 👍"
          : "Sorry, that job has just been taken or closed. Text *JOBS* to see what else is open.",
    );
    return true;
  }

  return false;
}

// =====================================================================
// 3) Proof-of-work: when a job is confirmed, WhatsApp the worker their
//    refreshed, shareable Work Record link (employment → work readiness).
// =====================================================================

export const onJobConfirmedWhatsAppRecord = onDocumentUpdated(
  {
    document: "jobs/{jobId}",
    secrets: [WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID],
    timeoutSeconds: 120,
  },
  async (event) => {
    const before = event.data?.before.data() as JobDoc | undefined;
    const after = event.data?.after.data() as JobDoc | undefined;
    if (!before || !after) return;
    // Only on the transition into "confirmed".
    if (before.status === "confirmed" || after.status !== "confirmed") return;

    const uids = new Set<string>();
    if (after.assignedWorkerId) uids.add(after.assignedWorkerId);
    (after.assignedWorkerIds ?? []).forEach((u) => u && uids.add(u));
    if (uids.size === 0) return;

    const db = getFirestore();
    for (const uid of uids) {
      try {
        const u = (await db.doc(`users/${uid}`).get()).data() as WorkerDoc | undefined;
        // Respect consent: only workers who opted into WhatsApp from us.
        if (!u?.whatsappJobOptIn) continue;
        const wa = toWa(u.whatsappNumber);
        if (!wa) continue;
        // Only inside the 24h free-text window — no templates for this follow-up.
        const t = (await db.doc(`waJobThreads/${wa}`).get()).data() as ThreadDoc | undefined;
        if (Date.now() - Number(t?.lastInboundAt ?? 0) >= SESSION_WINDOW_MS) continue;

        const { token, totalJobs } = await upsertWorkRecord(uid);
        await sendText(
          wa,
          `🎉 Nice work on *${(after.title ?? "your job").slice(0, 50)}*! That's *${totalJobs}* confirmed `
            + `job${totalJobs === 1 ? "" : "s"} on Workit.\n\nHere's your *Work Record* — your proof of work to `
            + `share with landlords, lenders or employers:\n${APP_URL}/record?t=${token}`,
        );
        logger.info("wa proof-of-work sent", { uid, totalJobs });
      } catch (err) {
        logger.error("wa proof-of-work failed", { uid, err: String(err) });
      }
    }
  },
);

// =====================================================================
// 4) Offer resolved: WhatsApp the worker when the employer accepts or
//    rejects their offer (an app-less worker never sees the in-app push).
// =====================================================================

type OfferDoc = { status?: string; workerId?: string; price?: number };

export const onOfferResolvedWhatsApp = onDocumentUpdated(
  {
    document: "jobs/{jobId}/offers/{offerId}",
    secrets: [WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID],
    timeoutSeconds: 60,
  },
  async (event) => {
    const before = event.data?.before.data() as OfferDoc | undefined;
    const after = event.data?.after.data() as OfferDoc | undefined;
    if (!before || !after) return;
    // Only on the transition out of "pending" into a decision.
    if (before.status !== "pending") return;
    if (after.status !== "accepted" && after.status !== "rejected") return;
    const workerId = after.workerId;
    if (!workerId) return;

    try {
      const db = getFirestore();
      const u = (await db.doc(`users/${workerId}`).get()).data() as WorkerDoc | undefined;
      if (!u?.whatsappJobOptIn) return; // not a WhatsApp worker → in-app push covers them
      const wa = toWa(u.whatsappNumber);
      if (!wa) return;
      // Free-text only (inside the 24h window). Cold sends would need a template.
      const t = (await db.doc(`waJobThreads/${wa}`).get()).data() as ThreadDoc | undefined;
      if (Date.now() - Number(t?.lastInboundAt ?? 0) >= SESSION_WINDOW_MS) return;

      const job = (await db.doc(`jobs/${event.params.jobId}`).get()).data() as JobDoc | undefined;
      const title = (job?.title ?? "the job").slice(0, 50);
      const priceStr = typeof after.price === "number" ? ` of *R${after.price}*` : "";

      if (after.status === "accepted") {
        await sendText(
          wa,
          `🎉 *Great news!* Your offer${priceStr} for "${title}" was *accepted*.\n\n`
            + "Reply *START* when you're on site and *DONE* when you finish. Reply *SOS* any time if you feel unsafe.",
        );
      } else {
        await sendText(
          wa,
          `Your offer for "${title}" wasn't accepted this time. Don't worry — text *JOBS* to see other work near you. 👍`,
        );
      }
      logger.info("wa offer-resolved sent", { workerId, status: after.status });
    } catch (err) {
      logger.error("wa offer-resolved failed", { workerId, err: String(err) });
    }
  },
);

// =====================================================================
// 5) Offer created: WhatsApp the employer so they can accept/decline it
//    right there (closes the two-sided loop over WhatsApp).
// =====================================================================

export const onOfferCreatedNotifyEmployerWhatsApp = onDocumentCreated(
  {
    document: "jobs/{jobId}/offers/{offerId}",
    secrets: [WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID],
    timeoutSeconds: 60,
  },
  async (event) => {
    const offer = event.data?.data() as OfferFull | undefined;
    if (!offer || offer.status !== "pending") return;

    try {
      const db = getFirestore();
      const job = (await db.doc(`jobs/${event.params.jobId}`).get()).data() as JobDoc | undefined;
      if (!job?.employerId) return;
      const emp = (await db.doc(`users/${job.employerId}`).get()).data() as WorkerDoc | undefined;
      if (!emp?.whatsappJobOptIn) return; // employer hasn't opted into WhatsApp
      const wa = toWa(emp.whatsappNumber);
      if (!wa) return;

      const title = (job.title ?? "your job").slice(0, 50);
      const worker = offer.workerName ?? "A worker";
      const price = typeof offer.price === "number" ? offer.price : (job.suggestedPrice ?? "—");

      // In-window → free text with the OFFERS prompt; cold → template (gated).
      const t = (await db.doc(`waJobThreads/${wa}`).get()).data() as ThreadDoc | undefined;
      const inWindow = Date.now() - Number(t?.lastInboundAt ?? 0) < SESSION_WINDOW_MS;
      if (inWindow) {
        await sendText(
          wa,
          `💬 *New offer* on "${title}": *${worker}* offered *R${price}*.\n\n`
            + "Reply *OFFERS* to review, then *ACCEPT 1* to hire or *DECLINE 1* to pass — all here on WhatsApp.",
        );
      } else {
        await sendTemplate(wa, OFFER_RECEIVED_TEMPLATE, [title, worker, String(price)]);
      }
      logger.info("wa employer offer-notify sent", { jobId: event.params.jobId, inWindow });
    } catch (err) {
      logger.error("wa employer offer-notify failed", { err: String(err) });
    }
  },
);
