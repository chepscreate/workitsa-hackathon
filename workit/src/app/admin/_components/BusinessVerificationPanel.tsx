"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import Avatar from "@/components/Avatar";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import Textarea from "@/components/Textarea";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { logAudit } from "@/lib/audit";
import { CATEGORIES, type CategoryId, type UserProfile } from "@/lib/types";

export default function BusinessVerificationPanel() {
  const { profile } = useAuth();
  const [pending, setPending] = useState<UserProfile[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(getDb(), "users"), where("businessVerification.status", "==", "pending")),
      (snap) => setPending(snap.docs.map((d) => ({ ...(d.data() as UserProfile), uid: d.id }))),
    );
    return () => unsub();
  }, []);

  const review = async (b: UserProfile, decision: "approved" | "rejected") => {
    if (!profile) return;
    setBusy(b.uid);
    try {
      const note = notes[b.uid]?.trim();
      await updateDoc(doc(getDb(), "users", b.uid), {
        "businessVerification.status": decision,
        "businessVerification.reviewedAt": Date.now(),
        ...(note ? { "businessVerification.reviewerNote": note } : {}),
      });
      await logAudit({
        adminUid: profile.uid,
        adminName: profile.displayName,
        action: decision === "approved" ? "business_verify_approve" : "business_verify_reject",
        targetUid: b.uid,
        targetName: b.businessName || b.displayName,
        note: note || undefined,
      });
      setNotes((n) => ({ ...n, [b.uid]: "" }));
    } finally {
      setBusy(null);
    }
  };

  if (pending.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-10 text-center text-sm text-[var(--color-ink-muted)]">
        No businesses waiting for verification.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pending.map((b) => {
        const v = b.businessVerification ?? {};
        const name = b.businessName || b.displayName || "Business";
        return (
          <article
            key={b.uid}
            className="rounded-2xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft"
          >
            <div className="flex items-start gap-3 flex-wrap">
              <Avatar name={name} photoURL={b.businessLogoURL || b.photoURL} size="md" />
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-xl">
                  <Link href={`/business?id=${b.uid}`} target="_blank" className="hover:underline">
                    {name}
                  </Link>
                </h3>
                <p className="text-sm text-[var(--color-ink-muted)]">{b.email}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(b.businessCategories ?? []).map((c: CategoryId) => (
                    <Badge key={c} tone="ochre">
                      {CATEGORIES.find((x) => x.id === c)?.label ?? c}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="text-right text-xs text-[var(--color-ink-muted)]">
                {v.submittedAt && <p>Submitted {new Date(v.submittedAt).toLocaleString()}</p>}
              </div>
            </div>

            <dl className="mt-4 grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
                  Registration (CIPC) number
                </dt>
                <dd className="mt-1 text-[var(--color-ink)]">{v.registrationNumber || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
                  Proof document
                </dt>
                <dd className="mt-1">
                  {v.registrationProofURL ? (
                    <a
                      href={v.registrationProofURL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-[var(--color-ink)]"
                    >
                      View document →
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>

            <div className="mt-4">
              <Textarea
                label="Reviewer note (optional, shown to the business)"
                name={`bv-note-${b.uid}`}
                rows={2}
                value={notes[b.uid] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [b.uid]: e.target.value }))}
              />
              <div className="mt-3 flex flex-wrap gap-2 justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => review(b, "rejected")}
                  loading={busy === b.uid}
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => review(b, "approved")}
                  loading={busy === b.uid}
                >
                  Verify business
                </Button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
