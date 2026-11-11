"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, updateDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";

/**
 * Outreach pipeline view — the B2B lead list the automated emailer works
 * through (marketingLeads; admin read/update via rules). Replies land in the
 * founder's Gmail; THIS is where he closes the loop by marking a lead
 * replied / signed-up, so the pipeline's real conversion is visible and the
 * weekly lead-research routine can learn which categories convert.
 */

type Lead = {
  id: string;
  businessName?: string;
  email?: string;
  contactName?: string;
  suburb?: string;
  category?: string;
  status?: string;
  sentAt?: number;
  createdAt?: number;
};

const STATUS_TONE: Record<string, "ochre" | "sage" | "brick" | "stone"> = {
  pending: "stone",
  sent: "ochre",
  replied: "sage",
  won: "sage",
  optout: "brick",
  bounced: "brick",
  skipped: "stone",
};

const FILTERS = ["all", "pending", "sent", "replied", "won", "optout", "bounced"] as const;

export default function OutreachPanel() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(getDb(), "marketingLeads"));
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Lead, "id">) }))
        .sort((a, b) => (b.sentAt ?? b.createdAt ?? 0) - (a.sentAt ?? a.createdAt ?? 0));
      setLeads(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of leads) c[l.status ?? "pending"] = (c[l.status ?? "pending"] ?? 0) + 1;
    return c;
  }, [leads]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads
      .filter((l) => (filter === "all" ? true : (l.status ?? "pending") === filter))
      .filter((l) =>
        q
          ? `${l.businessName} ${l.email} ${l.suburb} ${l.category}`.toLowerCase().includes(q)
          : true,
      );
  }, [leads, filter, search]);

  const setStatus = async (id: string, status: string) => {
    setBusyId(id);
    try {
      await updateDoc(doc(getDb(), "marketingLeads", id), { status, updatedAt: Date.now() });
      setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      {/* Pipeline counts */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {(["pending", "sent", "replied", "won", "optout", "bounced"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(filter === s ? "all" : s)}
            className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
              filter === s
                ? "bg-[var(--color-ochre-50)] border-[var(--color-ochre-500)]"
                : "bg-[var(--color-cream-2)] border-[var(--color-line)] hover:border-[var(--color-ochre-300)]"
            }`}
          >
            <p className="text-[10px] uppercase tracking-widest text-[var(--color-ink-muted)]">
              {s === "optout" ? "opted out" : s === "won" ? "signed up" : s}
            </p>
            <p className="font-display text-xl text-[var(--color-ink)]">{counts[s] ?? 0}</p>
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search business, email, suburb, category…"
          aria-label="Search leads"
          className="flex-1 min-w-[14rem] px-4 py-2.5 rounded-pill bg-[var(--color-paper)] border border-[var(--color-line)] focus:border-[var(--color-ochre-500)] focus:outline-none text-sm"
        />
        <p className="text-xs text-[var(--color-ink-muted)]">
          {visible.length} of {leads.length} · replies arrive in your Gmail — mark them here
        </p>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-[var(--color-ink-muted)]">Loading pipeline…</p>
      ) : visible.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            kind="no-results"
            title={leads.length === 0 ? "No leads yet" : "Nothing matches this filter"}
            body={
              leads.length === 0
                ? "The Monday research routine stocks this pipeline automatically."
                : "Try another status chip or clear the search."
            }
          />
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {visible.map((l) => {
            const status = l.status ?? "pending";
            return (
              <div
                key={l.id}
                className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-3 flex items-center gap-3 flex-wrap"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm text-[var(--color-ink)] truncate">
                    {l.businessName ?? "—"}
                    <span className="ml-2 font-normal text-xs text-[var(--color-ink-muted)]">
                      {l.category ?? ""}
                      {l.suburb ? ` · ${l.suburb}` : ""}
                    </span>
                  </p>
                  <p className="text-xs text-[var(--color-ink-muted)] truncate">
                    {l.email}
                    {l.sentAt ? ` · emailed ${new Date(l.sentAt).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <Badge tone={STATUS_TONE[status] ?? "stone"}>
                  {status === "optout" ? "opted out" : status === "won" ? "signed up ✓" : status}
                </Badge>
                {(status === "sent" || status === "replied") && (
                  <div className="flex gap-1.5">
                    {status === "sent" && (
                      <button
                        type="button"
                        disabled={busyId === l.id}
                        onClick={() => setStatus(l.id, "replied")}
                        className="px-3 py-1.5 rounded-pill text-xs border border-[var(--color-sage-400)] text-[var(--color-sage-700)] hover:bg-[var(--color-sage-100)]/40 disabled:opacity-50"
                      >
                        Replied
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busyId === l.id}
                      onClick={() => setStatus(l.id, "won")}
                      className="px-3 py-1.5 rounded-pill text-xs bg-[var(--color-ink)] text-[var(--color-cream)] hover:opacity-90 disabled:opacity-50"
                    >
                      Signed up ✓
                    </button>
                  </div>
                )}
                {status === "pending" && (
                  <button
                    type="button"
                    disabled={busyId === l.id}
                    onClick={() => setStatus(l.id, "skipped")}
                    className="px-3 py-1.5 rounded-pill text-xs border border-[var(--color-line)] text-[var(--color-ink-muted)] hover:text-[var(--color-brick)] disabled:opacity-50"
                    title="Remove from the send queue without emailing"
                  >
                    Skip
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
