/**
 * Short-lived access to verification documents (security audit 🟠 #3).
 *
 * New uploads persist the Storage PATH (not a tokenised download URL). This
 * callable — owner or admin only — returns the verification payload with each
 * document resolved to a ~15-minute signed URL. A leaked link therefore dies in
 * minutes instead of living forever. Legacy values that are already https URLs
 * (pre-migration uploads) pass through unchanged.
 *
 * Requires the function's service account to hold roles/iam.serviceAccountTokenCreator
 * on itself (signBlob) — granted via gcloud during setup.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { requireCan } from "./perms";

type AnyDoc = Record<string, unknown>;

const DOC_FIELDS = ["idPhotoURL", "selfieVideoURL", "addressProofURL", "policeClearanceURL"] as const;
const SIGN_TTL_MS = 15 * 60 * 1000;

async function resolveOne(value: unknown): Promise<string | null> {
  if (typeof value !== "string" || !value) return null;
  if (value.startsWith("http")) return value; // legacy tokenised URL
  try {
    const [signed] = await getStorage()
      .bucket()
      .file(value)
      .getSignedUrl({ action: "read", expires: Date.now() + SIGN_TTL_MS });
    return signed;
  } catch (err) {
    logger.warn("signing failed", { path: value, err: String(err) });
    return null;
  }
}

export const getVerificationPayload = onCall({ timeoutSeconds: 60 }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in.");
  const db = getFirestore();

  const requested = String(req.data?.uid ?? req.auth.uid);
  if (requested !== req.auth.uid) {
    // RBAC phase 2: viewing someone else's ID documents is the
    // verification.review capability (ADMIN_ROLES.md's crown jewel #1).
    await requireCan(req.auth, "verification.review");
    // Viewing someone else's ID documents is the most sensitive admin action —
    // require the admin's session to have passed two-step verification.
    if (!req.auth.token.firebase?.sign_in_second_factor) {
      throw new HttpsError(
        "permission-denied",
        "Set up two-step verification and sign in again to view ID documents.",
      );
    }
    // RBAC phase 3 (POPIA — PII access logging, ADMIN_ROLES.md §5): record EVERY
    // view of an ID document, not just actions. Immutable, admin-read-only,
    // server-write-only (see idDocAccessLog in firestore.rules). Deters +
    // detects misuse of special personal information. Awaited so the record is
    // durable; a logging failure is surfaced in Cloud Logging but must not
    // block a legitimate review.
    try {
      await db.collection("idDocAccessLog").add({
        adminUid: req.auth.uid,
        adminRole: (req.auth.token.adminRole as string | undefined) ?? "legacy-admin",
        targetUid: requested,
        at: Date.now(),
      });
    } catch (err) {
      logger.error("idDocAccessLog write failed", { adminUid: req.auth.uid, targetUid: requested, err: String(err) });
    }
  }

  const priv = await db.doc(`users/${requested}/private/profile`).get();
  const v = (priv.exists ? (priv.data() as AnyDoc).verification : {}) as AnyDoc | undefined;
  if (!v) return { verification: {} };

  const out: AnyDoc = {
    idNumber: v.idNumber ?? null,
    addressLine: v.addressLine ?? null,
    skillsSummary: v.skillsSummary ?? null,
    // Automated SA ID check summary (no signed URLs — plain data).
    idCheck: v.idCheck ?? null,
    // Server-computed fraud signals (duplicates / under-18 / OCR / ban match).
    fraud: v.fraud ?? null,
  };
  for (const f of DOC_FIELDS) out[f] = await resolveOne(v[f]);
  const skillProofs = Array.isArray(v.skillProofURLs) ? v.skillProofURLs : [];
  out.skillProofURLs = (await Promise.all(skillProofs.map(resolveOne))).filter(Boolean);

  return { verification: out };
});
