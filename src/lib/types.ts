export type UserRole = "employer" | "worker" | "admin" | "business";

/** Automated SA ID structural-check summary (Layer 1 KYC). Persisted at
 *  verification.idCheck; computed by lib/saId.ts. */
export type SaIdCheck = {
  ran: number;
  valid: boolean;
  luhnOk: boolean;
  dob?: string;
  gender?: "male" | "female";
  citizenship?: "citizen" | "permanent_resident" | "other";
  /** true/false when comparable to the entered value, null when it was missing. */
  dobMatch: boolean | null;
  genderMatch: boolean | null;
  /** Worst-first issues for the admin. */
  flags: string[];
};

/** Roles on the "demand"/employer side — they post + manage jobs and hire.
 *  Businesses are employer-plus, so they behave like employers for posting,
 *  the account dashboard, notifications, and being rated by workers. */
export function isEmployerSide(role?: UserRole): boolean {
  return role === "employer" || role === "business" || role === "admin";
}

/** Can this role post jobs? (employers, businesses, admins). */
export function canPostJobs(role?: UserRole): boolean {
  return role === "employer" || role === "business" || role === "admin";
}

export function isBusiness(role?: UserRole): boolean {
  return role === "business";
}

/** Whether a profile has the Business Pro subscription active (monetization). */
export function isBusinessPro(profile?: Partial<UserProfile> | null): boolean {
  return !!profile?.businessPro;
}

export type AccountStatus = "pending" | "approved" | "rejected" | "suspended";

export type VerificationStatus =
  | "none"
  | "pending"
  // Admin asked for a fix (e.g. blurry ID photo) — softer than "rejected".
  // The reviewer note carries the message; resubmitting returns to "pending".
  | "changes_requested"
  | "approved"
  | "rejected";

/**
 * Whether a profile can access the app. Admins always pass.
 * Legacy profiles created before this gate existed (undefined accountStatus)
 * also pass — only fresh signups must wait for approval.
 */
export function isAccountApproved(profile?: Partial<UserProfile> | null): boolean {
  if (!profile) return false;
  if (profile.role === "admin") return true;
  if (profile.accountStatus === undefined) return true; // legacy
  return profile.accountStatus === "approved";
}

export type UserProfile = {
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  role: UserRole;
  createdAt: number;
  photoURL?: string;

  /** RBAC phase 1 (ADMIN_ROLES.md): granular admin role, set only by the
   *  setAdminRole callable. Absent = not a role-holding admin. The legacy
   *  binary `role === "admin"` still gates everything until phase 2. */
  adminRole?: string;

  // Master gate — admin must approve before any access
  accountStatus?: AccountStatus;
  accountReviewedAt?: number;
  accountReviewerNote?: string;

  // True once the user has submitted their initial profile (post-signup).
  // Used to send brand-new users into /profile first, then into the pending
  // screen only after they've completed setup.
  profileCompletedAt?: number;

  // POPIA / consent: when the user accepted the Terms + Privacy Policy at signup,
  // and which version was in force. Proof of consent.
  termsAcceptedAt?: number;
  termsVersion?: string;

  // Date of birth (ISO yyyy-mm-dd). Captured at signup for 18+ check.
  // PRIVATE (Phase B): lives in users/{uid}/private/profile, merged back for
  // the owner by AuthContext. Other viewers only see `birthYear`.
  dateOfBirth?: string;
  /** PUBLIC derived value — birth year only, drives the age shown on the
   *  public profile without exposing the full date of birth. */
  birthYear?: number;

  province?: string;
  city?: string;
  suburb?: string;

  /** Optional self-reported gender, shown on the public profile. Age is
   *  derived from dateOfBirth (above) — not stored separately. */
  gender?: Gender;

  // Worker / employer home base for distance matching.
  // PRIVATE (Phase B): exact coordinates live in users/{uid}/private/profile,
  // merged back for the owner. Other viewers only see approxLat/approxLng.
  homeLat?: number;
  homeLng?: number;
  homeAccuracy?: number; // metres
  homePinnedAt?: number;
  /** PUBLIC derived location — rounded to ~1 km so the workers directory can
   *  show "x km away" without exposing anyone's exact home. */
  approxLat?: number;
  approxLng?: number;

  /** True once the number was OTP-confirmed (phone sign-ups are verified by
   *  definition; email/Google users verify via the account-page prompt). */
  phoneVerified?: boolean;

  // Worker-only fields
  verificationStatus?: VerificationStatus;
  backgroundVerified?: boolean;
  categories?: string[];
  /** Specific skills within those categories — SUBCATEGORIES ids (e.g. "hair",
   *  "plumbing", "bakkie-hire"). Ids are unique across the whole taxonomy, so
   *  a bare id resolves without its parent. Drives skill-level worker search. */
  skills?: string[];
  bio?: string;

  // Verification submission data (real file URLs once Storage is enabled)
  verification?: {
    // (SaIdCheck shape defined below the UserProfile type.)
    idNumber?: string;
    idPhotoURL?: string;
    selfieVideoURL?: string;
    selfieNote?: string;
    addressLine?: string;
    addressProofURL?: string;
    skillsSummary?: string;
    skillProofURLs?: string[];
    /** Optional police clearance certificate — unlocks the Gold "Background verified" badge once an admin reviews it. */
    policeClearanceURL?: string;
    submittedAt?: number;
    reviewedAt?: number;
    reviewerNote?: string;
    /** Last time the worker resubmitted after the first submission.
     *  Set by the onUserVerificationSubmitted Cloud Function. */
    resubmittedAt?: number;
    /** How many times they've resubmitted in total (excludes the first submit). */
    resubmissionCount?: number;
    /** POPIA: when the worker explicitly consented to Workit processing their
     *  ID + selfie (special personal information) for verification. */
    consentAt?: number;
    /** Privacy/terms version in force at the time of that consent. */
    consentVersion?: string;
    /** Automated SA ID structural check (Layer 1 KYC) — Luhn + DOB/gender
     *  cross-check. Run client-side on submit; surfaced to the admin. PRIVATE
     *  (contains the resolved DOB) — lives on users/{uid}/private/profile. */
    idCheck?: SaIdCheck;
    /** Coarse verdict (no PII) safe to keep on the public doc for an at-a-glance
     *  admin-queue badge. */
    idCheckVerdict?: "pass" | "warn" | "fail" | "none";
    /** Server-computed free fraud signals (functions/src/fraudSignals.ts).
     *  Lives ONLY on the private doc; reaches the admin review card via
     *  getVerificationPayload. */
    fraud?: {
      inputsHash?: string;
      ran?: number;
      /** Other accounts that submitted the SAME ID number. */
      duplicateIdUids?: string[];
      /** Age decoded from the ID number itself. */
      idAge?: number | null;
      idUnder18?: boolean;
      /** Which identifiers (email/phone) matched a suspended account at signup. */
      banMatch?: string[];
      banMatchAt?: number;
      /** Verification uploads byte-identical to another account's. */
      duplicateFiles?: { path: string; matchesUid: string }[];
      /** Vision OCR cross-check of the ID photo. */
      ocr?: {
        forPath?: string;
        idNumberFound?: boolean;
        nameTokens?: number;
        nameTokensFound?: number;
        textChars?: number;
        skipped?: string;
        error?: string;
      };
    };
  };

  // Rating aggregate
  ratingAvg?: number;
  ratingCount?: number;

  // Job stats (lifetime)
  jobsCompleted?: number;
  jobsCancelled?: number;
  /** Employer-side track record: how many worker engagements this employer has
   *  seen through to confirmed. Server-authored (onJobConfirmedCountWork) +
   *  rules-protected, like jobsCompleted — surfaced to workers as a trust signal
   *  before they accept a job at a stranger's place. */
  employerJobsHired?: number;
  /** Payment-handshake tallies: jobs where BOTH sides confirmed the cash/EFT
   *  changed hands (worker side / employer side). Server-authored only
   *  (confirmPayment callable) + rules-protected — payment reliability is a
   *  trust signal and feeds the worker's Work Record. */
  paymentsConfirmedCount?: number;
  employerPaymentsConfirmed?: number;

  // UIDs the user has blocked. They won't see each other's jobs/offers.
  blockedUserIds?: string[];

  // Referrals
  referralCode?: string;          // short shareable code (derived from uid)
  referredBy?: string;            // uid of the referrer (set at signup if ?ref=)
  referralsCount?: number;        // how many people they've referred
  signupSource?: string;          // growth channel from ?src= at first touch (e.g. "fb")

  // Worker self-flag: "I'm available right now for work"
  availableNow?: boolean;
  availableNowAt?: number;        // when they toggled it on (auto-expires after 8h)

  // WhatsApp Job Channel opt-in (worker). Low-data job alerts over WhatsApp;
  // POPIA consent is the toggle itself, timestamped. Number stored normalised
  // (27XXXXXXXXX). See functions/src/whatsappJobChannel.ts.
  whatsappJobOptIn?: boolean;
  whatsappNumber?: string;
  whatsappConsentAt?: number;
  whatsappOptOutAt?: number;

  // ---------- PUBLIC PORTFOLIO ----------
  // Visible on /u?id={uid} to anyone signed in. Optional, but workers (and
  // employers) who fill it in look much more trustworthy than blank profiles.
  /** One-line headline shown under the name on the public profile.
   *  e.g. "Reliable gardener, 8 years in Linden". */
  tagline?: string;
  /** Free-form credentials list. Order is shown as entered. */
  qualifications?: PortfolioQualification[];
  /** PDF / image of a CV — public-readable from /portfolio/{uid}/... */
  cvURL?: string;
  /** Public showcase photos — separate from the private verification skill proofs. */
  portfolioImageURLs?: string[];
  /** Public showcase videos (short clips of past work). */
  portfolioVideoURLs?: string[];

  // ---------- BUSINESS ACCOUNTS (role === "business") ----------
  // A business is employer-plus: it posts jobs like an employer AND has a
  // public profile + directory listing workers can browse. Self-declared by
  // default; an optional registration-verified tier adds a trust badge.
  /** Trading name shown on jobs + the directory (falls back to displayName). */
  businessName?: string;
  /** One-line headline, e.g. "Fast, friendly cleaning across the East Rand". */
  businessTagline?: string;
  /** Longer "about us" description for the profile page. */
  businessDescription?: string;
  /** Logo (public). Separate from the personal photoURL/avatar. */
  businessLogoURL?: string;
  /** What the business does — reuse the job categories. */
  businessCategories?: CategoryId[];
  /** Area(s) the business serves, free text e.g. "Sandton, Midrand, Fourways". */
  businessAreaServed?: string;
  /** Public contact channels (optional — shown on the profile). */
  businessWebsite?: string;
  businessPublicPhone?: string;
  businessPublicEmail?: string;
  /** Public showcase photos for the business profile. */
  businessPhotoURLs?: string[];
  /** Registration-verified tier (Phase 2). Self-declared profiles work without it. */
  businessVerification?: {
    /** SA company registration (CIPC) number, as entered. */
    registrationNumber?: string;
    /** Uploaded proof (CIPC doc, etc.) — admin-reviewed. */
    registrationProofURL?: string;
    status?: "none" | "pending" | "approved" | "rejected";
    submittedAt?: number;
    reviewedAt?: number;
    reviewerNote?: string;
  };

  /** Business Pro subscription (monetization). Free during launch; gated server-
   *  side once billing turns on. Unlocks the Pro badge + priority directory
   *  placement. */
  businessPro?: boolean;
  businessProSince?: number;
};

// ---------- BUSINESS LEADS (worker → business "express interest") ----------

/** A worker tells a business they'd like to work with them. Lives at
 *  users/{businessUid}/leads/{leadId}. The business reads its own leads; the
 *  worker can read only their own. A Cloud Function notifies the business. */
export type BusinessLead = {
  id: string;
  businessUid: string;
  workerUid: string;
  workerName: string;
  workerPhotoURL?: string;
  message?: string;
  createdAt: number;
  status?: "new" | "seen";
};

// ---------- REPORTS (community moderation) ----------

export type ReportTargetType = "job" | "user" | "message" | "offer";
export type ReportReason =
  | "illegal"        // drugs, weapons, stolen goods, criminal activity
  | "sexual"         // sex work, sexual content / solicitation
  | "harassment"     // threats, abuse, slurs, racism
  | "scam"           // pay-to-apply, money mule, advance-fee fraud
  | "violence"       // threats of harm, depiction of violence
  | "spam"           // repetitive posts, fake placement agencies
  | "csam"           // ALWAYS escalated immediately — child sexual abuse material
  | "other";
export type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";
export type ReportResolution =
  | "warned"           // user warned, content kept
  | "content_removed"  // content taken down, user kept
  | "suspended"        // user suspended pending appeal
  | "banned"           // permanent ban
  | "no_action";       // false report

export type Report = {
  id: string;
  reporterId: string;
  reporterName: string;
  targetType: ReportTargetType;
  targetId: string;
  /** For messages: the parent jobId. For offers: the parent jobId. */
  targetParentId?: string;
  /** UID of the user being reported (denormalised — for fast queue queries). */
  targetUserUid?: string;
  reason: ReportReason;
  description: string;
  createdAt: number;
  status: ReportStatus;
  resolvedAt?: number;
  resolverUid?: string;
  resolverNote?: string;
  resolution?: ReportResolution;
};

// ---------- MODERATION (server-side flags) ----------

export type ModerationFlagKind =
  | "image_safesearch"     // Vision API auto-flag
  | "text_screen"          // text regex hit on job/profile
  | "rate_limit"           // too many posts in 24h
  | "first_post_review"    // new user's first job, queued for review
  | "user_report";         // community report (denormalised pointer to /reports)

export type ModerationFlag = {
  id: string;
  kind: ModerationFlagKind;
  /** What got flagged — could be a job ID, user UID, message ID, etc. */
  targetType: "job" | "user" | "message" | "image";
  targetId: string;
  /** Free-text reason or matched-text snippet. */
  reason: string;
  /** "low" / "medium" / "high" — drives auto-block vs queue-for-review. */
  severity: "low" | "medium" | "high";
  createdAt: number;
  /** Whether the flagged content was automatically hidden / removed. */
  autoActioned: boolean;
  reviewedAt?: number;
  reviewerUid?: string;
  reviewerAction?: "approve" | "remove" | "warn_user" | "suspend_user" | "ban_user" | "dismiss";
};

// ---------- SAVED SEARCHES (workers' job alerts) ----------

export type SavedSearchRadius = 5 | 10 | 25 | 50 | "all";

export type SavedSearch = {
  id: string;
  /** Optional friendly label the worker types. Falls back to a derived summary. */
  name?: string;
  /** Single category id or "all". */
  category: CategoryId | "all";
  /** Optional keyword that must appear in title / description / suburb. */
  keyword?: string;
  /** Radius from the worker's home pin. "all" disables distance filter. */
  radiusKm: SavedSearchRadius;
  createdAt: number;
  /** Latest matching job id we surfaced — used client-side to dedupe toasts. */
  lastNotifiedJobId?: string;
};

// ---------- GENDER + AGE ----------

export type Gender = "male" | "female" | "other" | "prefer_not";

export const GENDER_OPTIONS: { id: Gender; label: string }[] = [
  { id: "female", label: "Female" },
  { id: "male", label: "Male" },
  { id: "other", label: "Other" },
  { id: "prefer_not", label: "Prefer not to say" },
];

export function genderLabel(g?: Gender): string | undefined {
  return GENDER_OPTIONS.find((o) => o.id === g)?.label;
}

/** Approximate age from a public birth year (±1 yr). Used on public profiles
 *  so the exact date of birth can stay private. */
export function ageFromYear(birthYear?: number): number | undefined {
  if (typeof birthYear !== "number" || birthYear < 1900) return undefined;
  const age = new Date().getFullYear() - birthYear;
  return age >= 0 && age < 120 ? age : undefined;
}

/** Round a coordinate to ~1.1 km (2 decimal places) for public display. */
export function approxCoord(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Whole-year age from an ISO yyyy-mm-dd date of birth. */
export function ageFromDob(dob?: string): number | undefined {
  if (!dob) return undefined;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return undefined;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 && age < 120 ? age : undefined;
}

/** Employer's optional preferred-worker filter on a job — a *preference*,
 *  not a hard gate (anyone can still offer). Kept soft to avoid unfair
 *  discrimination under SA labour norms. */
export type JobWorkerPreference = {
  gender?: "male" | "female" | "any";
  ageMin?: number;
  ageMax?: number;
};

export type PortfolioQualification = {
  /** e.g. "Trade Test Plumbing" */
  title: string;
  /** e.g. "Northlink TVET College" */
  issuer?: string;
  /** Four-digit year, free-form (kept as string so workers can write "2021" or "2018–2020"). */
  year?: string;
};

// ---------- WORKER LEVELS ----------

export type WorkerLevel = {
  id: "newcomer" | "bronze" | "silver" | "gold" | "platinum";
  label: string;
  short: string;
  min: number;            // jobs completed to reach this level
  tone: "stone" | "ochre" | "ink" | "sage";
  icon: string;
};

export const WORKER_LEVELS: WorkerLevel[] = [
  { id: "newcomer", label: "Newcomer",  short: "New",        min: 0,   tone: "stone", icon: "🌱" },
  { id: "bronze",   label: "Bronze",    short: "Bronze",     min: 5,   tone: "ochre", icon: "🥉" },
  { id: "silver",   label: "Silver",    short: "Silver",     min: 15,  tone: "ink",   icon: "🥈" },
  { id: "gold",     label: "Gold",      short: "Gold",       min: 50,  tone: "ochre", icon: "🥇" },
  { id: "platinum", label: "Platinum",  short: "Platinum",   min: 100, tone: "sage",  icon: "💎" },
];

export function workerLevel(jobsCompleted: number = 0): WorkerLevel {
  // Walk levels descending; first match wins.
  for (let i = WORKER_LEVELS.length - 1; i >= 0; i--) {
    if (jobsCompleted >= WORKER_LEVELS[i].min) return WORKER_LEVELS[i];
  }
  return WORKER_LEVELS[0];
}

export function nextLevel(jobsCompleted: number = 0): WorkerLevel | null {
  for (const lvl of WORKER_LEVELS) {
    if (jobsCompleted < lvl.min) return lvl;
  }
  return null;
}

/** Short referral code derived from a uid — 6 base36 chars, case-insensitive. */
export function refCodeFor(uid: string): string {
  // Simple hash → 6 chars. Stable per uid.
  let h = 0;
  for (let i = 0; i < uid.length; i++) {
    h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  }
  return h.toString(36).toUpperCase().slice(0, 6).padStart(6, "0");
}

// ---------- REPUTATION BADGES ----------

export type ReputationBadgeId =
  | "verified"
  | "background-verified"
  | "top-rated"
  | "reliable"
  | "rising-star"
  | "local-hero"
  | "connector"
  | "ambassador";

export type ReputationBadge = {
  id: ReputationBadgeId;
  label: string;
  short: string;
  tone: "sage" | "ochre" | "ink" | "stone";
  description: string;
};

const ALL_BADGES: Record<ReputationBadgeId, ReputationBadge> = {
  verified: {
    id: "verified",
    label: "Verified worker",
    short: "Verified",
    tone: "sage",
    description: "ID and address checked by a real person.",
  },
  "background-verified": {
    id: "background-verified",
    label: "Background verified",
    short: "Gold",
    tone: "ochre",
    description: "Police clearance on file. Top safety tier.",
  },
  "top-rated": {
    id: "top-rated",
    label: "Top rated",
    short: "Top rated",
    tone: "ochre",
    description: "Average 4.5+ stars across 10+ completed jobs.",
  },
  reliable: {
    id: "reliable",
    label: "Reliable",
    short: "Reliable",
    tone: "sage",
    description: "Completed 95%+ of jobs they accepted.",
  },
  "rising-star": {
    id: "rising-star",
    label: "Rising star",
    short: "Rising star",
    tone: "ochre",
    description: "5★ rating on their first 3 jobs.",
  },
  "local-hero": {
    id: "local-hero",
    label: "Local hero",
    short: "Local hero",
    tone: "ink",
    description: "50+ jobs completed in their area.",
  },
  connector: {
    id: "connector",
    label: "Connector",
    short: "Connector",
    tone: "sage",
    description: "Brought 3+ people to Workit.",
  },
  ambassador: {
    id: "ambassador",
    label: "Workit Ambassador",
    short: "Ambassador",
    tone: "ochre",
    description: "Grew the community by 10+ members.",
  },
};

export function computeBadges(profile: Partial<UserProfile>): ReputationBadge[] {
  const earned: ReputationBadgeId[] = [];
  if (profile.verificationStatus === "approved") earned.push("verified");
  if (profile.backgroundVerified) earned.push("background-verified");

  const completed = profile.jobsCompleted ?? 0;
  const cancelled = profile.jobsCancelled ?? 0;
  const rated = profile.ratingCount ?? 0;
  const avg = profile.ratingAvg ?? 0;

  if (rated >= 10 && avg >= 4.5) earned.push("top-rated");
  if (completed >= 10 && completed / Math.max(1, completed + cancelled) >= 0.95) {
    earned.push("reliable");
  }
  if (rated >= 3 && rated < 5 && avg === 5) earned.push("rising-star");
  if (completed >= 50) earned.push("local-hero");

  // Referral status — show only the highest tier earned.
  const referrals = profile.referralsCount ?? 0;
  if (referrals >= 10) earned.push("ambassador");
  else if (referrals >= 3) earned.push("connector");

  return earned.map((id) => ALL_BADGES[id]);
}

// ---------- REFERRAL REWARD MILESTONES ----------

/** Referral count → public badge. Drives both the reward badges (above) and
 *  the progress shown on the ReferralCard. */
export const REFERRAL_MILESTONES = [
  { at: 3, badge: "connector" as const, label: "Connector" },
  { at: 10, badge: "ambassador" as const, label: "Workit Ambassador" },
] as const;

export type ReferralProgress = {
  count: number;
  earned: (typeof REFERRAL_MILESTONES)[number] | null;
  next: (typeof REFERRAL_MILESTONES)[number] | null;
};

export function referralProgress(count: number): ReferralProgress {
  const earned = [...REFERRAL_MILESTONES].reverse().find((m) => count >= m.at) ?? null;
  const next = REFERRAL_MILESTONES.find((m) => count < m.at) ?? null;
  return { count, earned, next };
}

export { ALL_BADGES };

export const CATEGORIES = [
  { id: "home-garden", label: "Home & garden" },
  { id: "trades", label: "Skilled trades" },
  { id: "moving-errands", label: "Moving & errands" },
  { id: "personal", label: "Personal services" },
  { id: "beauty-wellness", label: "Beauty & wellness" },
  { id: "events-catering", label: "Events & catering" },
  { id: "driving-delivery", label: "Driving & delivery" },
  { id: "tutoring-education", label: "Tutoring & education" },
  { id: "care", label: "Childcare & elderly care" },
  { id: "construction-labour", label: "Construction & labour" },
  { id: "tech-digital", label: "Tech & digital" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

/**
 * Subcategories — narrow tags within a parent category. Optional on jobs
 * + worker profiles. Used to surface "plumber" workers for "plumbing" jobs.
 */
export const SUBCATEGORIES: Record<CategoryId, { id: string; label: string }[]> = {
  "home-garden": [
    { id: "gardening", label: "Gardening" },
    { id: "lawn-mowing", label: "Lawn mowing" },
    { id: "tree-pruning", label: "Tree pruning" },
    { id: "cleaning", label: "House cleaning" },
    { id: "window-cleaning", label: "Window cleaning" },
    { id: "pool-care", label: "Pool care" },
    { id: "pest-control", label: "Pest control" },
  ],
  trades: [
    { id: "plumbing", label: "Plumbing" },
    { id: "electrical", label: "Electrical" },
    { id: "painting", label: "Painting" },
    { id: "tiling", label: "Tiling" },
    { id: "carpentry", label: "Carpentry" },
    { id: "welding", label: "Welding" },
    { id: "roofing", label: "Roofing" },
    { id: "appliance-repair", label: "Appliance repair" },
  ],
  "moving-errands": [
    { id: "bakkie-hire", label: "Bakkie / van hire" },
    { id: "moving-help", label: "Moving help" },
    { id: "delivery", label: "Delivery / collection" },
    { id: "grocery-run", label: "Grocery run" },
    { id: "queue-standing", label: "Queue standing (Home Affairs etc.)" },
  ],
  personal: [
    { id: "car-wash", label: "Car wash" },
    { id: "ironing", label: "Ironing / laundry" },
    { id: "errands", label: "General errands" },
    { id: "pet-care", label: "Pet sitting / walking" },
  ],
  "beauty-wellness": [
    { id: "hair", label: "Hair" },
    { id: "nails", label: "Nails" },
    { id: "makeup", label: "Makeup" },
    { id: "massage", label: "Massage" },
    { id: "waxing", label: "Waxing / threading" },
    { id: "barber", label: "Barber" },
  ],
  "events-catering": [
    { id: "bartender", label: "Bartender" },
    { id: "server", label: "Waiter / server" },
    { id: "chef", label: "Chef / cook" },
    { id: "photographer", label: "Photographer / videographer" },
    { id: "decoration", label: "Setup / decoration" },
    { id: "dj", label: "DJ / sound" },
    { id: "cleanup", label: "Event cleanup" },
  ],
  "driving-delivery": [
    { id: "driver-hire", label: "Driver-for-hire" },
    { id: "courier", label: "Courier (own bike / car)" },
    { id: "food-delivery", label: "Food delivery" },
    { id: "removals", label: "Furniture removals" },
    { id: "airport", label: "Airport runs" },
  ],
  "tutoring-education": [
    { id: "school-subject", label: "School subject tutoring" },
    { id: "university", label: "University tutoring" },
    { id: "music", label: "Music lessons" },
    { id: "swimming", label: "Swimming lessons" },
    { id: "language", label: "Language tutoring" },
    { id: "exam-prep", label: "Exam prep (matric, IEB, NSC)" },
  ],
  care: [
    { id: "babysitter", label: "Babysitter (occasional)" },
    { id: "nanny", label: "Nanny (regular)" },
    { id: "au-pair", label: "Au pair / school runs" },
    { id: "elderly-care", label: "Elderly caregiver" },
    { id: "frail-care", label: "Frail / medical care" },
  ],
  "construction-labour": [
    { id: "general-labour", label: "General labour" },
    { id: "demolition", label: "Demolition" },
    { id: "bricklaying", label: "Brick / blocklaying" },
    { id: "plastering", label: "Plastering" },
    { id: "site-cleaning", label: "Site cleaning" },
    { id: "scaffolding", label: "Scaffolding" },
  ],
  "tech-digital": [
    { id: "laptop-repair", label: "Laptop / phone repair" },
    { id: "computer-setup", label: "Computer setup / wifi" },
    { id: "social-media", label: "Social media setup / help" },
    { id: "photo-editing", label: "Photo / video editing" },
    { id: "data-capture", label: "Data capture / admin" },
    { id: "website", label: "Website / e-commerce help" },
  ],
};

export function findSubcategoryLabel(categoryId: CategoryId, subId?: string): string | undefined {
  if (!subId) return undefined;
  return SUBCATEGORIES[categoryId]?.find((s) => s.id === subId)?.label;
}

/** Flat lookup across the whole taxonomy — skill ids are unique across
 *  categories, so a bare id (from a worker's `skills` list) resolves without
 *  knowing its parent category. */
export function skillLabel(subId?: string): string | undefined {
  if (!subId) return undefined;
  for (const catId of Object.keys(SUBCATEGORIES) as CategoryId[]) {
    const hit = SUBCATEGORIES[catId].find((s) => s.id === subId);
    if (hit) return hit.label;
  }
  return undefined;
}

// ---------- AVAILABLE NOW ----------

/** How long the worker's "available now" self-flag stays live before it
 *  auto-expires (so a worker who forgets doesn't permanently look available). */
export const AVAILABLE_NOW_EXPIRE_MS = 8 * 60 * 60 * 1000;

/** True while the worker's self-flag is on AND inside the expiry window. */
export function isAvailableNow(
  p: Pick<UserProfile, "availableNow" | "availableNowAt">,
  now: number = Date.now(),
): boolean {
  return !!p.availableNow && (p.availableNowAt ?? 0) > now - AVAILABLE_NOW_EXPIRE_MS;
}

// ---------- CREW HELPERS ----------

/** Convenience: true when this job needs more than one worker. */
export function isCrewJob(job: Pick<Job, "workersNeeded">): boolean {
  return (job.workersNeeded ?? 1) > 1;
}

/** Returns workers in `assignedWorkers` that haven't been removed. */
export function activeCrew(job: Pick<Job, "assignedWorkers">): AssignedWorker[] {
  return (job.assignedWorkers ?? []).filter((w) => w.status !== "removed");
}

/** True while a job's featured/boost window is still active (monetization). */
export function isBoosted(job: Pick<Job, "boostedUntil">, now: number = Date.now()): boolean {
  return typeof job.boostedUntil === "number" && job.boostedUntil > now;
}

/** Spots filled / needed / remaining for any job (works for legacy single jobs too). */
export function crewProgress(
  job: Pick<Job, "workersNeeded" | "assignedWorkers" | "assignedWorkerId" | "status">,
): { filled: number; needed: number; remaining: number } {
  const needed = job.workersNeeded ?? 1;
  if (isCrewJob(job)) {
    const filled = activeCrew(job).length;
    return { filled, needed, remaining: Math.max(0, needed - filled) };
  }
  // Legacy single-worker job
  const filled = job.assignedWorkerId ? 1 : 0;
  return { filled, needed: 1, remaining: 1 - filled };
}

// ---------- JOB SPECS ----------

/** Who brings the tools / equipment? */
export type ToolsProvided = "employer" | "worker" | "shared" | "na";

/** How experienced does the worker need to be? */
export type ExperienceLevel = "any" | "some" | "experienced";

/** How the employer plans to pay on completion. */
export type PaymentMethod = "cash" | "eft";

export const PAYMENT_OPTIONS: { id: PaymentMethod; label: string; hint: string }[] = [
  { id: "cash", label: "Cash on completion", hint: "Pay the worker in cash when the job is done" },
  { id: "eft", label: "EFT on completion", hint: "Transfer to the worker's bank when done" },
];

export function findPaymentLabel(id?: PaymentMethod): string | undefined {
  return PAYMENT_OPTIONS.find((p) => p.id === id)?.label;
}

export const TOOLS_OPTIONS: { id: ToolsProvided; label: string; hint: string }[] = [
  { id: "employer", label: "Employer provides tools", hint: "I have everything they'll need" },
  { id: "worker", label: "Worker brings own tools", hint: "They must arrive ready to work" },
  { id: "shared", label: "Some of each", hint: "Discuss in chat" },
  { id: "na", label: "No tools needed", hint: "Like queue-standing or admin work" },
];

export const EXPERIENCE_OPTIONS: { id: ExperienceLevel; label: string; hint: string }[] = [
  { id: "any", label: "Open to anyone", hint: "Newcomers welcome" },
  { id: "some", label: "Some experience", hint: "Has done this type of work before" },
  { id: "experienced", label: "Experienced only", hint: "Established worker with proven track record" },
];

export function findToolsLabel(id?: ToolsProvided): string | undefined {
  return TOOLS_OPTIONS.find((t) => t.id === id)?.label;
}
export function findExperienceLabel(id?: ExperienceLevel): string | undefined {
  return EXPERIENCE_OPTIONS.find((e) => e.id === id)?.label;
}

export type JobStatus =
  | "open" // accepting offers
  | "assigned" // employer picked a worker, not yet started
  | "in_progress" // worker on the way / doing the job
  | "completed" // worker marked done, awaiting employer confirmation
  | "confirmed" // employer confirmed; ratings unlocked
  | "disputed" // either party raised a dispute; frozen pending admin
  | "cancelled";

export type DisputeReason =
  | "no_show"
  | "quality"
  | "unsafe"
  | "payment"
  | "scope_changed"
  | "other";

export type DisputeResolution =
  | "force_completed"
  | "cancelled_no_fault"
  | "cancelled_with_warning"
  | "dismissed";

export type Dispute = {
  raisedBy: string;          // uid
  raisedByName: string;
  raisedByRole: "employer" | "worker";
  reason: DisputeReason;
  description: string;
  raisedAt: number;

  // Snapshot of the job status before the dispute (so admin can restore).
  previousStatus: JobStatus;

  resolution?: DisputeResolution;
  resolverNote?: string;
  resolvedAt?: number;
};

/** A live SOS alert raised from an active job (worker or employer felt unsafe). */
export type EmergencyAlert = {
  triggeredBy: string;            // uid
  triggeredByName?: string;
  triggeredByRole?: "employer" | "worker";
  at: number;
  // GPS captured at the moment of the alert (best-effort — may be absent if the
  // device denied location or was too slow; the call to SAPS never waits on it).
  lat?: number;
  lng?: number;
  accuracy?: number;
  status: "active" | "resolved";
  resolvedBy?: string;            // admin uid
  resolvedByName?: string;
  resolvedAt?: number;
  note?: string;                  // admin's note on how it was handled
};

/** Status of an individual worker slot on a multi-worker job. */
export type AssignedWorkerStatus =
  | "assigned"     // accepted by employer, not yet started
  | "in_progress"  // worker on their way / doing their portion
  | "completed"    // worker marked their portion done, awaiting employer confirm
  | "confirmed"    // employer confirmed this worker's portion
  | "removed";     // dropped out / removed; slot is reopened

export type AssignedWorker = {
  uid: string;
  name: string;
  photoURL?: string;
  /** Per-worker agreed price (from the offer they sent). */
  agreedPrice: number;
  status: AssignedWorkerStatus;
  joinedAt: number;
  /** Worker tapped "I'm on my way" — still status "assigned" until they start. */
  enRouteAt?: number;
  /** Set when this crew member verified the employer's start code at the door
   *  (a trustworthy arrival timestamp). Absent = started without code verification. */
  startVerifiedAt?: number;
  completedAt?: number;
  confirmedAt?: number;
  removedAt?: number;
  /** Payment handshake for this slot (see Job.paymentPaidAt) — employer's
   *  "I've paid" / this worker's "received" / both-done stamp. Written only by
   *  the confirmPayment callable. */
  paidAt?: number;
  receivedAt?: number;
  paymentConfirmedAt?: number;
  /** Employer's rating of this specific worker. */
  employerRating?: { stars: number; text?: string; at: number };
  /** This worker's rating of the employer. */
  workerRating?: { stars: number; text?: string; at: number };
};

/** How often a recurring job repeats. */
export type RecurrenceFrequency = "weekly" | "fortnightly" | "monthly";

/**
 * Auto-rebooking schedule attached to a CONFIRMED "template" job. A daily
 * Cloud Function (scheduledRecurringJobs) mints a fresh open copy whenever
 * `nextRunAt` falls due, advances `nextRunAt` by one interval, and (when
 * `inviteSameWorker`) re-invites the worker/crew who did it. The schedule lives
 * on the original job, NOT on the minted copies (so copies never recur
 * themselves). Stopping a schedule sets `active: false`.
 */
export type JobRecurrence = {
  frequency: RecurrenceFrequency;
  active: boolean;
  /** Epoch ms for the next mint. Floored to a day boundary so the morning run catches it. */
  nextRunAt: number;
  /** Re-invite the worker/crew from the template job on each minted copy. */
  inviteSameWorker: boolean;
  /** When the employer set the schedule up (epoch ms). */
  createdAt: number;
  /** How many copies have been minted so far. */
  count?: number;
  /** Last successful mint (epoch ms) + the job id it produced. */
  lastRunAt?: number;
  lastJobId?: string;
  /** When the schedule was stopped (epoch ms), if it was. */
  stoppedAt?: number;
};

export const RECURRENCE_OPTIONS: { id: RecurrenceFrequency; label: string }[] = [
  { id: "weekly", label: "Every week" },
  { id: "fortnightly", label: "Every 2 weeks" },
  { id: "monthly", label: "Every month" },
];

export function recurrenceLabel(freq: RecurrenceFrequency): string {
  return RECURRENCE_OPTIONS.find((o) => o.id === freq)?.label ?? freq;
}

/**
 * Add one recurrence interval to an epoch-ms instant and floor it to the start
 * of that day (UTC). Mirrored server-side in functions/src/recurring.ts — keep
 * the two in lockstep (the packages don't share code).
 */
export function nextRecurrenceAt(fromMs: number, freq: RecurrenceFrequency): number {
  const d = new Date(fromMs);
  if (freq === "weekly") d.setDate(d.getDate() + 7);
  else if (freq === "fortnightly") d.setDate(d.getDate() + 14);
  else {
    const day = d.getDate();
    d.setMonth(d.getMonth() + 1);
    if (d.getDate() < day) d.setDate(0); // clamp e.g. Jan 31 → last day of Feb
  }
  // Floor to UTC midnight so the early-morning SAST run always sees it as due.
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

export type Job = {
  id: string;
  employerId: string;
  employerName: string;
  employerPhotoURL?: string;
  /** True when the poster is a business account — job views link to the
   *  business profile (/business?id=employerId) instead of the personal one. */
  employerIsBusiness?: boolean;
  /** First 5 unique worker photo URLs that have offered — social proof. */
  offerWorkerPhotos?: string[];

  title: string;
  description: string;
  category: CategoryId;
  subcategory?: string;

  suggestedPrice: number;
  agreedPrice?: number;

  suburb: string;
  city: string;
  province: string;

  // Optional precise pin (set by employer at post time). Distance matching
  // on /find-work uses these when present.
  lat?: number;
  lng?: number;

  // Structured specs (all optional — older jobs simply don't have them)
  toolsProvided?: ToolsProvided;
  transportIncluded?: boolean;
  trainingProvided?: boolean;
  experienceLevel?: ExperienceLevel;
  /** Rough estimate in hours so the worker can plan their day. */
  estimatedHours?: number;
  /** Unit for the estimate above — "hours" (default) or "days". */
  estimatedUnit?: "hours" | "days";
  /** Hard deadline the employer wants the work completed by (epoch ms).
   *  Distinct from estimatedHours/Unit — that's "how long it takes once started",
   *  this is "when it must be done by". Optional; only shown when set. */
  dueAt?: number;
  /** How the employer plans to pay — cash on completion or EFT. */
  paymentMethod?: PaymentMethod;
  /** Optional preferred-worker hint (gender / age range). A soft preference
   *  shown to workers, NOT a hard filter — anyone may still offer. */
  workerPreference?: JobWorkerPreference;

  /** Employer can flag a job as urgent — it floats to the top of the feed
   *  and shows a brick-toned 🔥 badge on the card. */
  urgent?: boolean;

  /** Featured/boosted listing (monetization). While boostedUntil > now the job
   *  pins to the top of the find-work feed and shows a "Boosted" badge. Free
   *  during launch; set via boostJob(). */
  boostedUntil?: number;

  status: JobStatus;
  /** Single-worker: the assigned worker tapped "I'm on my way". Status stays
   *  "assigned" until they tap "Start", which flips it to "in_progress". */
  enRouteAt?: number;
  /** Doorstep handshake (Uber-style): when true, the worker must enter a 4-digit
   *  start code the employer reads out before the job can start. Confirms the
   *  right person is at the door + timestamps arrival. The code itself is NOT on
   *  this (world-readable) doc — it lives in the locked jobs/{id}/secure/start
   *  subcollection, fetched by the employer + verified by the worker via callables.
   *  Default on for new assignments; the employer can turn it off for jobs where
   *  they won't be present (e.g. gardening while at work, deliveries). */
  requireStartPin?: boolean;
  /** Single-worker: when the worker verified the start code (trustworthy arrival
   *  timestamp). Absent = started without code verification. */
  startVerifiedAt?: number;
  /** Worker UIDs the employer explicitly invited from a profile page. They
   *  get a special toast on creation + a star badge on the job card; anyone
   *  else can still offer normally. */
  invitedWorkerIds?: string[];
  /** Set on a copy made via "Book again" / recurring auto-schedule — the id of
   *  the job it was cloned from. Drives the "you've been invited back" push copy
   *  (vs a first-time profile invite). */
  rebookedFrom?: string;
  /** Set on copies minted by a recurring schedule — the template job's id. */
  recurrenceParent?: string;
  /** Auto-rebooking schedule. Only ever set on a CONFIRMED template job; minted
   *  copies never carry it. See JobRecurrence. */
  recurrence?: JobRecurrence;
  /** Server-side moderation gate. Default absent = cleared. When set to
   *  "pending_review" (e.g. first job from a new user, or a medium-confidence
   *  text-screening hit), the job is hidden from the public find-work feed
   *  until an admin reviews. "removed" = taken down. */
  moderationStatus?: "pending_review" | "removed";
  /** Why the moderationStatus was set — surfaced in admin queue. */
  moderationReason?: string;
  assignedWorkerId?: string;
  assignedWorkerName?: string;
  /** Denormalised so cards/dashboards can show the avatar without a second fetch. */
  assignedWorkerPhotoURL?: string;

  // ---------- MULTI-WORKER (crew) jobs ----------
  /** How many workers the employer needs. Default 1 (legacy single-worker job).
   *  Sensible cap enforced in the post form (currently 20). */
  workersNeeded?: number;
  /** Roster of accepted workers for a crew job. Each entry has its own lifecycle
   *  (assigned → in_progress → completed → confirmed), price, and optional ratings.
   *  Empty / undefined on legacy single-worker jobs. */
  assignedWorkers?: AssignedWorker[];
  /** Denormalized list of UIDs in `assignedWorkers` whose status is NOT "removed".
   *  Used by Firestore security rules — array-contains queries can only check
   *  primitives, so we maintain this in lockstep with `assignedWorkers`. */
  assignedWorkerIds?: string[];

  // Optional photos (employer attaches when posting; worker attaches on completion)
  photoURLs?: string[];
  completionPhotoURLs?: string[];

  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  /** When the job was first filled (first worker hired). Set once, on the first
   *  acceptOffer. Powers the admin "time-to-fill" growth metric. */
  assignedAt?: number;

  // Live activity counters (updated when offers are created)
  lastOfferAt?: number;
  offerCount?: number;

  // Live location shared by the assigned worker
  workerLocation?: {
    lat: number;
    lng: number;
    updatedAt: number;
  };
  workerLocationSharing?: boolean;

  // Messaging
  lastMessageAt?: number;
  messageCount?: number;

  // Public share token (so an employer can share live tracking with family)
  publicShareToken?: string;

  // Safety events. The legacy emergencyTriggeredBy/At are kept for back-compat;
  // `emergency` is the structured record the SOS button now writes — it carries
  // the GPS captured at the moment of the alert and an active/resolved status
  // the safety team works from.
  emergencyTriggeredBy?: string;
  emergencyTriggeredAt?: number;
  emergency?: EmergencyAlert;

  // Dispute (set when status === 'disputed', kept for history afterwards)
  dispute?: Dispute;

  // Ratings (filled after confirmed)
  employerRating?: { stars: number; text?: string; at: number };
  workerRating?: { stars: number; text?: string; at: number };

  /** Payment handshake (single-worker jobs; crew slots carry their own on the
   *  roster entry). Cash/EFT changes hands off-platform, so once the work is
   *  confirmed the employer taps "I've paid" (paymentPaidAt) and the worker
   *  taps "received" (paymentReceivedAt) — either order; the second tap sets
   *  paymentConfirmedAt and bumps both sides' tallies. Written ONLY by the
   *  confirmPayment callable (rules blacklist these for clients). */
  paymentPaidAt?: number;
  paymentReceivedAt?: number;
  paymentConfirmedAt?: number;
};

export type ChatMessage = {
  id: string;
  jobId: string;
  senderId: string;
  senderName: string;
  senderPhotoURL?: string;
  text: string;
  /** Optional image attachment (Storage download URL). Text may be empty when
   *  an image is sent on its own. */
  imageURL?: string;
  createdAt: number;
};

export type OfferStatus = "pending" | "accepted" | "rejected" | "withdrawn";

export type Offer = {
  id: string;
  jobId: string;
  workerId: string;
  workerName: string;
  workerPhotoURL?: string;
  workerRatingAvg?: number;
  workerRatingCount?: number;
  workerJobsCompleted?: number;
  backgroundVerified?: boolean;
  workerVerified?: boolean;
  workerBadges?: ReputationBadgeId[];

  price: number; // worker's price (may equal suggestedPrice = "accept")
  message?: string;
  status: OfferStatus;
  createdAt: number;
};
