/**
 * Text screening for job posts and user profile updates.
 *
 * Runs a small regex blocklist against title + description + bio + tagline +
 * qualifications text. Three outcomes based on the highest-severity match:
 *
 *   - high   → job: moderationStatus="removed" + flag; user: flagged for ban review
 *   - medium → job: moderationStatus="pending_review" + flag (hidden from feed)
 *   - low    → no auto-action, just a flag for spot-check
 *
 * Lists are deliberately conservative. Add SA-specific slang here over time
 * — easier to tune than the rest of the system.
 */

import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

type Severity = "low" | "medium" | "high";

type Rule = { pattern: RegExp; severity: Severity; label: string };

/** SA-specific blocklist. Word boundaries + case-insensitive everywhere. */
const RULES: Rule[] = [
  // ---- HIGH SEVERITY (auto-remove + flag) ----
  // CSAM-adjacent — never anything close to underage + sexual.
  { pattern: /\b(child|kid|minor|underage|teen|young\s*girl|young\s*boy)\b.*\b(sex|escort|massage|nude|naked)\b/i, severity: "high", label: "underage + sexual" },
  // Hard drugs by name in sales context.
  { pattern: /\b(mandrax|nyaope|whoonga|tik|heroin|crystal\s*meth|crack)\b.*(sell|selling|for\s*sale|buy|R\d|r\s*\d)/i, severity: "high", label: "hard drug + sale context" },
  { pattern: /\b(sell|selling|for\s*sale|deliver|delivery|drop\s*off)\b.*\b(mandrax|nyaope|whoonga|tik|heroin|cocaine|coke|crack)\b/i, severity: "high", label: "drug sale" },
  // Firearms for sale (excluding obvious legit cases — gunsmith etc.).
  { pattern: /\b(sell|selling|for\s*sale|cheap|unlicensed|untraceable)\b.*\b(firearm|gun|pistol|rifle|handgun|ammunition|ammo)\b/i, severity: "high", label: "firearm sale" },
  // Money-mule / cash-mule patterns.
  { pattern: /\b(receive|collect|forward|transfer)\b.*\b(cash|funds|deposits?|payments?)\b.*\b(commission|cut|keep|fee)\b/i, severity: "high", label: "money mule" },
  // Threats / intimidation hire.
  { pattern: /\b(hire|need|looking\s*for)\b.*\b(hitman|beat|hurt|harm|intimidate|kill)\b/i, severity: "high", label: "violence hire" },

  // ---- MEDIUM SEVERITY (hold for admin review) ----
  // "No questions asked" + moving things — classic stolen-goods phrasing.
  { pattern: /no\s*questions\s*asked/i, severity: "medium", label: "no questions asked" },
  { pattern: /\b(discreet|discrete)\b.*(collection|delivery|moving|pickup|drop)/i, severity: "medium", label: "discreet movement" },
  // Sexual services without "sex" but with red-flag phrases.
  { pattern: /\b(escort|companionship)\b.*(evening|night|hotel|paid|R\d|hourly)/i, severity: "medium", label: "escort phrasing" },
  { pattern: /\bhappy\s*ending\b/i, severity: "medium", label: "happy ending" },
  { pattern: /\b(massage)\b.*\b(full\s*service|sensual|tantric|erotic|nuru)\b/i, severity: "medium", label: "sexual massage" },
  // Pay-to-apply scams.
  { pattern: /\b(registration\s*fee|application\s*fee|deposit\s*before|pay\s*to\s*apply)\b/i, severity: "medium", label: "pay-to-apply" },
  { pattern: /\b(send|share|provide)\b.*\b(bank|banking|account|card)\b.*\b(details|number|info)\b/i, severity: "medium", label: "banking details request" },
  // Fake placement agencies.
  { pattern: /\b(placement|agency|recruitment)\b.*\b(fee|R\s*\d{2,}|guaranteed\s*job)\b/i, severity: "medium", label: "placement fee" },
  // Multi-level marketing recruiting framed as a job.
  { pattern: /\b(passive\s*income|recruit\s*\d|matrix|downline|pyramid)\b/i, severity: "medium", label: "MLM" },
  // Crypto / investment "jobs".
  { pattern: /\b(forex|crypto|bitcoin|btc|investment)\b.*\b(guaranteed|double|profits?\s*daily|R\s*\d{4,}\s*per)/i, severity: "medium", label: "crypto investment" },

  // ---- LOW SEVERITY (flag only, no block) ----
  { pattern: /\b(stolen|hot|fell\s*off\s*the\s*truck)\b/i, severity: "low", label: "stolen goods slang" },
  { pattern: /\b(dagga|weed|zol|joint)\b.*\b(sell|delivery)\b/i, severity: "low", label: "cannabis context" },
];

const severityRank: Record<Severity, number> = { low: 1, medium: 2, high: 3 };

function screen(text: string): { hits: Rule[]; max: Severity | null } {
  if (!text || text.length === 0) return { hits: [], max: null };
  const hits = RULES.filter((r) => r.pattern.test(text));
  if (hits.length === 0) return { hits, max: null };
  const max = hits.reduce<Severity>((acc, r) => (severityRank[r.severity] > severityRank[acc] ? r.severity : acc), "low");
  return { hits, max };
}

async function writeFlag(opts: {
  kind: "text_screen";
  targetType: "job" | "user";
  targetId: string;
  reason: string;
  severity: Severity;
  autoActioned: boolean;
}) {
  await getFirestore().collection("moderation").add({
    kind: opts.kind,
    targetType: opts.targetType,
    targetId: opts.targetId,
    reason: opts.reason,
    severity: opts.severity,
    createdAt: Date.now(),
    autoActioned: opts.autoActioned,
  });
}

// ---------- JOB CREATE ----------

export const onJobCreatedTextScreen = onDocumentCreated(
  "jobs/{jobId}",
  async (event) => {
    const job = event.data?.data() as
      | { title?: string; description?: string; suburb?: string }
      | undefined;
    if (!job) return;
    const text = [job.title, job.description, job.suburb].filter(Boolean).join(" \n ");
    const { hits, max } = screen(text);
    if (!max) return;

    const reason = `Matched: ${hits.map((h) => h.label).join(", ")}`;
    const jobRef = getFirestore().doc(`jobs/${event.params.jobId}`);

    if (max === "high") {
      await jobRef.update({
        moderationStatus: "removed",
        moderationReason: reason,
      });
      await writeFlag({
        kind: "text_screen",
        targetType: "job",
        targetId: event.params.jobId,
        reason: `[HIGH] ${reason}`,
        severity: "high",
        autoActioned: true,
      });
      logger.warn("Auto-removed job for high-severity text", { jobId: event.params.jobId, reason });
    } else if (max === "medium") {
      await jobRef.update({
        moderationStatus: "pending_review",
        moderationReason: reason,
      });
      await writeFlag({
        kind: "text_screen",
        targetType: "job",
        targetId: event.params.jobId,
        reason: `[MEDIUM] ${reason}`,
        severity: "medium",
        autoActioned: true,
      });
      logger.info("Held job for review (medium-severity text)", { jobId: event.params.jobId, reason });
    } else {
      await writeFlag({
        kind: "text_screen",
        targetType: "job",
        targetId: event.params.jobId,
        reason: `[LOW] ${reason}`,
        severity: "low",
        autoActioned: false,
      });
    }
  },
);

// ---------- USER PROFILE UPDATE ----------

export const onUserProfileTextScreen = onDocumentUpdated(
  "users/{uid}",
  async (event) => {
    const before = event.data?.before.data() as Record<string, unknown> | undefined;
    const after = event.data?.after.data() as Record<string, unknown> | undefined;
    if (!after) return;

    // Only re-screen when one of the text-bearing fields actually changed.
    const fields = ["bio", "tagline", "displayName"] as const;
    const qualsChanged = JSON.stringify(before?.qualifications) !== JSON.stringify(after.qualifications);
    if (!qualsChanged && fields.every((f) => before?.[f] === after[f])) return;

    const text = [
      after.bio,
      after.tagline,
      after.displayName,
      ...(Array.isArray(after.qualifications)
        ? (after.qualifications as Array<{ title?: string; issuer?: string }>).map(
            (q) => `${q.title ?? ""} ${q.issuer ?? ""}`,
          )
        : []),
    ]
      .filter(Boolean)
      .join(" \n ");
    const { hits, max } = screen(text);
    if (!max) return;

    const reason = `Profile text: ${hits.map((h) => h.label).join(", ")}`;
    const userRef = getFirestore().doc(`users/${event.params.uid}`);

    if (max === "high") {
      await userRef.update({ accountStatus: "suspended" });
      await writeFlag({
        kind: "text_screen",
        targetType: "user",
        targetId: event.params.uid,
        reason: `[HIGH] ${reason}`,
        severity: "high",
        autoActioned: true,
      });
      logger.warn("Auto-suspended user for high-severity profile text", { uid: event.params.uid, reason });
    } else {
      await writeFlag({
        kind: "text_screen",
        targetType: "user",
        targetId: event.params.uid,
        reason: `[${max.toUpperCase()}] ${reason}`,
        severity: max,
        autoActioned: false,
      });
    }
    void FieldValue; // (kept import for future use, satisfies linter)
  },
);
