"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import Textarea from "@/components/Textarea";
import Avatar from "@/components/Avatar";
import { useAuth } from "@/contexts/AuthContext";
import { getDb } from "@/lib/firebase";
import type {
  AccountStatus,
  DisputeReason,
  DisputeResolution,
  Job,
  JobStatus,
  UserProfile,
  VerificationStatus,
} from "@/lib/types";
import { resolveDispute, subscribeAllJobs, subscribeDisputedJobs } from "@/lib/jobs";
import Link from "next/link";
import { useConfirm } from "@/contexts/ConfirmContext";
import AdminShell, { type AdminSection } from "./_components/AdminShell";
import OverviewDashboard from "./_components/OverviewDashboard";
import JarvisPanel from "./_components/JarvisPanel";
import BusinessVerificationPanel from "./_components/BusinessVerificationPanel";
import AdminSearch from "./_components/AdminSearch";
import EmergencyAlertsPanel from "./_components/EmergencyAlertsPanel";
import UserDrawer from "./_components/UserDrawer";
import DeletionRequestsPanel from "./_components/DeletionRequestsPanel";
import DataMigrationButton from "./_components/DataMigrationButton";
import BackfillHiresButton from "./_components/BackfillHiresButton";
import EmailUserButton from "./_components/EmailUserButton";
import WelcomeEmailButton from "./_components/WelcomeEmailButton";
import AnalyticsDashboard from "./_components/AnalyticsDashboard";
import GrowthDashboard from "./_components/GrowthDashboard";
import UsersTab from "./_components/UsersTab";
import ModerationPanel from "./_components/ModerationPanel";
import SupportPanel from "./_components/SupportPanel";
import BroadcastPanel from "./_components/BroadcastPanel";
import MarketingPanel from "./_components/MarketingPanel";
import OutreachPanel from "./_components/OutreachPanel";
import HeatmapTab from "./_components/HeatmapTab";
import VerificationDocs from "./_components/VerificationDocs";
import AdminNoteField from "./_components/AdminNoteField";
import AdminExportButtons from "./_components/AdminExportButtons";
import ManageAdminsPanel from "./_components/ManageAdminsPanel";
import SystemHealthCard from "./_components/SystemHealthCard";
import { logAudit, subscribeAuditLog, type AuditEntry, describeAction } from "@/lib/audit";
import { hasTotp, sessionUsedMfa } from "@/lib/mfa";
import EmptyState from "@/components/EmptyState";
import { fetchAdminCounts, type AdminCounts } from "@/lib/adminStats";

// Sidebar sections (matches AdminShell). 'approvals' is what was previously 'accounts'.
type Tab = AdminSection;

const DISPUTE_REASON_LABELS: Record<DisputeReason, string> = {
  no_show: "No-show",
  quality: "Quality issue",
  unsafe: "Unsafe situation",
  payment: "Payment dispute",
  scope_changed: "Scope changed",
  other: "Other",
};

export default function AdminPage() {
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();
  // Whether THIS session passed a second factor (not just whether TOTP is
  // enrolled) — the admin rules + sensitive callables require it.
  const [mfaSession, setMfaSession] = useState<"checking" | "yes" | "no">("checking");
  const [tab, setTab] = useState<Tab>("overview");
  // "pending" accounts are split for review: `ready` = submitted, waiting on OUR
  // decision (approvable); `changes_requested` = we reviewed and asked the USER
  // to fix something (waiting on them, not us); `awaiting_docs` = signed up but
  // never submitted (nudge them — nothing to approve yet). "Submitted" is judged
  // by hasSubmitted() below, NOT submittedAt alone, so legacy submissions that
  // predate that marker aren't wrongly buried in `awaiting_docs`. (2026-09-30)
  const [accountFilter, setAccountFilter] = useState<
    "ready" | "awaiting_docs" | "changes_requested" | "approved" | "rejected" | "suspended"
  >("ready");
  const [verifyFilter, setVerifyFilter] = useState<
    VerificationStatus | "submitted" | "resubmitted" | "missing_docs"
  >("submitted");
  // RBAC phase 2: role-tagged staff (adminRole) enter the panel too — what
  // they can DO inside is gated per-tab by AdminShell's can() filter and,
  // authoritatively, by the Firestore rules / callable permission checks.
  const isAdminSide = profile?.role === "admin" || !!profile?.adminRole;
  // Per-user fraud-signal counts, reported up by VerificationDocs once each
  // card's private payload loads — drives the 🚩 badge in the card header.
  const [fraudAlerts, setFraudAlerts] = useState<Record<string, number>>({});
  // Live count per filter chip (computed alongside the list in load()).
  const [filterCounts, setFilterCounts] = useState<{
    account: Record<string, number>;
    verify: Record<string, number>;
  } | null>(null);
  const [funnel, setFunnel] = useState<{
    signedUp: number;
    submitted: number;
    approved: number;
    medianApprovalHours: number | null;
  } | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [disputedJobs, setDisputedJobs] = useState<Job[]>([]);
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [disputeNotes, setDisputeNotes] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [moderationCounts, setModerationCounts] = useState<{ reports: number; flags: number }>({ reports: 0, flags: 0 });
  const [supportUnread, setSupportUnread] = useState(0);
  const [adminCounts, setAdminCounts] = useState<AdminCounts>({ usersTotal: 0, pendingApprovals: 0, verification: 0 });
  const [businessVerifyCount, setBusinessVerifyCount] = useState(0);
  // Per-user command-center drawer — opened from global search or Users rows.
  const [drawerUid, setDrawerUid] = useState<string | null>(null);

  // Sidebar badge counts via server-side aggregation — runs on every tab (not
  // tied to whichever list happens to be loaded) and doesn't download the users
  // collection. Refreshed after any approve/reject/verify action.
  const refreshCounts = useCallback(() => {
    if (!isAdminSide) return;
    fetchAdminCounts().then(setAdminCounts).catch(() => {});
  }, [profile]);

  const toggleSelected = (uid: string) =>
    setSelectedIds((s) => {
      const next = new Set(s);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  const clearSelection = () => setSelectedIds(new Set());

  // When the tab / filter changes, drop selection (different list of users)
  useEffect(() => {
    clearSelection();
  }, [tab, accountFilter, verifyFilter]);
  const confirm = useConfirm();

  const load = useCallback(async () => {
    if (!profile || !isAdminSide) return;
    // Only the approvals + verification tabs render this list. Overview reads
    // its own all-users stream for the dashboard, so don't scan again here.
    if (tab !== "approvals" && tab !== "verification") return;
    setBusy(true);
    try {
      const base = collection(getDb(), "users");
      let list: UserProfile[] = [];

      // One full fetch serves both tabs: the filtered list AND live counts on
      // every filter chip (so the whole queue state is visible at a glance).
      // Fine at current scale; revisit alongside the stats-doc backlog item.
      const snap = await getDocs(base);
      const everyone = snap.docs
        .map((d) => ({ ...(d.data() as UserProfile), uid: d.id }))
        .filter((u) => u.role !== "admin");

      // Verification-queue predicates (shared by list filter + chip counts).
      // "Has this person EVER submitted verification?" — must NOT rely on
      // submittedAt alone. Legacy submissions predate that marker but still carry
      // review / ID-check / consent evidence or a non-"none" status; keying off
      // submittedAt alone wrongly buried real (even already-reviewed) applicants
      // in "awaiting docs" / "missing docs". (2026-09-30 fix)
      const hasSubmitted = (u: UserProfile) =>
        !!u.verification?.submittedAt ||
        !!u.verification?.reviewedAt ||
        !!u.verification?.idCheckVerdict ||
        !!u.verification?.consentAt ||
        (u.verificationStatus ?? "none") !== "none";
      const isSubmitted = (u: UserProfile) =>
        !!u.verification?.submittedAt && (u.verificationStatus ?? "none") === "none";
      const isMissingDocs = (u: UserProfile) =>
        !hasSubmitted(u) && (u.accountStatus ?? "approved") === "pending";
      const isResubmitted = (u: UserProfile) => {
        const sub = u.verification?.submittedAt ?? 0;
        const rev = u.verification?.reviewedAt ?? 0;
        const resub = u.verification?.resubmittedAt ?? 0;
        return sub > 0 && rev > 0 && (resub > rev || sub > rev);
      };

      setFilterCounts({
        account: {
          ready: everyone.filter(
            (u) => (u.accountStatus ?? "approved") === "pending" && hasSubmitted(u)
              && u.verificationStatus !== "changes_requested",
          ).length,
          awaiting_docs: everyone.filter(
            (u) => (u.accountStatus ?? "approved") === "pending" && !hasSubmitted(u),
          ).length,
          changes_requested: everyone.filter(
            (u) => (u.accountStatus ?? "approved") === "pending" && u.verificationStatus === "changes_requested",
          ).length,
          approved: everyone.filter((u) => (u.accountStatus ?? "approved") === "approved").length,
          rejected: everyone.filter((u) => (u.accountStatus ?? "approved") === "rejected").length,
          suspended: everyone.filter((u) => (u.accountStatus ?? "approved") === "suspended").length,
        },
        verify: {
          submitted: everyone.filter(isSubmitted).length,
          resubmitted: everyone.filter(isResubmitted).length,
          missing_docs: everyone.filter(isMissingDocs).length,
          changes_requested: everyone.filter((u) => u.verificationStatus === "changes_requested").length,
          pending: everyone.filter((u) => u.verificationStatus === "pending").length,
          approved: everyone.filter((u) => u.verificationStatus === "approved").length,
          rejected: everyone.filter((u) => u.verificationStatus === "rejected").length,
        },
      });

      if (tab === "approvals") {
        // Funnel strip: the acquisition machine's health in four numbers.
        const submitted = everyone.filter(hasSubmitted);
        const approved = everyone.filter((u) => u.accountStatus === "approved");
        const waits = approved
          .map((u) => (u.accountReviewedAt ?? 0) - u.createdAt)
          .filter((ms) => ms > 0)
          .sort((a, b) => a - b);
        const medianMs = waits.length ? waits[Math.floor(waits.length / 2)] : 0;
        setFunnel({
          signedUp: everyone.length,
          submitted: submitted.length,
          approved: approved.length,
          medianApprovalHours: medianMs ? Math.round(medianMs / 3600000) : null,
        });
        if (accountFilter === "ready") {
          list = everyone.filter(
            (u) => (u.accountStatus ?? "approved") === "pending" && hasSubmitted(u)
              && u.verificationStatus !== "changes_requested",
          );
        } else if (accountFilter === "awaiting_docs") {
          list = everyone.filter(
            (u) => (u.accountStatus ?? "approved") === "pending" && !hasSubmitted(u),
          );
        } else if (accountFilter === "changes_requested") {
          list = everyone.filter(
            (u) => (u.accountStatus ?? "approved") === "pending" && u.verificationStatus === "changes_requested",
          );
        } else {
          list = everyone.filter((u) => (u.accountStatus ?? "approved") === accountFilter);
        }
      } else {
        // Verification queue — workers (required to verify) PLUS employers /
        // businesses who verified identity. All filters are client-side now
        // (the full fetch above already paid for it).
        if (verifyFilter === "submitted") list = everyone.filter(isSubmitted);
        else if (verifyFilter === "missing_docs") list = everyone.filter(isMissingDocs);
        else if (verifyFilter === "resubmitted") list = everyone.filter(isResubmitted);
        else list = everyone.filter((u) => u.verificationStatus === verifyFilter);
      }
      // Most recent sign-ups first — the founder reviews top-down.
      list.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      setUsers(list);
    } finally {
      setBusy(false);
    }
  }, [profile, tab, accountFilter, verifyFilter]);

  useEffect(() => {
    if (!loading && profile && !isAdminSide) router.replace("/account");
  }, [loading, profile, router]);

  useEffect(() => {
    if (isAdminSide) load();
  }, [profile, load]);

  // Refresh the aggregate sidebar counts when the admin loads in.
  useEffect(() => {
    refreshCounts();
  }, [refreshCounts]);

  // Real-time subscription for the disputes tab
  useEffect(() => {
    // Disputes need to stream on overview too (so the attention card lights up)
    if (!isAdminSide || (tab !== "disputes" && tab !== "overview")) return;
    const unsub = subscribeDisputedJobs((jobs) => setDisputedJobs(jobs));
    return () => unsub();
  }, [profile, tab]);

  // Live moderation count for the sidebar badge — runs whenever an admin is
  // signed in, regardless of tab, so the chip lights up even from Overview.
  useEffect(() => {
    if (!isAdminSide) return;
    const unsubReports = onSnapshot(
      query(collection(getDb(), "reports"), where("status", "in", ["open", "reviewing"])),
      (snap) => setModerationCounts((c) => ({ ...c, reports: snap.size })),
    );
    const unsubFlags = onSnapshot(
      query(collection(getDb(), "moderation")),
      (snap) => {
        const open = snap.docs.filter((d) => !d.data().reviewerAction).length;
        setModerationCounts((c) => ({ ...c, flags: open }));
      },
    );
    return () => {
      unsubReports();
      unsubFlags();
    };
  }, [profile]);

  // Live unread-support count for the sidebar badge. Outbound replies are
  // written handled=true, so unhandled docs are exactly the unread inbound
  // messages — a single-field query (no composite index needed).
  useEffect(() => {
    if (!isAdminSide) return;
    const unsub = onSnapshot(
      query(collection(getDb(), "supportMessages"), where("handled", "==", false)),
      (snap) => setSupportUnread(snap.size),
      () => setSupportUnread(0),
    );
    return () => unsub();
  }, [profile]);

  // Check whether the current session used a second factor (for the gate).
  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setMfaSession("no");
      return;
    }
    setMfaSession("checking");
    sessionUsedMfa(user).then((ok) => {
      if (!cancelled) setMfaSession(ok ? "yes" : "no");
    });
    return () => { cancelled = true; };
  }, [user]);

  // All jobs for the heatmap
  useEffect(() => {
    // All-jobs stream powers both the heatmap and the overview KPIs / activity feed
    if (!isAdminSide || (tab !== "heatmap" && tab !== "overview" && tab !== "analytics" && tab !== "growth")) return;
    const unsub = subscribeAllJobs((jobs) => setAllJobs(jobs));
    return () => unsub();
  }, [profile, tab]);

  // All users for Overview + Analytics — live stream, so the dashboard ticks
  // in real time (new signups, availability toggles, verification submits).
  useEffect(() => {
    if (!isAdminSide || (tab !== "overview" && tab !== "analytics" && tab !== "heatmap" && tab !== "growth")) return;
    const unsub = onSnapshot(
      collection(getDb(), "users"),
      (snap) => {
        const list = snap.docs.map((d) => ({ ...(d.data() as UserProfile), uid: d.id }));
        // Newest first
        list.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
        setAllUsers(list);
      },
      () => setAllUsers([]),
    );
    return () => unsub();
  }, [profile, tab]);

  // Audit log stream
  useEffect(() => {
    if (!isAdminSide || tab !== "audit") return;
    const unsub = subscribeAuditLog(200, setAuditEntries);
    return () => unsub();
  }, [profile, tab]);

  // Keyboard shortcuts: "/" focuses global search; "g" then a letter switches
  // tabs (g u → users, g o → overview …). Ignored while typing in a field.
  useEffect(() => {
    if (!isAdminSide) return;
    let gPending = false;
    let gTimer: ReturnType<typeof setTimeout> | null = null;
    const TAB_KEYS: Record<string, Tab> = {
      o: "overview", j: "jarvis", n: "analytics", r: "growth", a: "approvals",
      v: "verification", b: "business", d: "disputes", m: "moderation",
      s: "support", c: "broadcast", u: "users", h: "heatmap", l: "audit",
    };
    const isTyping = (el: EventTarget | null) => {
      const t = el as HTMLElement | null;
      if (!t) return false;
      const tag = t.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (e.key === "/") {
        e.preventDefault();
        (document.getElementById("admin-global-search") as HTMLInputElement | null)?.focus();
        return;
      }
      if (e.key === "g") {
        gPending = true;
        if (gTimer) clearTimeout(gTimer);
        gTimer = setTimeout(() => { gPending = false; }, 1200);
        return;
      }
      if (gPending && TAB_KEYS[e.key]) {
        e.preventDefault();
        setTab(TAB_KEYS[e.key]);
        gPending = false;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (gTimer) clearTimeout(gTimer);
    };
  }, [profile]);

  // Live count of businesses awaiting verification (sidebar badge).
  useEffect(() => {
    if (!isAdminSide) return;
    const unsub = onSnapshot(
      query(collection(getDb(), "users"), where("businessVerification.status", "==", "pending")),
      (snap) => setBusinessVerifyCount(snap.size),
    );
    return () => unsub();
  }, [profile]);

  const onResolveDispute = async (
    job: Job,
    resolution: DisputeResolution,
    newStatus: JobStatus,
  ) => {
    const note = disputeNotes[job.id] ?? "";
    if (note.trim().length < 5) {
      await confirm({
        title: "Add a resolver note first",
        body: "Both parties will see your decision — please add at least 5 characters explaining it.",
        tone: "warning",
        confirmLabel: "OK",
        cancelLabel: null,
      });
      return;
    }
    setBusy(true);
    try {
      await resolveDispute(job.id, resolution, note.trim(), newStatus);
      if (profile) {
        await logAudit({
          adminUid: profile.uid,
          adminName: profile.displayName,
          action: `dispute_resolve_${resolution}` as const,
          targetJobId: job.id,
          targetName: job.title,
          note: note.trim(),
          meta: { restoredTo: newStatus },
        });
      }
      setDisputeNotes((n) => ({ ...n, [job.id]: "" }));
    } finally {
      setBusy(false);
    }
  };

  const setAccountStatus = async (uid: string, newStatus: AccountStatus) => {
    const userObj = users.find((u) => u.uid === uid);
    // HARD GATE (2026-07-09): approving an account used to auto-stamp workers
    // as ID-verified even with nothing submitted — that's how doc-less users
    // slipped through. No documents = no approval, full stop.
    if (newStatus === "approved" && userObj && userObj.role !== "admin" && !userObj.verification?.submittedAt) {
      alert(
        `${userObj.displayName ?? "This user"} hasn't submitted any verification documents — every account needs ID + selfie before approval. Use "✉ Email docs reminder" to chase them.`,
      );
      return;
    }
    setBusy(true);
    try {
      const note = notes[uid];
      const patch: Record<string, unknown> = {
        accountStatus: newStatus,
        accountReviewedAt: Date.now(),
      };
      if (note) patch.accountReviewerNote = note;
      // Unify with verificationStatus — ONLY when docs were actually
      // submitted (account approval doubles as the doc review).
      if (userObj?.verification?.submittedAt) {
        if (newStatus === "approved") patch.verificationStatus = "approved";
        else if (newStatus === "rejected") patch.verificationStatus = "rejected";
        // pending / suspended = leave verificationStatus untouched
      }
      await updateDoc(doc(getDb(), "users", uid), patch);
      await load();
      refreshCounts();
    } finally {
      setBusy(false);
    }
  };

  const bulkSetStatus = async (newStatus: AccountStatus) => {
    if (selectedIds.size === 0) return;

    // Same hard gate as the single Approve: no documents = no approval.
    let targets = Array.from(selectedIds);
    let skippedNote = "";
    if (newStatus === "approved") {
      const eligible = targets.filter((uid) => {
        const u = users.find((x) => x.uid === uid);
        return u && (u.role === "admin" || u.verification?.submittedAt);
      });
      const skipped = targets.length - eligible.length;
      if (eligible.length === 0) {
        alert(
          "None of the selected accounts have submitted verification documents — nothing to approve. Use \"✉ Email docs reminder\" to chase them.",
        );
        return;
      }
      if (skipped > 0) {
        skippedNote = ` ${skipped} selected ${skipped === 1 ? "account has" : "accounts have"} no documents and will be SKIPPED.`;
      }
      targets = eligible;
    }

    const ok = await confirm({
      title: `${capitalise(newStatus)} ${targets.length} ${targets.length === 1 ? "account" : "accounts"}?`,
      body:
        newStatus === "approved"
          ? `They'll get full access immediately.${skippedNote}`
          : newStatus === "rejected"
            ? "They'll be told the account was rejected."
            : newStatus === "suspended"
              ? "They'll be locked out until reinstated. Use a reviewer note to explain why."
              : "Status will revert to pending.",
      tone: newStatus === "approved" ? "success" : newStatus === "rejected" || newStatus === "suspended" ? "danger" : "warning",
      confirmLabel: `Yes, ${newStatus}`,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await Promise.all(targets.map((uid) => setAccountStatus(uid, newStatus)));
      clearSelection();
    } finally {
      setBusy(false);
    }
  };

  const reviewVerification = async (
    uid: string,
    newStatus: VerificationStatus,
    backgroundVerified?: boolean,
  ) => {
    setBusy(true);
    try {
      const note = notes[uid];
      const target = users.find((u) => u.uid === uid);
      const patch: Record<string, unknown> = {
        verificationStatus: newStatus,
        ...(backgroundVerified !== undefined ? { backgroundVerified } : {}),
        "verification.reviewedAt": Date.now(),
      };
      if (note) patch["verification.reviewerNote"] = note;
      // Unify with accountStatus — the reverse of setAccountStatus's
      // unification (since 2026-07-08 the doc review IS the account review).
      // Approving docs unlocks the account; rejecting docs rejects a
      // still-pending account. A suspended account is a separate moderation
      // state and is never silently changed from here.
      if (target?.accountStatus !== "suspended") {
        if (newStatus === "approved" && target?.accountStatus !== "approved") {
          patch.accountStatus = "approved";
          patch.accountReviewedAt = Date.now();
        } else if (
          newStatus === "rejected"
          && (target?.accountStatus ?? "pending") === "pending"
        ) {
          patch.accountStatus = "rejected";
          patch.accountReviewedAt = Date.now();
        }
      }
      await updateDoc(doc(getDb(), "users", uid), patch);
      if (profile) {
        await logAudit({
          adminUid: profile.uid,
          adminName: profile.displayName,
          action:
            newStatus === "approved"
              ? "verification_approve"
              : newStatus === "rejected"
                ? "verification_reject"
                : "verification_pending",
          targetUid: uid,
          targetName: target?.displayName,
          note: note || undefined,
          meta: backgroundVerified ? { backgroundVerified } : undefined,
        });
      }
      await load();
      refreshCounts();
    } finally {
      setBusy(false);
    }
  };

  // "Request changes" — softer than reject: the note is REQUIRED (it's the
  // message the user receives), status flips to changes_requested, and the
  // verificationAlerts trigger pushes + emails the note to them. Resubmitting
  // puts them back in the pending queue automatically.
  const requestChanges = async (uid: string) => {
    const note = (notes[uid] ?? "").trim();
    if (!note) {
      alert('Type the message first — e.g. "Your ID photo is blurry, please re-upload both sides."');
      return;
    }
    setBusy(true);
    try {
      await updateDoc(doc(getDb(), "users", uid), {
        verificationStatus: "changes_requested",
        "verification.reviewedAt": Date.now(),
        "verification.reviewerNote": note,
        // Also surfaces on the account-pending gate screen.
        accountReviewerNote: note,
        accountReviewedAt: Date.now(),
      });
      if (profile) {
        const target = users.find((u) => u.uid === uid);
        await logAudit({
          adminUid: profile.uid,
          adminName: profile.displayName,
          action: "verification_request_changes",
          targetUid: uid,
          targetName: target?.displayName,
          note,
        });
      }
      await load();
      refreshCounts();
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <AdminShell section={tab} onSectionChange={setTab} title="Loading…">
        <p className="text-[var(--color-ink-muted)]">Loading…</p>
      </AdminShell>
    );
  }
  if (!isAdminSide) {
    return (
      <AdminShell section={tab} onSectionChange={setTab} title="Admins only">
        <p>You don&apos;t have access to this area.</p>
      </AdminShell>
    );
  }
  // Admin accounts can approve users, erase accounts and open ID documents —
  // a password alone isn't enough. Block the panel until TOTP is enrolled.
  if (user && !hasTotp(user)) {
    return (
      <AdminShell section={tab} onSectionChange={setTab} title="Secure your admin account">
        <div className="max-w-xl rounded-2xl p-7 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
          <p className="text-3xl mb-3" aria-hidden>🔐</p>
          <h2 className="font-display text-2xl">Two-step verification required</h2>
          <p className="mt-3 text-[var(--color-ink-soft)] leading-relaxed">
            Admin accounts can view ID documents and delete user accounts, so
            they need more than a password. Set up an authenticator app once
            (about two minutes) and the admin panel unlocks.
          </p>
          <div className="mt-5">
            <Button href="/account/security" variant="primary">
              Set up two-step verification →
            </Button>
          </div>
        </div>
      </AdminShell>
    );
  }
  // Enrolled, but this session signed in with password only (e.g. just enrolled
  // mid-session). The admin rules + callables need a 2FA session, so require a
  // fresh sign-in with the code rather than letting them hit confusing denials.
  if (user && mfaSession === "no") {
    return (
      <AdminShell section={tab} onSectionChange={setTab} title="One more step">
        <div className="max-w-xl rounded-2xl p-7 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
          <p className="text-3xl mb-3" aria-hidden>🔑</p>
          <h2 className="font-display text-2xl">Sign in again with your code</h2>
          <p className="mt-3 text-[var(--color-ink-soft)] leading-relaxed">
            Two-step verification is set up on your account, but this session
            signed in with a password only. Sign out and sign back in — you&apos;ll
            be asked for your 6-digit code — to unlock admin access.
          </p>
          <div className="mt-5">
            <Button onClick={() => signOut()} variant="primary">
              Sign out & sign in again →
            </Button>
          </div>
        </div>
      </AdminShell>
    );
  }
  if (user && mfaSession === "checking") {
    return (
      <AdminShell section={tab} onSectionChange={setTab} title="Loading…">
        <p className="text-[var(--color-ink-muted)]">Checking your session…</p>
      </AdminShell>
    );
  }

  // Sidebar badge counts. Approvals / verification / users come from server-side
  // aggregation (see adminStats.ts) so they're correct on every tab without
  // downloading the users collection; disputes + moderation come from their
  // existing real-time streams.
  const counts = {
    approvals: adminCounts.pendingApprovals,
    verification: adminCounts.verification,
    disputes: disputedJobs.length,
    moderation: moderationCounts.reports + moderationCounts.flags,
    support: supportUnread,
    users: adminCounts.usersTotal,
    business: businessVerifyCount,
  };

  const sectionMeta: Record<Tab, { title: string; subtitle?: string }> = {
    overview: {
      title: `Good ${greeting()}, ${profile.displayName?.split(" ")[0] ?? "admin"}.`,
      subtitle: "Here's what's happening on Workit right now.",
    },
    jarvis: { title: "Jarvis", subtitle: "Your private ops assistant. Ask about anything happening on Workit." },
    analytics: { title: "Analytics", subtitle: "Funnels, conversion rates, week-over-week trends and suburb leaderboards." },
    growth: { title: "Growth", subtitle: "Worker:employer ratio, fill-rate, time-to-fill and pace to 20,000 users." },
    outreach: { title: "Outreach", subtitle: "The B2B email pipeline — mark replies and sign-ups so conversion is visible." },
    approvals: { title: "Account approvals", subtitle: "New sign-ups waiting for your greenlight." },
    verification: { title: "Worker verification", subtitle: "Review IDs, selfies and skill proofs." },
    business: { title: "Business verification", subtitle: "Review CIPC docs and award the Verified business badge." },
    disputes: { title: "Disputes", subtitle: "Frozen jobs that need a decision." },
    moderation: { title: "Moderation", subtitle: "Community reports + auto-flags. Triage from here." },
    support: { title: "Support", subtitle: "WhatsApp messages from the public — reply within 24h of their last message." },
    broadcast: { title: "Broadcast", subtitle: "Send a push notification to a segment of users. Two-step verified, max 5/day." },
    users: { title: "All users", subtitle: "Everyone with a Workit account." },
    heatmap: { title: "Activity heatmap", subtitle: "Where the work is — and where it isn't." },
    audit: { title: "Audit log", subtitle: "Every approve / reject / suspend / dispute resolution, in one place." },
  };

  return (
    <AdminShell
      section={tab}
      onSectionChange={setTab}
      title={sectionMeta[tab].title}
      subtitle={sectionMeta[tab].subtitle}
      counts={counts}
      searchSlot={<AdminSearch onSelectUser={setDrawerUid} />}
      alertSlot={<EmergencyAlertsPanel />}
    >
      {/* Per-user command center — opens over any tab */}
      {drawerUid && <UserDrawer uid={drawerUid} onClose={() => setDrawerUid(null)} />}
      {/* AUDIT LOG TAB */}
      {tab === "audit" && <DataMigrationButton />}
      {tab === "audit" && <BackfillHiresButton />}
      {tab === "audit" && (
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] overflow-hidden">
          {auditEntries.length === 0 ? (
            <p className="p-10 text-center text-sm text-[var(--color-ink-muted)]">
              No actions logged yet. Approve, reject, or resolve something to see entries here.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--color-line)]">
              {auditEntries.map((e) => (
                <li key={e.id} className="px-5 py-3 hover:bg-[var(--color-cream-2)]/40 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className="text-[10px] uppercase tracking-widest text-[var(--color-ink-muted)] mt-0.5 w-28 flex-shrink-0">
                      {new Date(e.at).toLocaleString()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--color-ink)]">
                        <span className="font-semibold">{e.adminName}</span>{" "}
                        <span className="text-[var(--color-ink-soft)]">{describeAction(e.action)}</span>
                        {e.targetName && (
                          <>
                            {" → "}
                            {e.targetJobId ? (
                              <Link href={`/jobs?id=${e.targetJobId}`} target="_blank" className="font-medium underline">
                                {e.targetName}
                              </Link>
                            ) : e.targetUid ? (
                              <Link href={`/u?id=${e.targetUid}`} target="_blank" className="font-medium underline">
                                {e.targetName}
                              </Link>
                            ) : (
                              <span className="font-medium">{e.targetName}</span>
                            )}
                          </>
                        )}
                      </p>
                      {e.note && (
                        <p className="mt-0.5 text-xs text-[var(--color-ink-muted)] italic truncate">
                          “{e.note}”
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* OVERVIEW TAB */}
      {tab === "overview" && (
        <>
          <OverviewDashboard
            users={allUsers}
            jobs={allJobs}
            onJumpTo={setTab}
          />
          <SystemHealthCard />
        </>
      )}

      {/* JARVIS TAB — admin-only ops assistant */}
      {tab === "jarvis" && <JarvisPanel />}

      {/* BUSINESS VERIFICATION TAB */}
      {tab === "business" && <BusinessVerificationPanel />}

      {/* ANALYTICS TAB */}
      {tab === "analytics" && <AnalyticsDashboard users={allUsers} jobs={allJobs} />}

      {/* OUTREACH TAB — B2B lead pipeline + reply/win tracking */}
      {tab === "outreach" && <OutreachPanel />}

      {/* GROWTH TAB — marketing automation controls + ratio, fill-rate, time-to-fill, pace to 20k */}
      {tab === "growth" && (
        <>
          <MarketingPanel />
          <GrowthDashboard users={allUsers} jobs={allJobs} onJumpTo={setTab} />
        </>
      )}

      {/* MODERATION TAB — community reports + auto-flags */}
      {tab === "moderation" && (
        <ModerationPanel onCountsChange={setModerationCounts} />
      )}

      {/* SUPPORT TAB — two-way WhatsApp support inbox */}
      {tab === "support" && <SupportPanel />}

      {/* BROADCAST TAB — admin push campaigns */}
      {tab === "broadcast" && <BroadcastPanel />}

      {/* USERS TAB — cursor-paginated, server-side counts */}
      {tab === "users" && (
        <>
          <DeletionRequestsPanel />
          <AdminExportButtons />
          <ManageAdminsPanel />
          <UsersTab onOpenUser={setDrawerUid} />
        </>
      )}

      {/* Sub-filter (accounts + verification only) */}
      {(tab === "approvals" || tab === "verification") && (
        <>
        {tab === "approvals" && funnel && (
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Signed up", value: String(funnel.signedUp) },
              { label: "Submitted docs", value: String(funnel.submitted) },
              { label: "Approved", value: String(funnel.approved) },
              {
                label: "Median approval",
                value:
                  funnel.medianApprovalHours === null
                    ? "—"
                    : funnel.medianApprovalHours < 48
                      ? `${funnel.medianApprovalHours} h`
                      : `${Math.round(funnel.medianApprovalHours / 24)} d`,
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl bg-[var(--color-cream-2)] border border-[var(--color-line)] px-4 py-3"
              >
                <p className="text-[11px] uppercase tracking-widest text-[var(--color-ink-muted)]">
                  {s.label}
                </p>
                <p className="mt-0.5 font-display text-2xl text-[var(--color-ink)]">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {tab === "approvals"
            ? (["ready", "awaiting_docs", "changes_requested", "approved", "rejected", "suspended"] as const).map((f) => (
                <FilterChip
                  key={f}
                  active={accountFilter === f}
                  onClick={() => setAccountFilter(f)}
                >
                  {f === "ready"
                    ? "ready to review"
                    : f === "awaiting_docs"
                      ? "awaiting docs"
                      : f === "changes_requested"
                        ? "changes requested"
                        : f}
                  {filterCounts ? ` (${filterCounts.account[f] ?? 0})` : ""}
                </FilterChip>
              ))
            : (
                ["submitted", "resubmitted", "missing_docs", "changes_requested", "pending", "approved", "rejected"] as const
              ).map((f) => (
                <FilterChip
                  key={f}
                  active={verifyFilter === f}
                  onClick={() => setVerifyFilter(f)}
                >
                  {f === "resubmitted"
                    ? "re-submitted"
                    : f === "missing_docs"
                      ? "missing docs"
                      : f === "changes_requested"
                        ? "changes requested"
                        : f}
                  {filterCounts ? ` (${filterCounts.verify[f] ?? 0})` : ""}
                </FilterChip>
              ))}
        </div>
        </>
      )}

      {/* Bulk action toolbar — appears when any user is checked */}
      {tab === "approvals" && selectedIds.size > 0 && (
        <div className="mt-5 sticky top-[64px] z-20 rounded-2xl p-4 bg-[var(--color-ink)] text-[var(--color-cream)] shadow-lift flex items-center justify-between gap-3 flex-wrap animate-slide-up">
          <span className="text-sm">
            <b>{selectedIds.size}</b> selected
          </span>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => bulkSetStatus("approved")}>
              Approve all
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulkSetStatus("rejected")}>
              Reject all
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulkSetStatus("suspended")}>
              Suspend all
            </Button>
            <button
              type="button"
              onClick={clearSelection}
              className="px-4 py-2 rounded-pill text-sm text-[var(--color-cream)]/80 hover:text-[var(--color-cream)]"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* DISPUTES TAB */}
      {tab === "disputes" && (
        <div className="mt-6 space-y-4">
          {disputedJobs.length === 0 ? (
            <EmptyState
              kind="approved"
              title="No open disputes"
              body="Inbox zero. Every job in flight is going to plan."
            />
          ) : (
            disputedJobs.map((job) => {
              const d = job.dispute;
              if (!d) return null;
              const back = d.previousStatus;
              return (
                <article
                  key={job.id}
                  className="rounded-2xl p-6 bg-[var(--color-brick-soft)]/40 border border-[var(--color-brick)] shadow-soft animate-slide-up"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <Badge tone="brick">
                        {DISPUTE_REASON_LABELS[d.reason]}
                      </Badge>
                      <h3 className="mt-2 font-display text-xl">
                        <Link
                          href={`/jobs?id=${job.id}`}
                          className="hover:underline"
                          target="_blank"
                        >
                          {job.title}
                        </Link>
                      </h3>
                      <p className="text-xs text-[var(--color-ink-muted)] mt-1">
                        Raised by <b>{d.raisedByName}</b> ({d.raisedByRole}) ·{" "}
                        {new Date(d.raisedAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right text-xs text-[var(--color-ink-muted)]">
                      <p>
                        Was: <b>{back}</b> · Agreed price:{" "}
                        <b>R {job.agreedPrice ?? job.suggestedPrice}</b>
                      </p>
                      <p className="mt-1">
                        Employer: {job.employerName} <br />
                        Worker: {job.assignedWorkerName ?? "—"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg p-4 bg-[var(--color-paper)] border border-[var(--color-line)] text-sm text-[var(--color-ink)] whitespace-pre-wrap">
                    {d.description}
                  </div>

                  <div className="mt-4">
                    <Textarea
                      label="Resolver note (visible to both parties)"
                      name={`dispute-note-${job.id}`}
                      rows={2}
                      value={disputeNotes[job.id] ?? ""}
                      onChange={(e) =>
                        setDisputeNotes((n) => ({
                          ...n,
                          [job.id]: e.target.value,
                        }))
                      }
                      placeholder="Briefly explain your decision so both sides understand."
                    />
                    <div className="mt-3 flex flex-wrap gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          onResolveDispute(
                            job,
                            "dismissed",
                            d.previousStatus,
                          )
                        }
                      >
                        Dismiss · resume job
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          onResolveDispute(
                            job,
                            "cancelled_no_fault",
                            "cancelled",
                          )
                        }
                      >
                        Cancel — no fault
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          onResolveDispute(
                            job,
                            "cancelled_with_warning",
                            "cancelled",
                          )
                        }
                      >
                        Cancel + warning
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() =>
                          onResolveDispute(
                            job,
                            "force_completed",
                            "confirmed",
                          )
                        }
                      >
                        Force-complete (unlocks rating)
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}

      {/* HEATMAP TAB */}
      {tab === "heatmap" && <HeatmapTab jobs={allJobs} users={allUsers} />}

      {/* ACCOUNTS + VERIFICATION TABS */}
      {(tab === "approvals" || tab === "verification") && (
      <div className="mt-6 space-y-4">
        {busy && <p className="text-[var(--color-ink-muted)]">Loading…</p>}
        {!busy && users.length === 0 && (
          <EmptyState
            kind="no-results"
            title="Nothing in this queue"
            body={
              tab === "approvals"
                ? "All caught up on account approvals."
                : tab === "verification"
                  ? "No one waiting to be verified right now."
                  : "Nothing matches this filter."
            }
          />
        )}

        {users.map((u) => {
          // Signed up in the last 24h → the card glows so fresh arrivals
          // can't be missed (they also sort to the top).
          const isNewSignup = Date.now() - (u.createdAt ?? 0) < 24 * 60 * 60 * 1000;
          // Ageing: how long they've been waiting on US (review promise is
          // 1–2 days). Only shown on actionable filters, and only from day 1.
          const actionable =
            tab === "approvals"
              ? accountFilter === "ready"
              : verifyFilter !== "approved" && verifyFilter !== "rejected";
          const waitingSince =
            tab === "verification" && u.verification?.submittedAt
              ? u.verification.submittedAt
              : u.createdAt;
          const waitingDays =
            actionable && waitingSince
              ? Math.floor((Date.now() - waitingSince) / 86400000)
              : null;
          const waitingTone =
            waitingDays === null || waitingDays < 2
              ? "bg-[var(--color-cream-2)] text-[var(--color-ink-muted)] border border-[var(--color-line)]"
              : waitingDays < 4
                ? "bg-[var(--color-ochre-50)] text-[var(--color-ochre-700)] border border-[var(--color-ochre-300)]"
                : "bg-[var(--color-brick-soft)]/50 text-[var(--color-brick)] border border-[var(--color-brick)]";
          return (
          <article
            key={u.uid}
            className={`rounded-2xl p-6 border shadow-soft animate-slide-up transition-colors ${
              selectedIds.has(u.uid)
                ? "bg-[var(--color-ochre-50)] border-[var(--color-ochre-500)]"
                : isNewSignup
                  ? "bg-[var(--color-paper)] border-[var(--color-ochre-500)] shadow-[0_0_18px_rgba(217,119,66,0.4)]"
                  : "bg-[var(--color-paper)] border-[var(--color-line)]"
            }`}
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                {tab === "approvals" && (
                  <input
                    type="checkbox"
                    aria-label={`Select ${u.displayName}`}
                    checked={selectedIds.has(u.uid)}
                    onChange={() => toggleSelected(u.uid)}
                    className="mt-1 w-5 h-5 accent-[var(--color-ochre-500)] flex-shrink-0"
                  />
                )}
                <Avatar name={u.displayName} photoURL={u.photoURL} size="md" />
                <div>
                  <h3 className="font-display text-xl flex items-center gap-2 flex-wrap">
                    {u.displayName}
                    {isNewSignup && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-[var(--color-ochre-500)] text-white text-[10px] font-sans font-semibold tracking-wider animate-pulse">
                        ● NEW
                      </span>
                    )}
                    {waitingDays !== null && waitingDays >= 1 && (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-pill text-[10px] font-sans font-semibold tracking-wider ${waitingTone}`}
                        title="How long they've been waiting for review"
                      >
                        ⏳ waiting {waitingDays}d
                      </span>
                    )}
                    {(fraudAlerts[u.uid] ?? 0) > 0 && (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-pill bg-[var(--color-brick-solid,#a93226)] text-white text-[10px] font-sans font-semibold tracking-wider"
                        title="Fraud signals found — see the panel in the documents section"
                      >
                        🚩 {fraudAlerts[u.uid]} fraud signal{fraudAlerts[u.uid] === 1 ? "" : "s"}
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-[var(--color-ink-muted)]">
                    {u.email} · {u.phone ?? "no phone"}
                  </p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Badge tone={u.role === "worker" ? "sage" : "ochre"}>
                      {u.role}
                    </Badge>
                    <span className="text-xs text-[var(--color-ink-muted)]">
                      Account:{" "}
                      <b className="text-[var(--color-ink)]">
                        {u.accountStatus ?? "approved (legacy)"}
                      </b>
                    </span>
                    {(u.role === "worker" || u.verification?.submittedAt) && (
                      <span className="text-xs text-[var(--color-ink-muted)]">
                        · Docs:{" "}
                        <b className="text-[var(--color-ink)]">
                          {u.verificationStatus ?? "none"}
                        </b>
                      </span>
                    )}
                    {u.backgroundVerified && <Badge tone="ochre">Gold</Badge>}
                    {u.verification?.idCheckVerdict && u.verification.idCheckVerdict !== "none" && (
                      <Badge
                        tone={
                          u.verification.idCheckVerdict === "pass"
                            ? "sage"
                            : u.verification.idCheckVerdict === "warn"
                              ? "ochre"
                              : "brick"
                        }
                      >
                        ID {u.verification.idCheckVerdict === "pass" ? "✓" : u.verification.idCheckVerdict === "warn" ? "⚠" : "✗"}
                      </Badge>
                    )}
                    {(() => {
                      const sub = u.verification?.submittedAt ?? 0;
                      const rev = u.verification?.reviewedAt ?? 0;
                      const resub = u.verification?.resubmittedAt ?? 0;
                      const count = u.verification?.resubmissionCount ?? 0;
                      const isResubmitted = sub > 0 && rev > 0 && (resub > rev || sub > rev);
                      return isResubmitted ? (
                        <Badge tone="brick">
                          ↻ Re-submitted{count > 1 ? ` ×${count}` : ""}
                        </Badge>
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>
              <div className="text-right text-xs text-[var(--color-ink-muted)]">
                Joined: {new Date(u.createdAt).toLocaleDateString()}
                {u.verification?.submittedAt && (
                  <p>Last submitted: {new Date(u.verification.submittedAt).toLocaleString()}</p>
                )}
                {u.verification?.reviewedAt && (
                  <p>Last reviewed: {new Date(u.verification.reviewedAt).toLocaleString()}</p>
                )}
              </div>
            </div>

            {/* Verification doc details — workers + opted-in employers/businesses.
                Categories are worker-only; the ID/address/skills docs come from
                the private subcollection (owner+admin only) by uid. */}
            {u.verification?.submittedAt && (
              <dl className="mt-4 grid sm:grid-cols-2 gap-4 text-sm">
                {u.role === "worker" && (
                  <Field label="Categories" value={u.categories?.join(", ")} />
                )}
                <VerificationDocs
                  uid={u.uid}
                  onFraud={(n) =>
                    setFraudAlerts((m) => (m[u.uid] === n ? m : { ...m, [u.uid]: n }))
                  }
                />
              </dl>
            )}

            {/* Note from prior review */}
            {(u.accountReviewerNote || u.verification?.reviewerNote) && (
              <div className="mt-4 rounded-lg bg-[var(--color-cream-2)] border border-[var(--color-line)] p-3 text-xs text-[var(--color-ink-soft)]">
                {u.accountReviewerNote && <p>Account note: {u.accountReviewerNote}</p>}
                {u.verification?.reviewerNote && <p>Verification note: {u.verification.reviewerNote}</p>}
              </div>
            )}

            <div className="mt-5 space-y-3">
              {/* Contact row — email chase (when docs are missing) + WhatsApp
                  deep link (founder sends from his own WhatsApp; no automation). */}
              <div className="flex flex-wrap justify-end gap-2">
                {u.phone && (
                  <a
                    href={`https://wa.me/${u.phone.replace(/[^\d]/g, "").replace(/^0/, "27")}?text=${encodeURIComponent(`Hi ${u.displayName?.split(" ")[0] ?? "there"}, it's Tshepo from Workit 👋 — just checking in about your account. Anything I can help with?`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-sm border border-[var(--color-sage-400)] text-[var(--color-sage-700)] hover:bg-[var(--color-sage-100)]/40 transition-colors"
                  >
                    💬 WhatsApp
                  </a>
                )}
                {u.email && !u.verification?.submittedAt && (
                  <EmailUserButton uid={u.uid} displayName={u.displayName} />
                )}
                {u.email && <WelcomeEmailButton uid={u.uid} />}
              </div>

              {/* One-tap preset notes — the founder's most common review
                  messages. Tap fills the note box; edit freely before acting. */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Your ID photo is blurry — please re-upload clear photos of both sides.",
                  "Adding a short selfie video will speed up your approval — it proves the ID is yours.",
                  "Your proof of address is older than 3 months — please upload a recent one.",
                  "The ID number you typed doesn't match your documents — please double-check it.",
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setNotes((n) => ({ ...n, [u.uid]: preset }))}
                    className="px-2.5 py-1 rounded-pill text-[11px] border border-dashed border-[var(--color-line)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:border-[var(--color-ochre-500)] transition-colors"
                    title="Fill the note box with this message"
                  >
                    {preset.split(" ").slice(0, 4).join(" ")}…
                  </button>
                ))}
              </div>
              <Textarea
                label="Note to user (visible to them)"
                name={`note-${u.uid}`}
                rows={2}
                value={notes[u.uid] ?? ""}
                onChange={(e) =>
                  setNotes((n) => ({ ...n, [u.uid]: e.target.value }))
                }
              />

              {profile && (
                <AdminNoteField
                  uid={u.uid}
                  adminUid={profile.uid}
                  adminName={profile.displayName}
                />
              )}

              {tab === "approvals" ? (
                <div className="flex flex-wrap gap-2 justify-end">
                  {u.accountStatus === "suspended" ? (
                    <Button size="sm" variant="primary" onClick={() => setAccountStatus(u.uid, "approved")}>
                      Reinstate account
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setAccountStatus(u.uid, "suspended")}>
                        Suspend
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setAccountStatus(u.uid, "rejected")}>
                        Reject
                      </Button>
                      {(u.role === "worker" || u.verification?.submittedAt) && (
                        <Button size="sm" variant="secondary" onClick={() => requestChanges(u.uid)}>
                          ↩ Request changes
                        </Button>
                      )}
                      <Button size="sm" variant="primary" onClick={() => setAccountStatus(u.uid, "approved")}>
                        Approve
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => reviewVerification(u.uid, "rejected")}>
                    Reject docs
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => reviewVerification(u.uid, "pending")}>
                    Mark pending
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => requestChanges(u.uid)}>
                    ↩ Request changes
                  </Button>
                  <Button size="sm" variant="primary" onClick={() => reviewVerification(u.uid, "approved")}>
                    Approve docs
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => reviewVerification(u.uid, "approved", true)}>
                    Approve + Gold badge
                  </Button>
                </div>
              )}
            </div>
          </article>
          );
        })}
      </div>
      )}
    </AdminShell>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-pill text-sm transition-colors capitalize ${
        active
          ? "bg-[var(--color-ink)] text-[var(--color-cream)]"
          : "bg-[var(--color-paper)] border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:bg-[var(--color-cream-2)]"
      }`}
    >
      {children}
    </button>
  );
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">{label}</dt>
      <dd className="mt-1 text-[var(--color-ink)] whitespace-pre-wrap">
        {value || <span className="text-[var(--color-ink-muted)] italic">—</span>}
      </dd>
    </div>
  );
}

