/**
 * RBAC phase 1 — the role → permission matrix (source of truth, per
 * ADMIN_ROLES.md). Mirrored in functions/src/adminRoles.ts (the packages
 * don't share code — keep the two in lockstep).
 *
 * Phase 1 = FOUNDATION only: roles exist, the owner can assign them, and the
 * token carries the perms claim. Enforcement (rules + callables + tab
 * visibility switching from binary `role=="admin"` to `perm(...)`) is
 * phase 2 — see ADMIN_ROLES.md §8.
 */

export const PERMISSIONS = [
  "approvals.manage", "verification.review", "business.verify", "disputes.resolve",
  "moderation.act", "support.respond", "users.read", "users.suspend", "users.erase",
  "broadcast.send", "analytics.view", "audit.view", "roles.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export type AdminRole =
  | "owner" | "operations" | "verification" | "support" | "moderator" | "analyst";

export const ADMIN_ROLES: AdminRole[] = [
  "owner", "operations", "verification", "support", "moderator", "analyst",
];

export const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  owner:        [...PERMISSIONS],                       // all
  operations:   ["approvals.manage", "verification.review", "business.verify",
                 "disputes.resolve", "support.respond", "users.read",
                 "users.suspend", "analytics.view", "audit.view"],
  verification: ["verification.review", "users.read"],
  support:      ["support.respond", "users.read"],
  moderator:    ["moderation.act", "users.read", "users.suspend", "analytics.view"],
  analyst:      ["analytics.view"],
};

export const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  owner: "Everything, incl. assign roles, erase accounts, broadcast",
  operations: "Approvals, verification + ID docs, disputes, support, suspend",
  verification: "Verification queue + ID docs only",
  support: "WhatsApp support inbox + contact details only",
  moderator: "Reports & flags, warn/suspend, remove content",
  analyst: "Dashboards read-only — no actions",
};

export const hasPerm = (
  perms: Record<string, boolean> | undefined,
  p: Permission,
): boolean => !!perms?.[p];
