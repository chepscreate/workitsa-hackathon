"use client";

/**
 * POPIA deletion-request queue. Users file requests from /profile ("Your data
 * rights"); this panel is where the admin actions them. "Erase" calls the
 * eraseUserData Cloud Function: wipes Storage folders + private doc +
 * subcollections, anonymises the public profile, deletes the Auth account,
 * closes the request, and writes an audit entry. Irreversible by design.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import Button from "@/components/Button";
import { getDb, getFunctionsInstance } from "@/lib/firebase";
import { useConfirm } from "@/contexts/ConfirmContext";

type DeletionRequest = {
  id: string;
  uid: string;
  displayName: string;
  reason?: string;
  requestedAt: number;
};

export default function DeletionRequestsPanel() {
  const confirm = useConfirm();
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      query(
        collection(getDb(), "deletionRequests"),
        where("status", "==", "pending"),
        orderBy("requestedAt", "asc"),
      ),
      (snap) =>
        setRequests(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DeletionRequest, "id">) })),
        ),
      () => setRequests([]),
    );
    return () => unsub();
  }, []);

  if (requests.length === 0) return null;

  const erase = async (r: DeletionRequest) => {
    const ok = await confirm({
      title: `Erase ${r.displayName}'s account?`,
      body:
        "This permanently deletes their documents, photos, private data and sign-in, and " +
        "anonymises their profile. Job history stays (5-year dispute record). This cannot be undone.",
      tone: "danger",
      confirmLabel: "Yes, erase permanently",
    });
    if (!ok) return;
    setBusy(r.id);
    setError(null);
    try {
      const fn = httpsCallable<{ requestId: string }, { ok: boolean; issues: string[] }>(
        getFunctionsInstance(),
        "eraseUserData",
      );
      const res = await fn({ requestId: r.id });
      if (res.data?.issues?.length) {
        setError(`Erased with ${res.data.issues.length} issue(s) — see the request doc in Firestore.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erasure failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mb-6 rounded-2xl border border-[var(--color-brick)] bg-[var(--color-brick-soft)]/30 p-5">
      <h2 className="font-display text-xl text-[var(--color-ink)]">
        ⚠ Deletion requests ({requests.length})
      </h2>
      <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
        POPIA requires these to be actioned within 7 days of the request.
      </p>
      {error && <p className="mt-2 text-sm text-[var(--color-brick)]">{error}</p>}
      <ul className="mt-4 divide-y divide-[var(--color-line)]">
        {requests.map((r) => (
          <li key={r.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <Link href={`/u?id=${r.uid}`} target="_blank" className="font-medium hover:underline">
                {r.displayName}
              </Link>
              <p className="text-xs text-[var(--color-ink-muted)]">
                Requested {new Date(r.requestedAt).toLocaleString()}
                {r.reason ? ` · “${r.reason}”` : ""}
              </p>
            </div>
            <Button
              size="sm"
              variant="danger"
              onClick={() => erase(r)}
              loading={busy === r.id}
              loadingText="Erasing…"
            >
              Erase account
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
