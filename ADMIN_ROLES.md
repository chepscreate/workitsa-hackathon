# Workit — Admin Roles & Permissions (design + implementation sketch)

_Drafted 2026-06-16. Not yet built — this is the plan to implement just before
the first non-founder admin is hired. Owner: Tshepo M._

## Why
Today "admin" is **binary**: `users/{uid}.role == "admin"` grants *everything*
(approve, view ID docs, resolve disputes, moderate, erase accounts, broadcast).
Fine for two founders; dangerous the moment a support agent or reviewer joins.
This moves Workit to **role-based access control (RBAC) with least privilege**:
each person gets only the capabilities their job needs.

The two crown jewels — **viewing ID documents** (POPIA special personal
information) and **erasing accounts** (irreversible) — stay locked to the fewest
people.

---

## 1. Roles

| Role | Capabilities | Notably cannot |
|------|--------------|----------------|
| **owner** | Everything, incl. assign roles, erase, broadcast | — |
| **operations** | approvals, verification (+ID docs), business verify, disputes, support, suspend, analytics, audit | erase, manage roles, broadcast |
| **verification** | verification queue + view ID docs, read users | disputes, moderation, support, erase, broadcast |
| **support** | WhatsApp support inbox, read users (contact only, ID masked) | view ID docs, approve/verify, erase, broadcast |
| **moderator** | reports + flags, warn/suspend, remove content, analytics | view ID docs, erase, broadcast |
| **analyst** | dashboard, analytics, heatmap (read-only) | any action |

> Pragmatic first cut: build the framework + **owner** and **operations** only
> (what exists today), then add the narrower roles as you actually hire for them.

## 2. Capabilities (permissions)

A role is just a bundle of these discrete permissions, so one person can be
fine-tuned without inventing a new role:

```
approvals.manage   verification.review   business.verify   disputes.resolve
moderation.act     support.respond       users.read        users.suspend
users.erase        broadcast.send        analytics.view    audit.view
roles.manage
```

`verification.review` is the one that unlocks ID-document viewing.
`users.erase`, `broadcast.send`, `roles.manage` are owner-only by default.

## 3. Role → permission matrix (source of truth, in code)

```ts
// src/lib/roles.ts (shared by app + functions)
export const PERMISSIONS = [
  "approvals.manage","verification.review","business.verify","disputes.resolve",
  "moderation.act","support.respond","users.read","users.suspend","users.erase",
  "broadcast.send","analytics.view","audit.view","roles.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];
export type AdminRole =
  "owner" | "operations" | "verification" | "support" | "moderator" | "analyst";

export const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  owner:        [...PERMISSIONS],                       // all
  operations:   ["approvals.manage","verification.review","business.verify",
                 "disputes.resolve","support.respond","users.read",
                 "users.suspend","analytics.view","audit.view"],
  verification: ["verification.review","users.read"],
  support:      ["support.respond","users.read"],
  moderator:    ["moderation.act","users.read","users.suspend","analytics.view"],
  analyst:      ["analytics.view"],
};
export const hasPerm = (perms: Record<string, boolean> | undefined, p: Permission) =>
  !!perms?.[p];
```

---

## 4. How it's enforced — defence in depth

Security cannot live only in the UI. Three layers, same approach as the MFA work:

### (a) Where roles live — Firestore + custom claims (hybrid)
- **Source of truth:** `users/{uid}.adminRole` (absent = not an admin). Editable
  from an admin screen.
- **Mirror to Firebase custom claims** so rules + callables can check fast,
  without an extra document read: token carries
  `{ admin: true, adminRole, perms: { "users.erase": true, ... } }`.
  (A ~13-boolean map is well under the 1000-byte claim limit.)

### (b) The role-management callable (owner-only)
```ts
// functions/src/adminRoles.ts (sketch)
export const setAdminRole = onCall(async (req) => {
  requirePerm(req, "roles.manage");          // caller is owner
  requireSecondFactor(req);                  // + 2FA session
  const { uid, role } = validate(req.data);  // role in AdminRole | null
  const perms = role ? toPermMap(ROLE_PERMISSIONS[role]) : {};
  await db.doc(`users/${uid}`).set({ adminRole: role ?? FieldValue.delete() }, { merge: true });
  await getAuth().setCustomUserClaims(uid, role ? { admin: true, adminRole: role, perms } : null);
  await getAuth().revokeRefreshTokens(uid);  // change takes effect on next sign-in
  await audit("role_changed", { targetUid: uid, role });
});
```
Revoking refresh tokens means the grant/revoke is **near-immediate** — the
target must sign in again (and their token then carries the new perms). Same
re-sign-in pattern as enabling MFA.

### (c) Firestore rules check the claim
```
function perm(p) {
  return isSignedIn()
    && 'perms' in request.auth.token
    && p in request.auth.token.perms
    && request.auth.token.perms[p] == true;
}
// e.g. private ID-doc read:
allow read: if isSelf(uid) || (perm('verification.review') && usedSecondFactor());
```
(`isAdmin()` stays as a coarse "any admin role" check where granularity isn't
needed; granular surfaces switch to `perm(...)`.)

### (d) Callables check the permission
```ts
function requirePerm(req, p) {
  if (!req.auth?.token?.perms?.[p])
    throw new HttpsError("permission-denied", `Needs ${p}.`);
}
// eraseUserData → requirePerm(req,"users.erase"); sendBroadcast → "broadcast.send"; etc.
```

### (e) UI gates by capability
- `AuthContext` reads perms from the ID token (`getIdTokenResult`) → exposes
  `can(permission)`.
- `AdminShell` filters nav items by the permission each tab needs.
- Buttons/actions render only if `can(...)`. (Cosmetic — real gate is (c)/(d).)

---

## 5. Safeguards (governance)

- **Least privilege + default-deny** — new hires start with no role; grant up.
- **Named accounts, never shared** — keeps the audit log truthful.
- **MFA mandatory for every admin role** (extend current enforcement to all).
- **Separation of duties** — erase stays owner-only; keep the deletion-request →
  action split (maker-checker) for erasures.
- **PII access logging (POPIA)** — log every *view* of an ID document, not just
  actions: `getVerificationPayload` writes `idDocAccessLog/{auto}` =
  `{ adminUid, targetUid, at }`. Deters + detects misuse; expected for special
  personal information.
- **Data minimisation** — support sees name/contact with ID number masked; only
  `verification.review` sees full docs.
- **Immediate revocation on offboarding** — `setAdminRole(uid, null)` +
  `revokeRefreshTokens` kills access at once.
- **Periodic access review** — quarterly "who has what, still needed?".
- **Anomaly alerts** — flag unusual ID-doc view volume or bulk erasures (reuse
  the Jarvis alert pattern).
- **Operational** — confidentiality undertaking + short POPIA briefing for
  anyone touching PII (tie to `ADMIN_GUIDE.md`); all operate under the
  registered Information Officer (Tshepo).

## 6. Audit additions
Add audit actions: `role_changed`, `role_removed`, plus the `idDocAccessLog`
collection (admin-read, server-write-only, immutable). Register labels in
`src/lib/audit.ts` `describeAction`.

## 7. Rules + tests
- New rules: `idDocAccessLog` (admin-read, server-write). Tighten granular
  surfaces from `isAdmin()` → `perm(...)`.
- Extend `tests/rules/firestore.rules.test.ts`: a context per role
  (`authenticatedContext(uid, { perms: {...} })`) asserting each capability is
  allowed/denied correctly — same claim-injection trick already used for the
  2FA tests.

## 8. Phased rollout
1. **Foundation** — `roles.ts`, `setAdminRole`/`removeAdmin` callables, custom-
   claim mirror, "Manage admins" screen (owner-only). Migrate Tshepo→owner,
   Simphiwe→operations.
2. **Enforce** — convert rules, callables, and admin-tab visibility from binary
   `role==admin` to `perm(...)`.
3. **PII hardening** — ID-doc access logging + masking for lower roles.
4. **Lifecycle + monitoring** — revocation flow, access-review view, anomaly
   alerts.

Build **#1 and #2 just before the first non-founder admin joins**, so nobody
ever holds more power than their role for even a day.

## 9. Open decisions
- Final role list (start with owner + operations; confirm the rest when hiring).
- Whether erasure needs two-person approval (recommended) or owner-only is enough.
- ID-doc access-log retention (suggest the same 5-year window as other records).
