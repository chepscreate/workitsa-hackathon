"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import Button from "@/components/Button";

/**
 * Internal admin-to-admin note about a user — "called him, docs coming
 * Monday". NEVER visible to the user: stored in the top-level adminNotes/{uid}
 * collection (admin-only rules), deliberately NOT under users/{uid} where the
 * owner can read their own private subtree. Shared context for when more than
 * one admin works the queues.
 */
export default function AdminNoteField({
  uid,
  adminUid,
  adminName,
}: {
  uid: string;
  adminUid: string;
  adminName: string;
}) {
  const [text, setText] = useState("");
  const [savedText, setSavedText] = useState("");
  const [meta, setMeta] = useState<{ by: string; at: number } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDoc(doc(getDb(), "adminNotes", uid))
      .then((snap) => {
        if (cancelled) return;
        const d = snap.data();
        const t = String(d?.text ?? "");
        setText(t);
        setSavedText(t);
        if (d?.updatedByName && d?.updatedAt) {
          setMeta({ by: String(d.updatedByName), at: Number(d.updatedAt) });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const onSave = async () => {
    setSaving(true);
    setError(false);
    try {
      await setDoc(doc(getDb(), "adminNotes", uid), {
        text: text.trim(),
        updatedAt: Date.now(),
        updatedBy: adminUid,
        updatedByName: adminName,
      });
      setSavedText(text);
      setMeta({ by: adminName, at: Date.now() });
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;
  const dirty = text !== savedText;

  return (
    <div className="rounded-xl border border-dashed border-[var(--color-line)] bg-[var(--color-cream-2)]/50 p-3">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <p className="text-[11px] uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold">
          🔒 Internal note — admins only, the user never sees this
        </p>
        {meta && !dirty && (
          <p className="text-[10px] text-[var(--color-ink-muted)]">
            {meta.by} · {new Date(meta.at).toLocaleDateString()}
          </p>
        )}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={text || dirty ? 2 : 1}
        placeholder="e.g. Called him — ID photo coming Monday."
        className="mt-2 w-full px-3 py-2 rounded-md bg-[var(--color-paper)] border border-[var(--color-line)] focus:border-[var(--color-ochre-500)] focus:outline-none text-sm text-[var(--color-ink)]"
      />
      {error && (
        <p className="mt-1 text-xs text-[var(--color-brick)]">Couldn&apos;t save — try again.</p>
      )}
      {dirty && (
        <div className="mt-2 flex justify-end">
          <Button size="sm" variant="outline" onClick={onSave} loading={saving} loadingText="Saving…">
            Save note
          </Button>
        </div>
      )}
    </div>
  );
}
