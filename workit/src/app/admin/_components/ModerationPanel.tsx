"use client";

/**
 * Moderation tab — unified queue of:
 *   1. User reports (community flagging via the in-app Report button)
 *   2. Auto-flags from Cloud Functions (text screening, rate limits,
 *      first-post review, image SafeSearch hits)
 *
 * For each item the admin can:
 *   - Jump to the reported content
 *   - Resolve with an outcome (warn / remove / suspend / ban / no action)
 *   - Dismiss as no-op (still kept for audit)
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import {
  dismissReport,
  resolveReport,
  subscribeOpenReports,
  subscribeResolvedReports,
} from "@/lib/reports";
import { updateJob } from "@/lib/jobs";
import { logAudit } from "@/lib/audit";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/Button";
import Badge from "@/components/Badge";
import type { ModerationFlag, Report, ReportResolution } from "@/lib/types";

type Tab = "reports" | "flags" | "history";

const REASON_LABELS: Record<string, string> = {
  illegal: "Illegal activity",
  sexual: "Sexual services",
  scam: "Scam / fraud",
  harassment: "Harassment",
  violence: "Violence",
  spam: "Spam",
  csam: "Child sexual content",
  other: "Other",
};

const KIND_LABELS: Record<string, string> = {
  image_safesearch: "Image auto-flag (SafeSearch)",
  text_screen: "Text screening hit",
  rate_limit: "Rate-limit trip",
  first_post_review: "First-post review",
  user_report: "User report",
};

export default function ModerationPanel({
  onCountsChange,
}: {
  onCountsChange?: (counts: { reports: number; flags: number }) => void;
}) {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>("reports");
  const [reports, setReports] = useState<Report[]>([]);
  const [flags, setFlags] = useState<ModerationFlag[]>([]);
  const [history, setHistory] = useState<Report[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeOpenReports((list) => setReports(list));
    return () => unsub();
  }, []);

  // History only loads when its tab is opened — keep the document reads down.
  useEffect(() => {
    if (tab !== "history") return;
    const unsub = subscribeResolvedReports((list) => setHistory(list));
    return () => unsub();
  }, [tab]);

  useEffect(() => {
    const q = query(
      collection(getDb(), "moderation"),
      where("reviewerAction", "==", null),
      orderBy("createdAt", "desc"),
    );
    // null filter only works if the docs explicitly store null; we wrote
    // them without the field. Use a fallback subscription that gets all and
    // filters client-side.
    const all = query(collection(getDb(), "moderation"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(all, (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ModerationFlag, "id">),
      }));
      setFlags(list.filter((f) => !f.reviewerAction));
    });
    void q;
    return () => unsub();
  }, []);

  useEffect(() => {
    onCountsChange?.({ reports: reports.length, flags: flags.length });
  }, [reports.length, flags.length, onCountsChange]);

  const resolveReportAction = async (
    r: Report,
    resolution: ReportResolution,
  ) => {
    if (!profile) return;
    setBusy(r.id);
    try {
      const note = notes[r.id]?.trim();
      await resolveReport(r.id, profile.uid, resolution, note);

      // Side effects — remove content / suspend user.
      if (resolution === "content_removed" && r.targetType === "job") {
        await updateJob(r.targetId, { moderationStatus: "removed", moderationReason: `Report: ${r.reason}` });
      }
      if (resolution === "suspended" && r.targetUserUid) {
        await updateDoc(doc(getDb(), "users", r.targetUserUid), {
          accountStatus: "suspended",
        });
      }
      if (resolution === "banned" && r.targetUserUid) {
        await updateDoc(doc(getDb(), "users", r.targetUserUid), {
          accountStatus: "rejected",
        });
      }

      await logAudit({
        adminUid: profile.uid,
        adminName: profile.displayName,
        action:
          resolution === "banned"
            ? "account_reject"
            : resolution === "suspended"
              ? "account_suspend"
              : resolution === "content_removed"
                ? "moderation_remove_content"
                : resolution === "warned"
                  ? "moderation_warn"
                  : "moderation_resolve_other",
        targetUid: r.targetUserUid,
        note: `Report (${r.reason}): ${resolution}${note ? ` — ${note}` : ""}`,
      });
    } finally {
      setBusy(null);
    }
  };

  const dismissReportAction = async (r: Report) => {
    if (!profile) return;
    setBusy(r.id);
    try {
      const note = notes[r.id]?.trim();
      await dismissReport(r.id, profile.uid, note);
    } finally {
      setBusy(null);
    }
  };

  const resolveFlagAction = async (
    f: ModerationFlag,
    action: NonNullable<ModerationFlag["reviewerAction"]>,
  ) => {
    if (!profile) return;
    setBusy(f.id);
    try {
      // Apply the action's side effect first, then mark the flag reviewed.
      if (f.targetType === "job") {
        if (action === "approve") {
          await updateJob(f.targetId, { moderationStatus: undefined as never, moderationReason: undefined as never });
        } else if (action === "remove") {
          await updateJob(f.targetId, { moderationStatus: "removed", moderationReason: f.reason });
        }
      }
      if (f.targetType === "user") {
        if (action === "suspend_user") {
          await updateDoc(doc(getDb(), "users", f.targetId), { accountStatus: "suspended" });
        } else if (action === "ban_user") {
          await updateDoc(doc(getDb(), "users", f.targetId), { accountStatus: "rejected" });
        }
      }
      await updateDoc(doc(getDb(), "moderation", f.id), {
        reviewedAt: Date.now(),
        reviewerUid: profile.uid,
        reviewerAction: action,
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <TabChip active={tab === "reports"} onClick={() => setTab("reports")}>
          Reports ({reports.length})
        </TabChip>
        <TabChip active={tab === "flags"} onClick={() => setTab("flags")}>
          Auto-flags ({flags.length})
        </TabChip>
        <TabChip active={tab === "history"} onClick={() => setTab("history")}>
          History
        </TabChip>
      </div>

      {tab === "reports" && (
        <>
          {reports.length === 0 ? (
            <Empty>
              No open reports. The community will flag anything that looks off — they show up here.
            </Empty>
          ) : (
            <ul className="space-y-3">
              {reports.map((r) => (
                <li
                  key={r.id}
                  className="rounded-2xl p-5 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge tone={r.reason === "csam" ? "brick" : "ochre"}>
                        {REASON_LABELS[r.reason] ?? r.reason}
                      </Badge>
                      <Badge tone="stone">{r.targetType}</Badge>
                      {r.reason === "csam" && (
                        <Badge tone="brick">ESCALATE TO SAPS</Badge>
                      )}
                    </div>
                    <span className="text-xs text-[var(--color-ink-muted)]">
                      {new Date(r.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-[var(--color-ink-soft)] whitespace-pre-wrap">
                    &ldquo;{r.description}&rdquo;
                  </p>

                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--color-ink-muted)]">
                    <span>
                      Reporter:{" "}
                      <Link
                        href={`/u?id=${r.reporterId}`}
                        target="_blank"
                        className="underline text-[var(--color-ink)]"
                      >
                        {r.reporterName}
                      </Link>
                    </span>
                    {r.targetUserUid && (
                      <span>
                        Reported user:{" "}
                        <Link
                          href={`/u?id=${r.targetUserUid}`}
                          target="_blank"
                          className="underline text-[var(--color-ink)]"
                        >
                          view profile
                        </Link>
                      </span>
                    )}
                    {r.targetType === "job" && (
                      <span>
                        <Link
                          href={`/jobs?id=${r.targetId}`}
                          target="_blank"
                          className="underline text-[var(--color-ink)]"
                        >
                          Open the job →
                        </Link>
                      </span>
                    )}
                  </div>

                  <textarea
                    rows={2}
                    placeholder="Optional note about your decision…"
                    value={notes[r.id] ?? ""}
                    onChange={(e) =>
                      setNotes((n) => ({ ...n, [r.id]: e.target.value }))
                    }
                    className="mt-3 w-full px-3 py-2 rounded-lg bg-[var(--color-cream-2)] border border-[var(--color-line)] focus:border-[var(--color-ochre-500)] focus:outline-none text-sm"
                  />

                  <div className="mt-3 flex flex-wrap gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => dismissReportAction(r)}
                      disabled={busy === r.id}
                    >
                      Dismiss
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolveReportAction(r, "warned")}
                      disabled={busy === r.id}
                    >
                      Warn user
                    </Button>
                    {r.targetType === "job" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resolveReportAction(r, "content_removed")}
                        disabled={busy === r.id}
                      >
                        Remove content
                      </Button>
                    )}
                    {r.targetUserUid && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resolveReportAction(r, "suspended")}
                          disabled={busy === r.id}
                        >
                          Suspend
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => resolveReportAction(r, "banned")}
                          disabled={busy === r.id}
                        >
                          Ban
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === "flags" && (
        <>
          {flags.length === 0 ? (
            <Empty>
              No auto-flags waiting. Cloud Functions flag suspicious content,
              new-user first posts, and rate-limit trips into this queue.
            </Empty>
          ) : (
            <ul className="space-y-3">
              {flags.map((f) => (
                <li
                  key={f.id}
                  className="rounded-2xl p-5 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge tone={f.severity === "high" ? "brick" : f.severity === "medium" ? "ochre" : "stone"}>
                        {f.severity}
                      </Badge>
                      <Badge tone="stone">{KIND_LABELS[f.kind] ?? f.kind}</Badge>
                      <Badge tone="stone">{f.targetType}</Badge>
                      {f.autoActioned && (
                        <Badge tone="brick">Auto-actioned</Badge>
                      )}
                    </div>
                    <span className="text-xs text-[var(--color-ink-muted)]">
                      {new Date(f.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-[var(--color-ink-soft)] whitespace-pre-wrap">
                    {f.reason}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--color-ink-muted)]">
                    {f.targetType === "job" && (
                      <Link
                        href={`/jobs?id=${f.targetId}`}
                        target="_blank"
                        className="underline text-[var(--color-ink)]"
                      >
                        Open the job →
                      </Link>
                    )}
                    {f.targetType === "user" && (
                      <Link
                        href={`/u?id=${f.targetId}`}
                        target="_blank"
                        className="underline text-[var(--color-ink)]"
                      >
                        Open the profile →
                      </Link>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => resolveFlagAction(f, "dismiss")}
                      disabled={busy === f.id}
                    >
                      Dismiss (no issue)
                    </Button>
                    {f.targetType === "job" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resolveFlagAction(f, "approve")}
                          disabled={busy === f.id}
                        >
                          Approve job
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resolveFlagAction(f, "remove")}
                          disabled={busy === f.id}
                        >
                          Remove job
                        </Button>
                      </>
                    )}
                    {f.targetType === "user" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resolveFlagAction(f, "warn_user")}
                          disabled={busy === f.id}
                        >
                          Warn user
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resolveFlagAction(f, "suspend_user")}
                          disabled={busy === f.id}
                        >
                          Suspend
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => resolveFlagAction(f, "ban_user")}
                          disabled={busy === f.id}
                        >
                          Ban
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === "history" && (
        <>
          {history.length === 0 ? (
            <Empty>
              No history yet. Resolved + dismissed reports show up here for the
              last 200 decisions — useful for spot-checking your own consistency
              and for second-admin oversight later.
            </Empty>
          ) : (
            <ul className="space-y-2">
              {history.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl p-4 bg-[var(--color-paper)] border border-[var(--color-line)] flex items-start justify-between gap-3 flex-wrap"
                >
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge tone={r.status === "resolved" ? "sage" : "stone"}>
                        {r.status}
                        {r.resolution ? ` · ${r.resolution.replace(/_/g, " ")}` : ""}
                      </Badge>
                      <Badge tone="stone">{REASON_LABELS[r.reason] ?? r.reason}</Badge>
                      <Badge tone="stone">{r.targetType}</Badge>
                    </div>
                    <p className="text-xs text-[var(--color-ink-soft)]">
                      &ldquo;{r.description}&rdquo;
                    </p>
                    {r.resolverNote && (
                      <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
                        Note: {r.resolverNote}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-[11px] text-[var(--color-ink-muted)] flex-shrink-0">
                    <p>Reported: {new Date(r.createdAt).toLocaleDateString()}</p>
                    {r.resolvedAt && (
                      <p>Resolved: {new Date(r.resolvedAt).toLocaleDateString()}</p>
                    )}
                    {r.targetType === "job" && r.targetId && (
                      <Link
                        href={`/jobs?id=${r.targetId}`}
                        target="_blank"
                        className="underline text-[var(--color-ink)] mt-1 inline-block"
                      >
                        Open job →
                      </Link>
                    )}
                    {r.targetType === "user" && r.targetId && (
                      <Link
                        href={`/u?id=${r.targetId}`}
                        target="_blank"
                        className="underline text-[var(--color-ink)] mt-1 inline-block"
                      >
                        Open profile →
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function TabChip({
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
      className={`px-4 py-2 rounded-pill text-sm transition-colors ${
        active
          ? "bg-[var(--color-ink)] text-[var(--color-cream)]"
          : "bg-[var(--color-paper)] border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:bg-[var(--color-cream-2)]"
      }`}
    >
      {children}
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-10 bg-[var(--color-paper)] border border-dashed border-[var(--color-line)] text-center text-[var(--color-ink-muted)] text-sm">
      {children}
    </div>
  );
}
