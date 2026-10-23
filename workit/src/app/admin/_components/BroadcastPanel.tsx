"use client";

/**
 * Admin broadcast composer. Sends a push notification to a chosen audience via
 * the `sendBroadcast` callable (admin + 2FA gated, daily-capped server-side).
 * Shows a live preview, a confirm gate, the result, and recent send history.
 */

import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import Button from "@/components/Button";
import Input from "@/components/Input";
import { getDb, getFunctionsInstance } from "@/lib/firebase";
import { useConfirm } from "@/contexts/ConfirmContext";

type Segment = "all" | "workers" | "employers" | "available";

const SEGMENTS: { id: Segment; label: string; hint: string }[] = [
  { id: "all", label: "Everyone", hint: "All users with notifications on" },
  { id: "workers", label: "Workers", hint: "Worker accounts only" },
  { id: "employers", label: "Employers & businesses", hint: "People who hire" },
  { id: "available", label: "Available-now workers", hint: "Flagged available in the last 8h" },
];

type Broadcast = {
  id: string;
  title: string;
  body: string;
  segment: string;
  recipients?: number;
  devices?: number;
  sent?: number;
  failed?: number;
  adminName?: string;
  createdAt: number;
};

export default function BroadcastPanel() {
  const confirm = useConfirm();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [segment, setSegment] = useState<Segment>("all");
  const [href, setHref] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ sent: number; devices: number; recipients: number } | null>(null);
  const [history, setHistory] = useState<Broadcast[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(getDb(), "broadcasts"), orderBy("createdAt", "desc"), limit(20)),
      (snap) => setHistory(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Broadcast, "id">) }))),
      () => setHistory([]),
    );
    return () => unsub();
  }, []);

  const segLabel = useMemo(
    () => SEGMENTS.find((s) => s.id === segment)?.label ?? segment,
    [segment],
  );

  const canSend = title.trim().length > 0 && body.trim().length > 0 && !busy;

  const send = async () => {
    if (!canSend) return;
    const ok = await confirm({
      title: `Send to ${segLabel}?`,
      body: `This pushes a notification to everyone in "${segLabel}" who has notifications on. It can't be unsent.`,
      tone: "warning",
      confirmLabel: "Send broadcast",
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const fn = httpsCallable<
        { title: string; body: string; segment: Segment; href?: string },
        { recipients: number; devices: number; sent: number; failed: number }
      >(getFunctionsInstance(), "sendBroadcast");
      const res = await fn({
        title: title.trim(),
        body: body.trim(),
        segment,
        ...(href.trim() ? { href: href.trim() } : {}),
      });
      setResult(res.data);
      setTitle("");
      setBody("");
      setHref("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the broadcast.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_22rem] gap-6 items-start">
      {/* COMPOSER */}
      <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">Audience</label>
            <div className="grid sm:grid-cols-2 gap-2">
              {SEGMENTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSegment(s.id)}
                  className={`text-left px-3 py-2.5 rounded-xl border transition-colors ${
                    segment === s.id
                      ? "border-[var(--color-ochre-500)] bg-[var(--color-ochre-50)]"
                      : "border-[var(--color-line)] hover:bg-[var(--color-cream-2)]"
                  }`}
                >
                  <span className="block text-sm font-medium text-[var(--color-ink)]">{s.label}</span>
                  <span className="block text-[11px] text-[var(--color-ink-muted)]">{s.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Title"
            name="bc-title"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 80))}
            placeholder="Workit is now in Tembisa 🎉"
            hint={`${title.length}/80`}
          />
          <div>
            <label htmlFor="bc-body" className="block text-sm font-medium text-[var(--color-ink)] mb-1.5">
              Message
            </label>
            <textarea
              id="bc-body"
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, 300))}
              rows={3}
              placeholder="New jobs are opening near you — open Workit to take a look."
              className="w-full px-4 py-3 rounded-xl bg-[var(--color-paper)] border border-[var(--color-line)] focus:border-[var(--color-ochre-500)] focus:outline-none text-[var(--color-ink)] text-sm"
            />
            <p className="text-[10px] text-[var(--color-ink-muted)] text-right mt-1">{body.length}/300</p>
          </div>
          <Input
            label="Link (optional)"
            name="bc-href"
            value={href}
            onChange={(e) => setHref(e.target.value)}
            placeholder="/find-work"
            hint="In-app path to open when tapped, e.g. /find-work"
          />

          {error && <p className="text-sm text-[var(--color-brick)]">{error}</p>}
          {result && (
            <div className="rounded-xl p-4 bg-[var(--color-sage-100)] text-sm text-[var(--color-sage-700)]">
              ✓ Sent to {result.sent} of {result.devices} devices across {result.recipients} people.
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <Button onClick={send} variant="primary" disabled={!canSend} loading={busy} loadingText="Sending…">
              Send broadcast
            </Button>
            <span className="text-xs text-[var(--color-ink-muted)]">
              Requires two-step verification · max 5 per day
            </span>
          </div>
        </div>
      </div>

      {/* PREVIEW + HISTORY */}
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold mb-2">
            Preview
          </p>
          <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-cream-2)] p-4 flex gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-ochre-500)] flex items-center justify-center text-[var(--color-cream)] text-sm font-bold flex-shrink-0">
              W
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--color-ink)] truncate">
                {title.trim() || "Notification title"}
              </p>
              <p className="text-xs text-[var(--color-ink-soft)] line-clamp-3">
                {body.trim() || "Your message preview shows here as users will see it."}
              </p>
              <p className="text-[10px] text-[var(--color-ink-muted)] mt-1">Workit · now</p>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold mb-2">
            Recent broadcasts
          </p>
          {history.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-muted)]">None sent yet.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((b) => (
                <li key={b.id} className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] p-3">
                  <p className="text-sm font-medium text-[var(--color-ink)] truncate">{b.title}</p>
                  <p className="text-[11px] text-[var(--color-ink-muted)]">
                    {b.segment} · {b.sent ?? 0}/{b.devices ?? 0} devices ·{" "}
                    {new Date(b.createdAt).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })}
                    {b.adminName ? ` · ${b.adminName}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
