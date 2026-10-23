/**
 * One-off migration: move the sensitive verification payload off the
 * world-readable users/{uid} doc into users/{uid}/private/profile.
 *
 * Run once (admin-only) after deploying the private-subcollection rules + the
 * updated client. Idempotent — re-running finds nothing left to move.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

type AnyDoc = Record<string, unknown>;

// The sensitive subfields of `verification` that must NOT live on the public doc.
const PAYLOAD_KEYS = [
  "idNumber",
  "idPhotoURL",
  "selfieVideoURL",
  "addressLine",
  "addressProofURL",
  "skillsSummary",
  "skillProofURLs",
  "policeClearanceURL",
];

export const migrateVerificationToPrivate = onCall(
  { timeoutSeconds: 300, memory: "512MiB" },
  async (req) => {
    if (!req.auth) throw new HttpsError("unauthenticated", "Sign in.");
    const db = getFirestore();
    const me = await db.collection("users").doc(req.auth.uid).get();
    if (!me.exists || (me.data() as AnyDoc).role !== "admin") {
      throw new HttpsError("permission-denied", "Admins only.");
    }

    const snap = await db.collection("users").get();
    let scanned = 0;
    let moved = 0;
    for (const d of snap.docs) {
      scanned++;
      const data = d.data() as AnyDoc;
      const priv: AnyDoc = {};
      const updates: AnyDoc = {};

      // --- Phase A: verification payload ---
      const v = data.verification as AnyDoc | undefined;
      if (v && typeof v === "object") {
        const payload: AnyDoc = {};
        for (const k of PAYLOAD_KEYS) {
          if (v[k] !== undefined) {
            payload[k] = v[k];
            updates[`verification.${k}`] = FieldValue.delete();
          }
        }
        if (Object.keys(payload).length > 0) priv.verification = payload;
      }

      // --- Phase B: exact home coords + DOB → private, derived → public ---
      if (typeof data.homeLat === "number" && typeof data.homeLng === "number") {
        priv.homeLat = data.homeLat;
        priv.homeLng = data.homeLng;
        if (data.homeAccuracy !== undefined) priv.homeAccuracy = data.homeAccuracy;
        if (data.homePinnedAt !== undefined) priv.homePinnedAt = data.homePinnedAt;
        // Public keeps only ~1 km rounded coords for the workers directory.
        updates.approxLat = Math.round((data.homeLat as number) * 100) / 100;
        updates.approxLng = Math.round((data.homeLng as number) * 100) / 100;
        updates.homeLat = FieldValue.delete();
        updates.homeLng = FieldValue.delete();
        updates.homeAccuracy = FieldValue.delete();
        updates.homePinnedAt = FieldValue.delete();
      }
      if (typeof data.dateOfBirth === "string" && data.dateOfBirth) {
        priv.dateOfBirth = data.dateOfBirth;
        const year = new Date(data.dateOfBirth as string).getFullYear();
        if (Number.isFinite(year)) updates.birthYear = year;
        updates.dateOfBirth = FieldValue.delete();
      }

      if (Object.keys(priv).length === 0 && Object.keys(updates).length === 0) continue;

      if (Object.keys(priv).length > 0) {
        await db.doc(`users/${d.id}/private/profile`).set(priv, { merge: true });
      }
      if (Object.keys(updates).length > 0) {
        await d.ref.update(updates);
      }
      moved++;
    }

    logger.info("PII→private migration complete (verification + home + DOB)", { scanned, moved });
    return { ok: true, scanned, moved };
  },
);
