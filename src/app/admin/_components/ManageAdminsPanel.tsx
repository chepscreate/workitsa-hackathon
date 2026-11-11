"use client";

import { useCallback, useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getDb, getFunctionsInstance } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import Button from "@/components/Button";
import Badge from "@/components/Badge";
import Avatar from "@/components/Avatar";
import { ADMIN_ROLES, ROLE_DESCRIPTIONS, type AdminRole } from "@/lib/roles";
import type { UserProfile } from "@/lib/types";

/**
 * RBAC phase 1 — "Manage admins" (ADMIN_ROLES.md §8.1).
 *
 * Lists everyone holding admin power (legacy binary `role=="admin"` and/or a
 * granular `adminRole`) and lets the founder assign / change / remove
 * granular roles via the setAdminRole callable (2FA-gated server-side; a
 * caller can never change their own role). Role changes take effect on the
 * target's NEXT sign-in — the callable revokes their tokens.
 *
 * Phase 1 = foundation: roles + claims exist. The binary admin flag still
 * gates the panel until phase 2 converts enforcement to perm(...) checks.
 */
export default function ManageAdminsPanel() {
  const { profile } = useAuth();
  const confirm = useConfirm();
  const [admins, setAdmins] = useState<UserProfile[] | null>(null);
  const [pick, setPick] = useState<Record<string, AdminRole>>({});
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const snap = await getDocs(collection(getDb(), "users"));
    setAdmins(
      snap.docs
        .map((d) => ({ ...(d.data() as UserProfile), uid: d.id }))
        .filter((u) => u.role === "admin" || u.adminRole),
    );
  }, []);

  useEffect(() => {
    load().catch(() => setAdmins([]));
  }, [load]);

  if (!profile) return null;

  const apply = async (target: UserProfile, role: AdminRole | null) => {
    const ok = await confirm({
      title: role
        ? `Make ${target.displayName} "${role}"?`
        : `Remove ${target.displayName}'s admin role?`,
      body: role
        ? `${ROLE_DESCRIPTIONS[role]}. Takes effect when they next sign in (their current session is signed out).`
        : "Their granular role and permissions are removed. Takes effect when they next sign in.",
      tone: role === "owner" || !role ? "danger" : "neutral",
      confirmLabel: role ? `Yes, assign ${role}` : "Yes, remove",
    });
    if (!ok) return;
    setBusyUid(target.uid);
    setError(null);
    try {
      const fn = httpsCallable<{ uid: string; role: string | null }, { ok: boolean }>(
        getFunctionsInstance(),
        "setAdminRole",
      );
      await fn({ uid: target.uid, role });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change the role.");
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <section className="mb-6 rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] overflow-hidden">
      <header className="px-5 py-3 border-b border-[var(--color-line)]">
        <h2 className="font-display text-lg">Manage admins</h2>
        <p className="text-xs text-[var(--color-ink-muted)]">
          Granular roles (RBAC phase 1). Changes need your 2FA session and land when the
          person next signs in. You can&apos;t change your own role.
        </p>
      </header>
      {admins === null ? (
        <p className="px-5 py-4 text-sm text-[var(--color-ink-muted)]">Loading…</p>
      ) : (
        <ul className="divide-y divide-[var(--color-line)]">
          {admins.map((a) => {
            const self = a.uid === profile.uid;
            const chosen = pick[a.uid] ?? (a.adminRole as AdminRole | undefined) ?? "operations";
            return (
              <li key={a.uid} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                <Avatar name={a.displayName} photoURL={a.photoURL} size="sm" />
                <div className="flex-1 min-w-[10rem]">
                  <p className="text-sm font-medium text-[var(--color-ink)]">
                    {a.displayName} {self && <span className="text-[var(--color-ink-muted)]">(you)</span>}
                  </p>
                  <p className="text-xs text-[var(--color-ink-muted)]">{a.email}</p>
                </div>
                {a.adminRole ? (
                  <Badge tone="sage">{a.adminRole}</Badge>
                ) : (
                  <Badge tone="ochre">legacy admin — no granular role</Badge>
                )}
                {!self && (
                  <div className="flex items-center gap-2">
                    <select
                      value={chosen}
                      onChange={(e) => setPick((p) => ({ ...p, [a.uid]: e.target.value as AdminRole }))}
                      aria-label={`Role for ${a.displayName}`}
                      className="px-3 py-1.5 rounded-md text-sm bg-[var(--color-paper)] border border-[var(--color-line)] focus:border-[var(--color-ochre-500)] focus:outline-none"
                    >
                      {ADMIN_ROLES.map((r) => (
                        <option key={r} value={r} title={ROLE_DESCRIPTIONS[r]}>{r}</option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => apply(a, chosen)}
                      loading={busyUid === a.uid}
                      loadingText="Applying…"
                    >
                      Assign
                    </Button>
                    {a.adminRole && (
                      <Button size="sm" variant="ghost" onClick={() => apply(a, null)} disabled={busyUid === a.uid}>
                        Remove role
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="px-5 py-3 text-sm text-[var(--color-brick)]">{error}</p>}
    </section>
  );
}
