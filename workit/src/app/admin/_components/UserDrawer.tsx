"use client";

/**
 * UserDrawer — per-user command center, openable from anywhere in the admin
 * (global search hit, Users-tab row). Slide-over with:
 *  - live profile header (badges, contact, stats)
 *  - inline account actions (approve / reject / suspend / reinstate)
 *  - inline worker-verification actions (approve / +Gold / reject)
 *  - their recent jobs (posted + assigned)
 *  - this user's audit history
 * All writes mirror the main admin queues' semantics and are audit-logged.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import Avatar from "@/components/Avatar";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import { StarsRead } from "@/components/Stars";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { logAudit, type AuditEntry, describeAction } from "@/lib/audit";
import { track } from "@/lib/analytics";
import type { AccountStatus, Job, UserProfile, VerificationStatus } from "@/lib/types";

export default function UserDrawer({ uid, onClose }: { uid: string; onClose: () => void }) {
  const { profile: admin } = useAuth();
  const [u, setU] = useState<UserProfile | null | undefined>(undefined);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [trail, setTrail] = useState<AuditEntry[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Live profile
  useEffect(() => {
    const unsub = onSnapshot(
      doc(getDb(), "users", uid),
      (snap) => setU(snap.exists() ? ({ ...(snap.data() as UserProfile), uid }) : null),
      () => setU(null),
    );
    return () => unsub();
  }, [uid]);

  // Recent jobs (posted + assigned) — indexes for both queries already exist.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = getDb();
        const [posted, assigned] = await Promise.all([
          getDocs(query(collection(db, "jobs"), where("employerId", "==", uid), orderBy("createdAt", "desc"), limit(5))),
          getDocs(query(collection(db, "jobs"), where("assignedWorkerId", "==", uid), orderBy("createdAt", "desc"), limit(5))),
        ]);
        if (cancelled) return;
        const map = new Map<string, Job>();
        [...posted.docs, ...assigned.docs].forEach((d) => map.set(d.id, { ...(d.data() as Job), id: d.id }));
        setJobs(Array.from(map.values()).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)).slice(0, 6));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  // Audit trail for this user (single-field index; sorted client-side).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(getDb(), "auditLog"), where("targetUid", "==", uid), limit(50)),
        );
        if (cancelled) return;
        const entries = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<AuditEntry, "id">) }))
          .sort((a, b) => b.at - a.at)
          .slice(0, 8);
        setTrail(entries);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, busy]);

  // Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const setAccountStatus = async (newStatus: AccountStatus) => {
    if (!u || !admin) return;
    setBusy(newStatus);
    try {
      const patch: Record<string, unknown> = {
        accountStatus: newStatus,
        accountReviewedAt: Date.now(),
      };
      if (note.trim()) patch.accountReviewerNote = note.trim();
      if (u.role === "worker") {
        if (newStatus === "approved") patch.verificationStatus = "approved";
        else if (newStatus === "rejected") patch.verificationStatus = "rejected";
      }
      await updateDoc(doc(getDb(), "users", uid), patch);
      await logAudit({
        adminUid: admin.uid,
        adminName: admin.displayName,
        action:
          newStatus === "approved"
            ? "account_approve"
            : newStatus === "rejected"
              ? "account_reject"
              : newStatus === "suspended"
                ? "account_suspend"
                : "account_pending",
        targetUid: uid,
        targetName: u.displayName,
        note: note.trim() || undefined,
      });
      setFlash(`Account ${newStatus}.`);
      setNote("");
    } finally {
      setBusy(null);
    }
  };

  const reviewVerification = async (newStatus: VerificationStatus, gold?: boolean) => {
    if (!u || !admin) return;
    setBusy(`v-${newStatus}${gold ? "-gold" : ""}`);
    try {
      const patch: Record<string, unknown> = {
        verificationStatus: newStatus,
        "verification.reviewedAt": Date.now(),
        ...(gold !== undefined ? { backgroundVerified: gold } : {}),
      };
      if (note.trim()) patch["verification.reviewerNote"] = note.trim();
      await updateDoc(doc(getDb(), "users", uid), patch);
      await logAudit({
        adminUid: admin.uid,
        adminName: admin.displayName,
        action:
          newStatus === "approved"
            ? "verification_approve"
            : newStatus === "rejected"
              ? "verification_reject"
              : "verification_pending",
        targetUid: uid,
        targetName: u.displayName,
        note: note.trim() || undefined,
        meta: gold ? { backgroundVerified: true } : undefined,
      });
      // The only customer-funnel event an admin action fires: a worker being
      // approved. Non-worker approvals + all other admin actions stay silent.
      if (newStatus === "approved" && u.role === "worker") {
        track("worker_verified", { badge: gold ? "gold" : "standard" });
      }
      setFlash(`Verification ${newStatus}${gold ? " + Gold" : ""}.`);
      setNote("");
    } finally {
      setBusy(null);
    }
  };

  const copyUid = async () => {
    try {
      await navigator.clipboard.writeText(uid);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="User details">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose} />

      {/* Panel */}
      <aside className="absolute right-0 top-0 bottom-0 w-full sm:w-[480px] bg-[var(--color-cream)] shadow-lift overflow-y-auto animate-slide-up sm:animate-fade-in border-l border-[var(--color-line)]">
        {u === undefined ? (
          <p className="p-8 text-sm text-[var(--color-ink-muted)]">Loading…</p>
        ) : u === null ? (
          <div className="p-8">
            <p className="text-sm text-[var(--color-brick)]">User not found (deleted?).</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={onClose}>Close</Button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="sticky top-0 z-10 bg-[var(--color-paper)]/95 backdrop-blur-md border-b border-[var(--color-line)] p-5">
              <div className="flex items-start gap-3">
                <Avatar name={u.displayName} photoURL={u.photoURL} size="lg" />
                <div className="flex-1 min-w-0">
                  <h2 className="font-display text-2xl leading-tight truncate">{u.displayName || "Unnamed user"}</h2>
                  <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                    <Badge tone={u.role === "worker" ? "sage" : u.role === "admin" ? "ink" : "ochre"}>{u.role}</Badge>
                    <Badge tone={u.accountStatus === "approved" ? "sage" : u.accountStatus === "suspended" || u.accountStatus === "rejected" ? "brick" : "stone"}>
                      {u.accountStatus ?? "approved (legacy)"}
                    </Badge>
                    {u.role === "worker" && (
                      <Badge tone={u.verificationStatus === "approved" ? "sage" : "stone"}>
                        docs: {u.verificationStatus ?? "none"}
                      </Badge>
                    )}
                    {u.backgroundVerified && <Badge tone="ochre">🥇 Gold</Badge>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-ink-muted)] hover:bg-[var(--color-cream-2)] hover:text-[var(--color-ink)] flex-shrink-0"
                >
                  ×
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2 flex-wrap text-xs">
                <Link
                  href={u.role === "business" ? `/business?id=${uid}` : `/u?id=${uid}`}
                  target="_blank"
                  className="px-3 py-1.5 rounded-pill bg-[var(--color-ink)] text-[var(--color-cream)] hover:opacity-90"
                >
                  View profile ↗
                </Link>
                {u.email && (
                  <a href={`mailto:${u.email}`} className="px-3 py-1.5 rounded-pill border border-[var(--color-line)] hover:bg-[var(--color-cream-2)]">
                    ✉ Email
                  </a>
                )}
                {u.phone && (
                  <a href={`tel:${u.phone}`} className="px-3 py-1.5 rounded-pill border border-[var(--color-line)] hover:bg-[var(--color-cream-2)]">
                    📞 Call
                  </a>
                )}
                <button
                  type="button"
                  onClick={copyUid}
                  className="px-3 py-1.5 rounded-pill border border-[var(--color-line)] hover:bg-[var(--color-cream-2)] text-[var(--color-ink-muted)]"
                >
                  {copied ? "Copied ✓" : "Copy uid"}
                </button>
              </div>
            </div>

            <div className="p-5 space-y-6">
              {flash && (
                <p className="rounded-lg px-4 py-2.5 bg-[var(--color-sage-100)]/50 border border-[var(--color-sage-400)]/50 text-sm animate-fade-in">
                  ✓ {flash}
                </p>
              )}

              {/* Facts */}
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Fact label="Joined" value={u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"} />
                <Fact label="Location" value={[u.suburb, u.city].filter(Boolean).join(", ") || "—"} />
                <Fact label="Email" value={u.email || "—"} />
                <Fact label="Phone" value={u.phone || "—"} />
                <Fact
                  label="Rating"
                  value={
                    u.ratingCount ? (
                      <span className="flex items-center gap-1.5">
                        <StarsRead value={u.ratingAvg} /> ({u.ratingCount})
                      </span>
                    ) : (
                      "No ratings"
                    )
                  }
                />
                <Fact label="Jobs done / cancelled" value={`${u.jobsCompleted ?? 0} / ${u.jobsCancelled ?? 0}`} />
                <Fact label="Referrals" value={String(u.referralsCount ?? 0)} />
                <Fact label="Terms accepted" value={u.termsAcceptedAt ? new Date(u.termsAcceptedAt).toLocaleDateString() : "—"} />
              </dl>

              {/* Existing notes */}
              {(u.accountReviewerNote || u.verification?.reviewerNote) && (
                <div className="rounded-lg bg-[var(--color-cream-2)] border border-[var(--color-line)] p-3 text-xs text-[var(--color-ink-soft)] space-y-1">
                  {u.accountReviewerNote && <p>Account note: {u.accountReviewerNote}</p>}
                  {u.verification?.reviewerNote && <p>Verification note: {u.verification.reviewerNote}</p>}
                </div>
              )}

              {/* Actions */}
              {u.role !== "admin" && (
                <section>
                  <h3 className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold mb-2">
                    Actions
                  </h3>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder="Note to user (optional, visible to them)…"
                    className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-ochre-300)] mb-3"
                  />
                  <div className="flex flex-wrap gap-2">
                    {u.accountStatus === "suspended" || u.accountStatus === "rejected" ? (
                      <Button size="sm" variant="primary" onClick={() => setAccountStatus("approved")} loading={busy === "approved"}>
                        Reinstate
                      </Button>
                    ) : (
                      <>
                        {u.accountStatus !== "approved" && (
                          <Button size="sm" variant="primary" onClick={() => setAccountStatus("approved")} loading={busy === "approved"}>
                            Approve
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => setAccountStatus("suspended")} loading={busy === "suspended"}>
                          Suspend
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setAccountStatus("rejected")} loading={busy === "rejected"}>
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                  {u.role === "worker" && (
                    <div className="mt-3 pt-3 border-t border-[var(--color-line)] flex flex-wrap gap-2">
                      <Button size="sm" variant="primary" onClick={() => reviewVerification("approved")} loading={busy === "v-approved"}>
                        Approve docs
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => reviewVerification("approved", true)} loading={busy === "v-approved-gold"}>
                        Approve + Gold
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => reviewVerification("rejected")} loading={busy === "v-rejected"}>
                        Reject docs
                      </Button>
                    </div>
                  )}
                </section>
              )}

              {/* Recent jobs */}
              <section>
                <h3 className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold mb-2">
                  Recent jobs
                </h3>
                {jobs.length === 0 ? (
                  <p className="text-sm text-[var(--color-ink-muted)]">No jobs yet.</p>
                ) : (
                  <ul className="divide-y divide-[var(--color-line)] rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] overflow-hidden">
                    {jobs.map((j) => (
                      <li key={j.id}>
                        <Link
                          href={`/jobs?id=${j.id}`}
                          target="_blank"
                          className="flex items-center justify-between gap-3 p-3 hover:bg-[var(--color-cream-2)]/50 transition-colors"
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-medium truncate">{j.title}</span>
                            <span className="block text-xs text-[var(--color-ink-muted)]">
                              {j.employerId === uid ? "posted" : "assigned"} · {j.suburb} · R {j.agreedPrice ?? j.suggestedPrice}
                            </span>
                          </span>
                          <Badge tone={j.status === "open" ? "sage" : j.status === "disputed" ? "brick" : "stone"}>
                            {j.status}
                          </Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Audit history */}
              <section>
                <h3 className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold mb-2">
                  Admin history
                </h3>
                {trail.length === 0 ? (
                  <p className="text-sm text-[var(--color-ink-muted)]">No admin actions recorded for this user.</p>
                ) : (
                  <ul className="space-y-2">
                    {trail.map((e) => (
                      <li key={e.id} className="text-xs text-[var(--color-ink-soft)]">
                        <span className="text-[var(--color-ink-muted)]">{new Date(e.at).toLocaleString()}</span>{" "}
                        — <b>{e.adminName}</b> {describeAction(e.action)}
                        {e.note && <span className="italic"> · “{e.note}”</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-[var(--color-paper)] border border-[var(--color-line)] p-2.5">
      <dt className="text-[10px] uppercase tracking-widest text-[var(--color-ink-muted)]">{label}</dt>
      <dd className="mt-0.5 text-[var(--color-ink)] break-words">{value}</dd>
    </div>
  );
}
