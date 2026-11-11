"use client";

/**
 * Admin WhatsApp support inbox — the read/reply side of the support front door.
 *
 * Inbound public messages (jarvisWhatsApp webhook) land in `supportMessages`;
 * this panel groups them by sender into threads, shows the conversation, and
 * lets an admin reply via the `replyToSupport` callable (which sends over the
 * WhatsApp Cloud API). WhatsApp only allows a free reply within 24h of the
 * customer's last message — the callable surfaces that limit, and we also show
 * a "window closing" hint here so it isn't a surprise.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import Button from "@/components/Button";
import { getDb, getFunctionsInstance } from "@/lib/firebase";

type SupportMsg = {
  id: string;
  waNumber: string;
  name?: string | null;
  text: string;
  direction: "inbound" | "outbound";
  handled?: boolean;
  adminName?: string;
  createdAt: number;
};

type Thread = {
  waNumber: string;
  name?: string | null;
  messages: SupportMsg[];
  lastAt: number;
  lastInboundAt: number;
  unread: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export default function SupportPanel() {
  const [messages, setMessages] = useState<SupportMsg[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeNumber, setActiveNumber] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      // Cap the live feed — the most recent 500 messages is plenty for the
      // inbox; older threads aren't useful to keep streaming.
      query(collection(getDb(), "supportMessages"), orderBy("createdAt", "desc"), limit(500)),
      (snap) => {
        setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SupportMsg, "id">) })));
        setLoaded(true);
      },
      () => setLoaded(true),
    );
    return () => unsub();
  }, []);

  // Keep "x hours left in the reply window" fresh.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const threads = useMemo<Thread[]>(() => {
    const byNumber = new Map<string, SupportMsg[]>();
    for (const m of messages) {
      const arr = byNumber.get(m.waNumber) ?? [];
      arr.push(m);
      byNumber.set(m.waNumber, arr);
    }
    const list: Thread[] = [];
    for (const [waNumber, msgs] of byNumber) {
      const ordered = [...msgs].sort((a, b) => a.createdAt - b.createdAt);
      const inbound = ordered.filter((m) => m.direction === "inbound");
      list.push({
        waNumber,
        name: ordered.find((m) => m.name)?.name ?? null,
        messages: ordered,
        lastAt: ordered[ordered.length - 1]?.createdAt ?? 0,
        lastInboundAt: inbound[inbound.length - 1]?.createdAt ?? 0,
        unread: inbound.filter((m) => !m.handled).length,
      });
    }
    return list.sort((a, b) => b.lastAt - a.lastAt);
  }, [messages]);

  // Derive the active thread with a fallback to the newest — no auto-select
  // effect needed (and no flash of "select a conversation" on first load).
  const active = threads.find((t) => t.waNumber === activeNumber) ?? threads[0] ?? null;

  // Keep the conversation scrolled to the latest message.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [active?.messages.length, active?.waNumber]);

  const windowOpen = active ? now - active.lastInboundAt < DAY_MS : false;
  const hoursLeft = active ? Math.max(0, Math.floor((DAY_MS - (now - active.lastInboundAt)) / 3_600_000)) : 0;

  const send = async () => {
    if (!active || reply.trim().length < 1) return;
    setBusy(true);
    setError(null);
    try {
      const fn = httpsCallable<{ toNumber: string; text: string }, { ok: boolean }>(
        getFunctionsInstance(),
        "replyToSupport",
      );
      await fn({ toNumber: active.waNumber, text: reply.trim() });
      setReply("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the reply.");
    } finally {
      setBusy(false);
    }
  };

  const resolve = async () => {
    if (!active) return;
    setBusy(true);
    setError(null);
    try {
      const fn = httpsCallable<{ toNumber: string }, { ok: boolean }>(
        getFunctionsInstance(),
        "resolveSupportThread",
      );
      await fn({ toNumber: active.waNumber });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update the thread.");
    } finally {
      setBusy(false);
    }
  };

  if (loaded && threads.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-10 text-center">
        <p className="text-3xl mb-2" aria-hidden>💬</p>
        <p className="font-display text-xl">No support messages yet</p>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          When someone messages the WhatsApp support line, the conversation shows up here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[20rem_1fr] gap-4 h-[calc(100vh-12rem)] min-h-[28rem]">
      {/* THREAD LIST */}
      <aside className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] overflow-y-auto">
        <ul className="divide-y divide-[var(--color-line)]">
          {threads.map((t) => {
            const isActive = t.waNumber === activeNumber;
            return (
              <li key={t.waNumber}>
                <button
                  type="button"
                  onClick={() => setActiveNumber(t.waNumber)}
                  className={`w-full text-left px-4 py-3 transition-colors ${
                    isActive ? "bg-[var(--color-cream-2)]" : "hover:bg-[var(--color-cream-2)]/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm text-[var(--color-ink)] truncate">
                      {t.name || `+${t.waNumber}`}
                    </span>
                    {t.unread > 0 && (
                      <span className="flex-shrink-0 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-bold bg-[var(--color-sage-600)] text-white">
                        {t.unread}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-ink-muted)] truncate mt-0.5">
                    {t.messages[t.messages.length - 1]?.text}
                  </p>
                  <p className="text-[10px] text-[var(--color-ink-muted)] mt-0.5">
                    {relativeTime(t.lastAt, now)}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* CONVERSATION */}
      <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] flex flex-col min-h-0">
        {active ? (
          <>
            <header className="px-5 py-3 border-b border-[var(--color-line)] flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-[var(--color-ink)] truncate">
                  {active.name || `+${active.waNumber}`}
                </p>
                <a
                  href={`https://wa.me/${active.waNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                >
                  +{active.waNumber} · open in WhatsApp ↗
                </a>
              </div>
              <Button size="sm" variant="outline" onClick={resolve} disabled={busy}>
                Mark resolved
              </Button>
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">
              {active.messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                      m.direction === "outbound"
                        ? "bg-[var(--color-sage-600)] text-white rounded-br-sm"
                        : "bg-[var(--color-cream-2)] text-[var(--color-ink)] rounded-bl-sm"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    <p
                      className={`mt-1 text-[10px] ${
                        m.direction === "outbound" ? "text-white/70" : "text-[var(--color-ink-muted)]"
                      }`}
                    >
                      {m.direction === "outbound" ? `${m.adminName ?? "Admin"} · ` : ""}
                      {relativeTime(m.createdAt, now)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-[var(--color-line)] p-3">
              {!windowOpen && (
                <p className="mb-2 text-xs text-[var(--color-brick)]">
                  ⚠ More than 24h since their last message — WhatsApp won&apos;t deliver a free
                  reply now. Email them instead, or wait for them to message again.
                </p>
              )}
              {windowOpen && hoursLeft <= 4 && (
                <p className="mb-2 text-xs text-[var(--color-ochre-600)]">
                  Reply window closes in ~{hoursLeft}h.
                </p>
              )}
              {error && <p className="mb-2 text-sm text-[var(--color-brick)]">{error}</p>}
              <div className="flex items-end gap-2">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={2}
                  placeholder={windowOpen ? "Type a reply… (⌘/Ctrl+Enter to send)" : "Reply window closed"}
                  disabled={!windowOpen || busy}
                  className="flex-1 resize-none px-4 py-2.5 rounded-xl bg-[var(--color-paper)] border border-[var(--color-line)] focus:border-[var(--color-ochre-500)] focus:outline-none text-sm text-[var(--color-ink)] disabled:opacity-60"
                />
                <Button
                  variant="primary"
                  onClick={send}
                  disabled={!windowOpen || reply.trim().length < 1}
                  loading={busy}
                  loadingText="Sending…"
                >
                  Send
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-ink-muted)]">
            Select a conversation
          </div>
        )}
      </section>
    </div>
  );
}

function relativeTime(ts: number, now: number): string {
  if (!ts) return "";
  const diff = Math.max(0, now - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}
