"use client";

/**
 * Users tab — cursor-paginated.
 *
 * Previously this read the ENTIRE users collection on every open (getDocs on the
 * whole collection) and filtered/sorted client-side. Now:
 *  - List loads 25 at a time, ordered by createdAt desc, with "Load more"
 *    (cursor via startAfter) — no full-collection read on open.
 *  - Role / suspended filters run server-side (where + orderBy → composite index).
 *  - Stat-card totals come from count() aggregation (no doc reads).
 *  - Search filters the rows already loaded (Firestore has no full-text search);
 *    a hint tells the admin to "load more" to widen it.
 *  - CSV export reads the full filtered set, but only when explicitly clicked.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  collection,
  getCountFromServer,
  getDocs,
  limit as fbLimit,
  orderBy,
  query,
  startAfter,
  where,
  type Query,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import { getDb } from "@/lib/firebase";
import { downloadCsv } from "@/lib/csv";
import type { UserProfile } from "@/lib/types";

const PAGE_SIZE = 25;
type Filter = "all" | "employer" | "worker" | "admin" | "suspended";
const FILTERS: Filter[] = ["all", "employer", "worker", "admin", "suspended"];

function filterClauses(filter: Filter): QueryConstraint[] {
  if (filter === "suspended") return [where("accountStatus", "==", "suspended")];
  if (filter !== "all") return [where("role", "==", filter)];
  return [];
}

export default function UsersTab({ onOpenUser }: { onOpenUser?: (uid: string) => void }) {
  const [rows, setRows] = useState<UserProfile[]>([]);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [totals, setTotals] = useState<Record<Filter, number>>({
    all: 0,
    employer: 0,
    worker: 0,
    admin: 0,
    suspended: 0,
  });
  const cursor = useRef<QueryDocumentSnapshot | null>(null);

  // Stat-card totals via server-side count() — no document reads.
  useEffect(() => {
    const base = collection(getDb(), "users");
    const countOf = (q: Query) =>
      getCountFromServer(q)
        .then((s) => s.data().count)
        .catch(() => 0);
    Promise.all([
      countOf(query(base)),
      countOf(query(base, where("role", "==", "employer"))),
      countOf(query(base, where("role", "==", "worker"))),
      countOf(query(base, where("role", "==", "admin"))),
      countOf(query(base, where("accountStatus", "==", "suspended"))),
    ]).then(([all, employer, worker, admin, suspended]) =>
      setTotals({ all, employer, worker, admin, suspended }),
    );
  }, []);

  const fetchPage = useCallback(
    async (reset: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const after = reset ? null : cursor.current;
        const q = query(
          collection(getDb(), "users"),
          ...filterClauses(filter),
          orderBy("createdAt", "desc"),
          ...(after ? [startAfter(after)] : []),
          fbLimit(PAGE_SIZE),
        );
        const snap = await getDocs(q);
        cursor.current = snap.docs.length
          ? snap.docs[snap.docs.length - 1]
          : after;
        const page = snap.docs.map(
          (d) => ({ ...(d.data() as UserProfile), uid: d.id }),
        );
        setRows((prev) => (reset ? page : [...prev, ...page]));
        setDone(snap.docs.length < PAGE_SIZE);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not load users.";
        // A "requires an index" error means the composite index is still building.
        setError(
          msg.includes("index")
            ? "Index is still building — give it a minute and refresh."
            : msg,
        );
      } finally {
        setLoading(false);
      }
    },
    [filter],
  );

  // Reset + load first page on mount and whenever the filter changes.
  useEffect(() => {
    cursor.current = null;
    setRows([]);
    setDone(false);
    fetchPage(true);
  }, [fetchPage]);

  const q = search.trim().toLowerCase();
  const visible = q
    ? rows.filter((u) =>
        [u.displayName, u.email, u.phone, u.suburb]
          .filter(Boolean)
          .some((s) => (s as string).toLowerCase().includes(q)),
      )
    : rows;

  const onExport = async () => {
    setExporting(true);
    try {
      const snap = await getDocs(
        query(
          collection(getDb(), "users"),
          ...filterClauses(filter),
          orderBy("createdAt", "desc"),
        ),
      );
      const all = snap.docs.map((d) => ({ ...(d.data() as UserProfile), uid: d.id }));
      downloadCsv(
        `workit-users-${new Date().toISOString().split("T")[0]}.csv`,
        all.map((u) => ({
          uid: u.uid,
          displayName: u.displayName,
          email: u.email,
          phone: u.phone ?? "",
          role: u.role,
          accountStatus: u.accountStatus ?? "",
          verificationStatus: u.verificationStatus ?? "",
          backgroundVerified: u.backgroundVerified ? "yes" : "no",
          suburb: u.suburb ?? "",
          city: u.city ?? "",
          ratingAvg: u.ratingAvg ?? "",
          ratingCount: u.ratingCount ?? 0,
          jobsCompleted: u.jobsCompleted ?? 0,
          createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : "",
        })),
        [
          { key: "uid", label: "UID" },
          { key: "displayName", label: "Name" },
          { key: "email", label: "Email" },
          { key: "phone", label: "Phone" },
          { key: "role", label: "Role" },
          { key: "accountStatus", label: "Account" },
          { key: "verificationStatus", label: "Verification" },
          { key: "backgroundVerified", label: "Background" },
          { key: "suburb", label: "Suburb" },
          { key: "city", label: "City" },
          { key: "ratingAvg", label: "Avg rating" },
          { key: "ratingCount", label: "# ratings" },
          { key: "jobsCompleted", label: "Jobs done" },
          { key: "createdAt", label: "Joined" },
        ],
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mt-6">
      {/* Stats */}
      <div className="grid sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Total signups" value={totals.all} />
        <Stat label="Employers" value={totals.employer} tone="ochre" />
        <Stat label="Workers" value={totals.worker} tone="sage" />
        <Stat label="Suspended" value={totals.suspended} />
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-3">
        {FILTERS.map((f) => (
          <FilterChip key={f} active={filter === f} onClick={() => setFilter(f)}>
            {capitalise(f)}{" "}
            <span className="text-[var(--color-ink-muted)]">({totals[f]})</span>
          </FilterChip>
        ))}
      </div>

      {/* Search + CSV export */}
      <div className="flex gap-2 mb-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search loaded users — name, email, phone, suburb…"
          className="flex-1 px-4 py-3 rounded-pill bg-[var(--color-paper)] border border-[var(--color-line)] focus:border-[var(--color-ochre-500)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ochre-300)] transition-[border-color,box-shadow] text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)] text-sm"
        />
        <Button
          variant="outline"
          size="md"
          onClick={onExport}
          loading={exporting}
          loadingText="Exporting…"
          className="whitespace-nowrap"
        >
          ⬇ Export CSV
        </Button>
      </div>
      <p className="text-xs text-[var(--color-ink-muted)] mb-5">
        Search filters the {rows.length} user{rows.length === 1 ? "" : "s"} loaded
        so far — use <b>Load more</b> to widen it. CSV export covers the whole{" "}
        {filter === "all" ? "list" : `“${filter}” list`}.
      </p>

      {/* Table */}
      {error ? (
        <div className="rounded-xl p-10 bg-[var(--color-paper)] border border-dashed border-[var(--color-line)] text-center text-[var(--color-brick)]">
          {error}
        </div>
      ) : visible.length === 0 && !loading ? (
        <div className="rounded-xl p-10 bg-[var(--color-paper)] border border-dashed border-[var(--color-line)] text-center text-[var(--color-ink-muted)]">
          {q ? "No loaded users match your search." : "No users in this filter."}
        </div>
      ) : (
        <div className="rounded-2xl bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft overflow-hidden">
          <ul className="divide-y divide-[var(--color-line)]">
            {visible.map((u) => (
              <li
                key={u.uid}
                className="p-4 sm:p-5 flex items-center gap-4 hover:bg-[var(--color-cream-2)]/40 transition-colors"
              >
                <Avatar name={u.displayName} photoURL={u.photoURL} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/u?id=${u.uid}`}
                      target="_blank"
                      className="font-display text-base text-[var(--color-ink)] hover:underline truncate"
                    >
                      {u.displayName || "Unnamed user"}
                    </Link>
                    <Badge tone={u.role === "worker" ? "sage" : u.role === "admin" ? "ink" : "ochre"}>
                      {u.role}
                    </Badge>
                    <Badge tone={u.accountStatus === "approved" ? "sage" : u.accountStatus === "suspended" ? "brick" : "stone"}>
                      {u.accountStatus ?? "approved (legacy)"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-ink-muted)] truncate">
                    {[u.email, u.phone, u.suburb].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <div className="text-right text-xs text-[var(--color-ink-muted)] flex-shrink-0 hidden sm:block">
                  Joined<br />
                  {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                </div>
                {onOpenUser && (
                  <button
                    type="button"
                    onClick={() => onOpenUser(u.uid)}
                    className="flex-shrink-0 px-3 py-1.5 rounded-pill text-xs font-medium bg-[var(--color-ink)] text-[var(--color-cream)] hover:opacity-90 transition-opacity"
                  >
                    Manage
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Load more */}
      <div className="mt-4 flex items-center justify-center gap-3">
        {!done && !error && (
          <Button variant="outline" size="md" onClick={() => fetchPage(false)} loading={loading} loadingText="Loading…">
            Load more
          </Button>
        )}
        <span className="text-xs text-[var(--color-ink-muted)]">
          {rows.length} loaded{done ? " · end of list" : ""}
        </span>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "ink",
}: {
  label: string;
  value: number | string;
  tone?: "ink" | "ochre" | "sage";
}) {
  const cls =
    tone === "ochre"
      ? "bg-[var(--color-ochre-50)] border-[var(--color-ochre-300)]"
      : tone === "sage"
        ? "bg-[var(--color-sage-100)]/40 border-[var(--color-sage-400)]/40"
        : "bg-[var(--color-cream-2)] border-[var(--color-line)]";
  return (
    <div className={`rounded-2xl p-4 border ${cls}`}>
      <p className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">{label}</p>
      <p className="mt-1 font-display text-3xl text-[var(--color-ink)]">{value}</p>
    </div>
  );
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
