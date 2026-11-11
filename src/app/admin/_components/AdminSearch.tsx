"use client";

/**
 * Global admin search — find any user or job from anywhere in the admin.
 *
 * - Users: display-name prefix match (server-side range query), exact email
 *   (when the query contains "@"), or direct uid lookup (long token, no spaces).
 * - Jobs: title prefix match.
 * - "/" focuses it from anywhere (wired in admin/page.tsx); Esc closes.
 * - Picking a user opens the UserDrawer (inline actions); picking a job opens
 *   the job workspace in a new tab.
 */

import { useEffect, useRef, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAt,
  endAt,
  where,
} from "firebase/firestore";
import Avatar from "@/components/Avatar";
import Badge from "@/components/Badge";
import { getDb } from "@/lib/firebase";
import type { Job, UserProfile } from "@/lib/types";

type UserHit = UserProfile & { kind: "user" };
type JobHit = Job & { kind: "job" };
type Hit = UserHit | JobHit;

const SENTINEL = "";

async function searchUsers(q: string): Promise<UserHit[]> {
  const users = collection(getDb(), "users");
  const hits = new Map<string, UserProfile>();

  // Exact email
  if (q.includes("@")) {
    const snap = await getDocs(query(users, where("email", "==", q.toLowerCase()), limit(3)));
    snap.docs.forEach((d) => hits.set(d.id, { ...(d.data() as UserProfile), uid: d.id }));
  }

  // Direct uid (Firebase uids are 20+ chars, no spaces)
  if (q.length >= 20 && !q.includes(" ") && !q.includes("@")) {
    try {
      const d = await getDoc(doc(getDb(), "users", q));
      if (d.exists()) hits.set(d.id, { ...(d.data() as UserProfile), uid: d.id });
    } catch {
      /* ignore */
    }
  }

  // Display-name prefix (case-sensitive — matches how names are stored)
  try {
    const snap = await getDocs(
      query(users, orderBy("displayName"), startAt(q), endAt(q + SENTINEL), limit(5)),
    );
    snap.docs.forEach((d) => hits.set(d.id, { ...(d.data() as UserProfile), uid: d.id }));
    // Also try capitalised first letter so "thabo" finds "Thabo"
    if (q[0] && q[0] !== q[0].toUpperCase()) {
      const cap = q[0].toUpperCase() + q.slice(1);
      const snap2 = await getDocs(
        query(users, orderBy("displayName"), startAt(cap), endAt(cap + SENTINEL), limit(5)),
      );
      snap2.docs.forEach((d) => hits.set(d.id, { ...(d.data() as UserProfile), uid: d.id }));
    }
  } catch {
    /* ignore */
  }

  return Array.from(hits.values()).slice(0, 6).map((u) => ({ ...u, kind: "user" as const }));
}

async function searchJobs(q: string): Promise<JobHit[]> {
  const jobs = collection(getDb(), "jobs");
  const hits = new Map<string, Job>();
  try {
    const snap = await getDocs(
      query(jobs, orderBy("title"), startAt(q), endAt(q + SENTINEL), limit(4)),
    );
    snap.docs.forEach((d) => hits.set(d.id, { ...(d.data() as Job), id: d.id }));
    if (q[0] && q[0] !== q[0].toUpperCase()) {
      const cap = q[0].toUpperCase() + q.slice(1);
      const snap2 = await getDocs(
        query(jobs, orderBy("title"), startAt(cap), endAt(cap + SENTINEL), limit(4)),
      );
      snap2.docs.forEach((d) => hits.set(d.id, { ...(d.data() as Job), id: d.id }));
    }
  } catch {
    /* ignore */
  }
  // Direct job id
  if (q.length >= 15 && !q.includes(" ")) {
    try {
      const d = await getDoc(doc(getDb(), "jobs", q));
      if (d.exists()) hits.set(d.id, { ...(d.data() as Job), id: d.id });
    } catch {
      /* ignore */
    }
  }
  return Array.from(hits.values()).slice(0, 4).map((j) => ({ ...j, kind: "job" as const }));
}

export default function AdminSearch({ onSelectUser }: { onSelectUser: (uid: string) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setOpen(false);
      return;
    }
    debounce.current = setTimeout(async () => {
      setBusy(true);
      try {
        const [users, jobs] = await Promise.all([searchUsers(term), searchJobs(term)]);
        setHits([...users, ...jobs]);
        setOpen(true);
      } finally {
        setBusy(false);
      }
    }, 280);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [q]);

  // Click-outside closes
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div ref={boxRef} className="relative w-full">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-muted)]" aria-hidden>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.5" y2="16.5" />
          </svg>
        </span>
        <input
          id="admin-global-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => hits.length > 0 && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="Search users & jobs…  ( / )"
          className="w-full pl-9 pr-3 py-2 rounded-pill text-sm bg-[var(--color-cream-2)]/60 border border-[var(--color-line)] focus:bg-[var(--color-paper)] focus:border-[var(--color-ochre-300)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ochre-300)]/40 transition-all text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)]"
        />
      </div>

      {open && (
        <div className="absolute top-full mt-2 left-0 right-0 z-50 rounded-xl bg-[var(--color-paper)] border border-[var(--color-line)] shadow-lift overflow-hidden animate-fade-in">
          {busy && hits.length === 0 ? (
            <p className="p-4 text-sm text-[var(--color-ink-muted)]">Searching…</p>
          ) : hits.length === 0 ? (
            <p className="p-4 text-sm text-[var(--color-ink-muted)]">
              No matches. Names are prefix-matched; emails must be exact.
            </p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto divide-y divide-[var(--color-line)]">
              {hits.map((h) =>
                h.kind === "user" ? (
                  <li key={`u-${h.uid}`}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectUser(h.uid);
                        setOpen(false);
                      }}
                      className="w-full text-left p-3 flex items-center gap-3 hover:bg-[var(--color-cream-2)]/60 transition-colors"
                    >
                      <Avatar name={h.displayName} photoURL={h.photoURL} size="xs" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium truncate">{h.displayName || "Unnamed"}</span>
                        <span className="block text-xs text-[var(--color-ink-muted)] truncate">{h.email}</span>
                      </span>
                      <Badge tone={h.role === "worker" ? "sage" : h.role === "admin" ? "ink" : "ochre"}>{h.role}</Badge>
                    </button>
                  </li>
                ) : (
                  <li key={`j-${h.id}`}>
                    <a
                      href={`/jobs?id=${h.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full text-left p-3 flex items-center gap-3 hover:bg-[var(--color-cream-2)]/60 transition-colors"
                    >
                      <span className="w-6 h-6 rounded-md bg-[var(--color-ochre-50)] border border-[var(--color-ochre-300)] flex items-center justify-center text-xs" aria-hidden>
                        🧰
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium truncate">{h.title}</span>
                        <span className="block text-xs text-[var(--color-ink-muted)] truncate">
                          {h.suburb} · R {h.suggestedPrice}
                        </span>
                      </span>
                      <Badge tone={h.status === "open" ? "sage" : h.status === "disputed" ? "brick" : "stone"}>
                        {h.status}
                      </Badge>
                    </a>
                  </li>
                ),
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
