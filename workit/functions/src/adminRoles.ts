/**
 * RBAC phase 1 — the owner-only role-management callable (ADMIN_ROLES.md §4b).
 *
 * setAdminRole assigns (or removes) an admin role on a user:
 *   - writes users/{uid}.adminRole (source of truth), and
 *   - mirrors { admin, adminRole, perms } into Firebase custom claims so
 *     phase-2 rules/callables can check the token without a doc read, then
 *   - revokes the target's refresh tokens — the change lands on their next
 *     sign-in (same re-sign-in pattern as MFA enrolment).
 *
 * Caller gate: `roles.manage` perm — with a BOOTSTRAP allowance: until claims
 * exist, legacy binary admins (users/{uid}.role == "admin") may manage roles.
 * Phase 2 tightens this to the claim only. A 2FA session is required either
 * way, and callers can never change their own role (no self-demotion
 * accidents, no self-escalation).
 *
 * The matrix below mirrors src/lib/roles.ts — keep the two in lockstep.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const PERMISSIONS = [
  "approvals.manage", "verification.review", "business.verify", "disputes.resolve",
  "moderation.act", "support.respond", "users.read", "users.suspend", "users.erase",
  "broadcast.send", "analytics.view", "audit.view", "roles.manage",
] as const;

const ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  owner:        PERMISSIONS,
  operations:   ["approvals.manage", "verification.review", "business.verify",
                 "disputes.resolve", "support.respond", "users.read",
                 "users.suspend", "analytics.view", "audit.view"],
  verification: ["verification.review", "users.read"],
  support:      ["support.respond", "users.read"],
  moderator:    ["moderation.act", "users.read", "users.suspend", "analytics.view"],
  analyst:      ["analytics.view"],
};

type AnyDoc = Record<string, unknown>;

export const setAdminRole = onCall({ timeoutSeconds: 30 }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in.");
  // Role grants are crown-jewel territory — require a 2FA'd session.
  if (!req.auth.token.firebase?.sign_in_second_factor) {
    throw new HttpsError(
      "permission-denied",
      "Set up two-step verification and sign in again to manage admin roles.",
    );
  }

  const db = getFirestore();
  const me = await db.doc(`users/${req.auth.uid}`).get();
  const meData = (me.data() ?? {}) as AnyDoc;
  const token = req.auth.token as { perms?: Record<string, boolean>; adminRole?: string };
  const canManage =
    token.perms?.["roles.manage"] === true
    // Bootstrap: an UNTAGGED legacy binary admin may manage roles — once a
    // person carries an adminRole claim, only their perms count (phase 2
    // semantics; an "operations" admin can no longer grant roles).
    || (!token.adminRole && meData.role === "admin");
  if (!canManage) throw new HttpsError("permission-denied", "Needs roles.manage.");

  const uid = String(req.data?.uid ?? "").trim();
  const role: string | null = req.data?.role == null ? null : String(req.data.role);
  if (!uid) throw new HttpsError("invalid-argument", "uid required.");
  if (role !== null && !(role in ROLE_PERMISSIONS)) {
    throw new HttpsError("invalid-argument", `Unknown role "${role}".`);
  }
  if (uid === req.auth.uid) {
    throw new HttpsError(
      "failed-precondition",
      "You can't change your own role — ask the other owner.",
    );
  }

  const target = await db.doc(`users/${uid}`).get();
  if (!target.exists) throw new HttpsError("not-found", "No such user.");
  const targetData = (target.data() ?? {}) as AnyDoc;

  const perms = role
    ? Object.fromEntries(ROLE_PERMISSIONS[role].map((p) => [p, true]))
    : null;

  await db
    .doc(`users/${uid}`)
    .set({ adminRole: role ?? FieldValue.delete() }, { merge: true });
  await getAuth().setCustomUserClaims(
    uid,
    role ? { admin: true, adminRole: role, perms } : null,
  );
  // Change takes effect on the target's NEXT sign-in — near-immediate revoke.
  await getAuth().revokeRefreshTokens(uid);

  await db.collection("auditLog").add({
    action: role ? "role_changed" : "role_removed",
    adminUid: req.auth.uid,
    adminName: String(meData.displayName ?? "Admin"),
    targetUid: uid,
    targetName: String(targetData.displayName ?? "user"),
    note: role ? `admin role → ${role}` : "admin role removed",
    at: Date.now(),
  });
  logger.info("Admin role changed", { by: req.auth.uid, target: uid, role });

  return { ok: true, role };
});
