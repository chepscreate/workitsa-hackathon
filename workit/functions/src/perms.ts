/**
 * RBAC phase 2 — callable-side permission gate (ADMIN_ROLES.md §4d).
 *
 * Same hybrid semantics as the Firestore rules `can()`:
 *   - a token carrying an adminRole claim is judged ONLY by its perms map;
 *   - a legacy binary admin WITHOUT a role claim passes (no-lockout
 *     migration — retires by itself once both founders are role-tagged).
 *
 * Accepts several permissions: any one of them satisfies the gate (e.g. the
 * docs-reminder email is legitimate for approvals.manage OR
 * verification.review).
 */
import { HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

type CallableAuth = {
  uid: string;
  token: { adminRole?: string; perms?: Record<string, boolean> } & Record<string, unknown>;
};

export async function requireCan(
  auth: CallableAuth | undefined | null,
  ...permissions: string[]
): Promise<void> {
  if (!auth) throw new HttpsError("unauthenticated", "Sign in.");
  const perms = auth.token.perms;
  if (permissions.some((p) => perms?.[p] === true)) return;
  if (!auth.token.adminRole) {
    // Untagged legacy admin — migration bootstrap.
    const me = await getFirestore().doc(`users/${auth.uid}`).get();
    if (me.exists && me.data()?.role === "admin") return;
  }
  throw new HttpsError(
    "permission-denied",
    `Your admin role doesn't include ${permissions.join(" / ")}.`,
  );
}
