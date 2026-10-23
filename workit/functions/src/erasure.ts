/**
 * POPIA erasure — actioned by the admin against a pending deletion request.
 *
 * What it does (honouring the privacy policy's "deleted within 30 days"):
 *  - Storage: deletes verification/{uid}, avatars/{uid}, portfolio/{uid}.
 *  - Firestore: deletes the private doc + per-user subcollections (saved,
 *    searches, templates, fcmTokens, leads) and REPLACES the public profile
 *    with an anonymised skeleton ("Deleted user") so old jobs/ratings keep a
 *    valid reference for the 5-year dispute/legal record.
 *  - Auth: deletes the Firebase Auth account (they can no longer sign in).
 *  - Marks the request completed + writes an auditLog entry.
 *
 * Deliberately a callable (explicit admin action with confirmation in the UI),
 * not a Firestore trigger — erasure should never happen as a side effect.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAuth } from "firebase-admin/auth";
import { requireCan } from "./perms";

type AnyDoc = Record<string, unknown>;

const SUBCOLLECTIONS = ["private", "saved", "searches", "templates", "fcmTokens", "leads"];
const STORAGE_PREFIXES = ["verification", "avatars", "portfolio"];

export const eraseUserData = onCall({ timeoutSeconds: 300, memory: "512MiB" }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in.");
  // RBAC phase 2: erasure is the users.erase capability — owner-only in the
  // role matrix. (Untagged legacy admins pass until both founders are tagged.)
  await requireCan(req.auth, "users.erase");
  const db = getFirestore();
  const me = await db.collection("users").doc(req.auth.uid).get();
  // Permanent erasure is irreversible — require a two-step-verified session.
  if (!req.auth.token.firebase?.sign_in_second_factor) {
    throw new HttpsError(
      "permission-denied",
      "Set up two-step verification and sign in again to erase an account.",
    );
  }
  const adminName = String((me.data() as AnyDoc | undefined)?.displayName ?? "Admin");

  const requestId = String(req.data?.requestId ?? "").trim();
  if (!requestId) throw new HttpsError("invalid-argument", "requestId required.");

  const reqRef = db.collection("deletionRequests").doc(requestId);
  const reqSnap = await reqRef.get();
  if (!reqSnap.exists) throw new HttpsError("not-found", "No such deletion request.");
  const reqData = reqSnap.data() as AnyDoc;
  if (reqData.status !== "pending") {
    throw new HttpsError("failed-precondition", `Request is already ${reqData.status}.`);
  }
  const uid = String(reqData.uid ?? "");
  if (!uid) throw new HttpsError("failed-precondition", "Request has no uid.");
  if (uid === req.auth.uid) {
    throw new HttpsError("failed-precondition", "Refusing to erase the acting admin.");
  }
  const targetSnap = await db.collection("users").doc(uid).get();
  if (targetSnap.exists && (targetSnap.data() as AnyDoc).role === "admin") {
    throw new HttpsError("failed-precondition", "Refusing to erase an admin account.");
  }

  const targetName = targetSnap.exists
    ? String((targetSnap.data() as AnyDoc).displayName ?? "user")
    : "user";
  const issues: string[] = [];

  // 1) Storage — wipe the user's folders.
  const bucket = getStorage().bucket();
  for (const prefix of STORAGE_PREFIXES) {
    try {
      await bucket.deleteFiles({ prefix: `${prefix}/${uid}/` });
    } catch (err) {
      issues.push(`storage ${prefix}: ${String(err)}`);
    }
  }

  // 2) Firestore subcollections (incl. the private PII doc).
  for (const sub of SUBCOLLECTIONS) {
    try {
      const docs = await db.collection(`users/${uid}/${sub}`).listDocuments();
      for (const ref of docs) await ref.delete();
    } catch (err) {
      issues.push(`subcollection ${sub}: ${String(err)}`);
    }
  }

  // 3) Replace the public profile with an anonymised skeleton (full overwrite —
  //    everything not listed here is gone). Jobs/ratings keep working because
  //    they denormalise names; this doc remains as a tombstone reference.
  try {
    const old = (targetSnap.data() ?? {}) as AnyDoc;
    await db.collection("users").doc(uid).set({
      uid,
      displayName: "Deleted user",
      role: old.role ?? "worker",
      accountStatus: "suspended",
      createdAt: old.createdAt ?? null,
      deletedAt: Date.now(),
    });
  } catch (err) {
    issues.push(`profile scrub: ${String(err)}`);
  }

  // 4) Auth account — they can no longer sign in.
  try {
    await getAuth().deleteUser(uid);
  } catch (err) {
    // Already deleted / never existed is fine.
    if (!String(err).includes("no user record")) issues.push(`auth: ${String(err)}`);
  }

  // 5) Close the request + audit trail.
  await reqRef.update({
    status: "completed",
    completedAt: Date.now(),
    completedBy: req.auth.uid,
    ...(issues.length ? { issues } : {}),
  });
  await db.collection("auditLog").add({
    adminUid: req.auth.uid,
    adminName,
    action: "account_erased",
    targetUid: uid,
    targetName,
    note: issues.length ? `Completed with ${issues.length} issue(s) — see request doc.` : undefined,
    via: "erasure",
    at: Date.now(),
    atServer: FieldValue.serverTimestamp(),
  });

  logger.info("user erased", { uid, requestId, issues: issues.length });
  return { ok: true, issues };
});
