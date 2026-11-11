"use client";

import { useEffect, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { getFunctionsInstance } from "@/lib/firebase";

type Turn = { role: "user" | "assistant"; text: string };

type PendingAction = {
  type: string;
  targetUid?: string;
  targetName?: string;
  targetJobId?: string;
  note?: string;
  summary: string;
};

const SUGGESTIONS = [
  "How's Workit doing right now?",
  "Who's waiting on verification?",
  "Any open disputes I should look at?",
  "Show me the latest sign-ups.",
];

// Stark-style HUD palette — Workit ochre on warm black. This panel deliberately
// breaks from the rest of the admin: it's "Jarvis", so it gets its own console.
const OCHRE = "#e9a96b"; // ochre-300, the luminous accent (rings, text, borders)
const OCHRE_BRIGHT = "#f6cd9c"; // highlight
const OCHRE_DEEP = "#d97742"; // ochre-500, gradient depth
const OCHRE_DIM = "rgba(233,169,107,0.6)";
const OCHRE_FAINT = "rgba(233,169,107,0.16)";
const TEXT = "#f6e7d2";
const TEXT_SOFT = "rgba(246,231,210,0.72)";

/**
 * Jarvis — admin-only operations chat. Talks to the `jarvisChat` Cloud Function
 * (Gemini agent, read-only Firestore tools). The function re-checks admin role
 * server-side; the Gemini API key never touches the browser.
 *
 * The UI is a sci-fi HUD console (ochre-on-black, arc-reactor core) — chat logic
 * is unchanged. When a reply mentions numbers, animated ring gauges draw in
 * beneath it.
 */
export default function JarvisPanel() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [confirming, setConfirming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy, pending]);

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || busy) return;
    setError(null);
    setInput("");
    setPending(null); // a new message supersedes any unconfirmed proposal
    const history = turns.slice(-20);
    setTurns((t) => [...t, { role: "user", text: msg }]);
    setBusy(true);
    try {
      const fn = httpsCallable<
        { message: string; history: Turn[] },
        { reply: string; pendingAction?: PendingAction | null }
      >(getFunctionsInstance(), "jarvisChat");
      const res = await fn({ message: msg, history });
      const reply = res.data?.reply ?? "(no answer)";
      setTurns((t) => [...t, { role: "assistant", text: reply }]);
      if (res.data?.pendingAction) setPending(res.data.pendingAction);
    } catch (err: unknown) {
      const m =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Something went wrong.";
      setError(m);
    } finally {
      setBusy(false);
    }
  };

  const confirmAction = async () => {
    if (!pending || confirming) return;
    setError(null);
    setConfirming(true);
    try {
      const fn = httpsCallable<{ action: PendingAction }, { ok: boolean; message: string }>(
        getFunctionsInstance(),
        "jarvisConfirmAction",
      );
      const res = await fn({ action: pending });
      const m = res.data?.message ?? (res.data?.ok ? "Done." : "Couldn't complete that.");
      setTurns((t) => [...t, { role: "assistant", text: (res.data?.ok ? "✅ " : "⚠ ") + m }]);
      setPending(null);
    } catch (err: unknown) {
      const m =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Couldn't complete that action.";
      setError(m);
    } finally {
      setConfirming(false);
    }
  };

  const cancelAction = () => {
    setPending(null);
    setTurns((t) => [...t, { role: "assistant", text: "Cancelled — nothing was changed." }]);
  };

  return (
    <div
      className="jarvis-hud relative flex flex-col h-[calc(100vh-13rem)] min-h-[480px] overflow-hidden rounded-2xl"
      style={{
        color: TEXT,
        background:
          "radial-gradient(120% 90% at 50% 0%, #3a2412 0%, #1c1108 45%, #0a0603 100%)",
        border: `1px solid ${OCHRE_DIM}`,
        boxShadow: `0 0 0 1px rgba(233,169,107,0.12), 0 0 60px rgba(233,169,107,0.22), inset 0 0 90px rgba(233,169,107,0.07)`,
      }}
    >
      <HudStyles />

      {/* Grid / scanline texture */}
      <div className="jarvis-grid pointer-events-none absolute inset-0" aria-hidden />
      <div className="jarvis-scan pointer-events-none absolute inset-x-0 h-px" aria-hidden />

      {/* Corner brackets */}
      <Corner pos="tl" />
      <Corner pos="tr" />
      <Corner pos="bl" />
      <Corner pos="br" />

      {/* Header */}
      <div
        className="relative z-10 flex items-center gap-3 px-5 py-3"
        style={{ borderBottom: `1px solid ${OCHRE_FAINT}` }}
      >
        <MiniReactor />
        <div className="min-w-0 flex-1">
          <h2
            className="font-mono text-base font-semibold tracking-[0.35em]"
            style={{ color: OCHRE, textShadow: `0 0 14px rgba(233,169,107,0.7)` }}
          >
            J.A.R.V.I.S
          </h2>
          <p className="font-mono text-[10px] tracking-[0.18em] uppercase" style={{ color: OCHRE_DIM }}>
            Workit ops core · read-only
          </p>
        </div>
        <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase" style={{ color: OCHRE }}>
          <span
            className="jarvis-blip inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: OCHRE, boxShadow: `0 0 10px ${OCHRE}` }}
          />
          Online
        </span>
      </div>

      {/* Conversation */}
      <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-4">
        {turns.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <Reactor />
            <p
              className="mt-7 font-mono text-base tracking-[0.2em] uppercase"
              style={{ color: OCHRE, textShadow: `0 0 16px rgba(233,169,107,0.6)` }}
            >
              Systems online
            </p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed" style={{ color: TEXT_SOFT }}>
              Good day. I have a live read on the marketplace — metrics, queues, users, jobs,
              disputes and reports. Ask, and I&apos;ll tell you what needs your attention.
            </p>
            <div className="mt-6 flex max-w-md flex-wrap justify-center gap-2.5">
              {SUGGESTIONS.map((s) => (
                <HudChip key={s} onClick={() => send(s)}>
                  {s}
                </HudChip>
              ))}
            </div>
          </div>
        )}

        {turns.map((t, i) => {
          if (t.role === "user") {
            return (
              <div key={i} className="flex justify-end">
                <div
                  className="max-w-[85%] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap"
                  style={{
                    color: "#1c1108",
                    background: `linear-gradient(180deg, ${OCHRE_BRIGHT} 0%, ${OCHRE_DEEP} 100%)`,
                    boxShadow: `0 0 26px rgba(233,169,107,0.6)`,
                    fontWeight: 500,
                    clipPath:
                      "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)",
                  }}
                >
                  {t.text}
                </div>
              </div>
            );
          }
          const metrics = extractMetrics(t.text);
          return (
            <div key={i} className="flex justify-start">
              <SpeakerTab />
              <div className="max-w-[85%]">
                <div
                  className="px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap"
                  style={{
                    color: TEXT,
                    background: "rgba(42,24,12,0.78)",
                    border: `1px solid ${OCHRE_FAINT}`,
                    borderLeft: `2px solid ${OCHRE}`,
                    boxShadow: `inset 0 0 26px rgba(233,169,107,0.10), 0 0 18px rgba(233,169,107,0.18)`,
                    clipPath:
                      "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))",
                  }}
                >
                  {t.text}
                </div>
                {metrics.length > 0 && <MetricStrip metrics={metrics} />}
              </div>
            </div>
          );
        })}

        {busy && (
          <div className="flex items-center gap-2">
            <SpeakerTab />
            <div
              className="px-4 py-3"
              style={{
                background: "rgba(42,24,12,0.78)",
                border: `1px solid ${OCHRE_FAINT}`,
                borderLeft: `2px solid ${OCHRE}`,
                boxShadow: `0 0 18px rgba(233,169,107,0.2)`,
              }}
            >
              <span className="flex items-center gap-1.5">
                <Dot /> <Dot delay="160ms" /> <Dot delay="320ms" />
                <span className="ml-2 font-mono text-[10px] tracking-widest uppercase" style={{ color: OCHRE_DIM }}>
                  Processing
                </span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation gate — actions never run until you click Confirm */}
      {pending && (
        <div
          className="relative z-10 mx-3 mb-2 px-4 py-3 rounded-xl"
          style={{
            background: "rgba(42,24,12,0.92)",
            border: `1px solid ${OCHRE}`,
            boxShadow: `0 0 24px rgba(233,169,107,0.35)`,
          }}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: OCHRE_DIM }}>
            Confirm action
          </p>
          <p className="mt-1 text-sm" style={{ color: TEXT }}>
            {pending.summary}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={confirmAction}
              disabled={confirming}
              className="jarvis-send px-4 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
              style={{ background: OCHRE, color: "#1c1108", boxShadow: `0 0 16px rgba(233,169,107,0.5)` }}
            >
              {confirming ? "Working…" : "Confirm"}
            </button>
            <button
              type="button"
              onClick={cancelAction}
              disabled={confirming}
              className="px-4 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-40"
              style={{ border: `1px solid ${OCHRE_FAINT}`, color: TEXT_SOFT }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="relative z-10 px-5 py-2 font-mono text-[11px] tracking-wide"
          style={{ color: "#ff9a8b", background: "rgba(255,90,70,0.10)", borderTop: `1px solid rgba(255,120,100,0.3)` }}
        >
          ⚠ {error}
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="relative z-10 flex items-end gap-2 p-3"
        style={{ borderTop: `1px solid ${OCHRE_FAINT}` }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder="Speak to Jarvis…  (Enter to send · Shift+Enter for a new line)"
          className="jarvis-input flex-1 max-h-32 resize-none px-4 py-2.5 text-sm outline-none"
          style={{
            color: TEXT,
            background: "rgba(20,11,5,0.85)",
            border: `1px solid ${OCHRE_FAINT}`,
            borderRadius: 10,
          }}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label="Send"
          className="jarvis-send flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-all disabled:opacity-30"
          style={{
            border: `1px solid ${OCHRE}`,
            color: OCHRE,
            background: "rgba(233,169,107,0.12)",
            boxShadow: `0 0 16px rgba(233,169,107,0.35)`,
          }}
        >
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>
    </div>
  );
}

/* ---------------- metric extraction + gauges ---------------- */

type Gauge = { display: string; label: string; fill: number };

const STOP = new Set([
  "in", "of", "and", "to", "the", "on", "at", "for", "is", "are", "was", "were",
  "with", "by", "or", "a", "an", "that", "this", "has", "have", "had", "from",
  "as", "but", "if", "so", "we", "you", "i", "it", "they", "more", "than",
]);

function shortNum(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k";
  return String(n);
}

/**
 * Pull "metric-like" numbers out of a reply for the gauge strip: counts with a
 * noun ("12 users"), percentages ("63%"), and rand amounts ("R 1,200"). Purely
 * a decorative HUD flourish — the number shown is exact; the ring fill is a
 * relative visual (max-normalised within the set, percentages use value/100).
 */
function extractMetrics(text: string): Gauge[] {
  type Raw = { value: number; display: string; label: string; isPercent: boolean };
  const found: Raw[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;

  // count + label: "12 active users", "3 open disputes"
  const cnt = /\b(\d{1,6})\s+([A-Za-z][A-Za-z-]+(?:\s+[A-Za-z][A-Za-z-]+)?)/g;
  while ((m = cnt.exec(text)) && found.length < 10) {
    const before = text.slice(Math.max(0, m.index - 2), m.index);
    if (/[R$]\s?$/.test(before)) continue; // it's a currency amount, handled below
    const v = parseInt(m[1], 10);
    if (v >= 1900 && v <= 2100) continue; // likely a year
    let label = m[2].trim().toLowerCase();
    const first = label.split(" ")[0];
    if (STOP.has(first)) continue;
    if (label.length > 16) label = label.slice(0, 16);
    const key = "c" + v + label;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ value: v, display: shortNum(v), label, isPercent: false });
  }

  // percentages
  const pct = /(\d+(?:\.\d+)?)\s*%/g;
  while ((m = pct.exec(text)) && found.length < 10) {
    const v = parseFloat(m[1]);
    const key = "p" + m[1];
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ value: v, display: m[1] + "%", label: "rate", isPercent: true });
  }

  // rand amounts
  const cur = /R\s?(\d[\d,]*(?:\.\d+)?)/g;
  while ((m = cur.exec(text)) && found.length < 10) {
    const raw = m[1].replace(/,/g, "");
    const v = parseFloat(raw);
    if (!isFinite(v)) continue;
    const key = "r" + raw;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ value: v, display: "R" + shortNum(v), label: "rand", isPercent: false });
  }

  if (found.length === 0) return [];
  const maxV = Math.max(1, ...found.filter((f) => !f.isPercent).map((f) => f.value));
  return found.slice(0, 4).map((f) => ({
    display: f.display,
    label: f.label,
    fill: f.isPercent ? Math.min(1, f.value / 100) : Math.max(0.12, Math.min(1, f.value / maxV)),
  }));
}

function MetricStrip({ metrics }: { metrics: Gauge[] }) {
  return (
    <div className="mt-2.5 flex flex-wrap gap-3 pl-1">
      {metrics.map((g, i) => (
        <MetricGauge key={i} {...g} delay={i * 130} />
      ))}
    </div>
  );
}

function MetricGauge({ display, label, fill, delay }: Gauge & { delay: number }) {
  const r = 20;
  const C = 2 * Math.PI * r;
  const [off, setOff] = useState(C);
  useEffect(() => {
    const id = setTimeout(() => setOff(C * (1 - fill)), 60 + delay);
    return () => clearTimeout(id);
  }, [C, fill, delay]);
  return (
    <div className="flex flex-col items-center" style={{ width: 66 }}>
      <div className="relative" style={{ width: 52, height: 52 }}>
        <svg width="52" height="52" viewBox="0 0 52 52">
          <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(233,169,107,0.18)" strokeWidth="3" />
          <circle
            cx="26"
            cy="26"
            r={r}
            fill="none"
            stroke={OCHRE}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={off}
            transform="rotate(-90 26 26)"
            style={{
              transition: "stroke-dashoffset 1.1s cubic-bezier(.2,.7,.2,1)",
              filter: `drop-shadow(0 0 5px ${OCHRE})`,
            }}
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center font-mono text-[11px] font-semibold"
          style={{ color: OCHRE_BRIGHT }}
        >
          {display}
        </span>
      </div>
      <span
        className="mt-1 text-center font-mono text-[9px] leading-tight tracking-wide"
        style={{ color: OCHRE_DIM, maxWidth: 66 }}
      >
        {label}
      </span>
    </div>
  );
}

/* ---------------- decorative pieces ---------------- */

function HudChip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="jarvis-chip px-3.5 py-2 font-mono text-[11px] tracking-wide transition-all"
      style={{
        color: TEXT,
        background: "rgba(233,169,107,0.08)",
        border: `1px solid ${OCHRE_DIM}`,
        clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
      }}
    >
      {children}
    </button>
  );
}

/** Small left-edge marker on Jarvis's messages. */
function SpeakerTab() {
  return (
    <span
      className="mr-2 mt-1 hidden h-2 w-2 flex-shrink-0 rotate-45 sm:block"
      style={{ background: OCHRE, boxShadow: `0 0 10px ${OCHRE}` }}
      aria-hidden
    />
  );
}

/** Big animated arc-reactor centrepiece for the empty state. */
function Reactor() {
  return (
    <div className="relative h-32 w-32" aria-hidden>
      <Ring size={128} dur="18s" gap />
      <Ring size={100} dur="12s" reverse />
      <Ring size={74} dur="8s" gap />
      <div
        className="jarvis-core absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: `radial-gradient(circle, #fff3e3 0%, ${OCHRE} 45%, rgba(233,169,107,0) 75%)`,
        }}
      />
    </div>
  );
}

function Ring({ size, dur, reverse, gap }: { size: number; dur: string; reverse?: boolean; gap?: boolean }) {
  return (
    <span
      className="absolute left-1/2 top-1/2 rounded-full"
      style={{
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        border: `2px solid ${OCHRE}`,
        borderTopColor: gap ? "transparent" : OCHRE,
        borderRightColor: gap ? OCHRE : "transparent",
        borderBottomColor: gap ? "transparent" : OCHRE_DIM,
        opacity: 0.9,
        boxShadow: `0 0 18px rgba(233,169,107,0.5), inset 0 0 12px rgba(233,169,107,0.25)`,
        animation: `jarvis-spin ${dur} linear infinite${reverse ? " reverse" : ""}`,
      }}
    />
  );
}

/** Tiny reactor for the header. */
function MiniReactor() {
  return (
    <span className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center" aria-hidden>
      <span
        className="absolute inset-0 rounded-full"
        style={{
          border: `1.5px solid ${OCHRE}`,
          borderTopColor: "transparent",
          borderBottomColor: "transparent",
          boxShadow: `0 0 12px rgba(233,169,107,0.5)`,
          animation: "jarvis-spin 6s linear infinite",
        }}
      />
      <span
        className="absolute inset-[5px] rounded-full"
        style={{
          border: `1.5px solid ${OCHRE_DIM}`,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          animation: "jarvis-spin 4s linear infinite reverse",
        }}
      />
      <span
        className="jarvis-core h-2 w-2 rounded-full"
        style={{ background: OCHRE, boxShadow: `0 0 14px ${OCHRE}` }}
      />
    </span>
  );
}

function Corner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const base: React.CSSProperties = {
    position: "absolute",
    width: 16,
    height: 16,
    zIndex: 20,
    filter: `drop-shadow(0 0 4px ${OCHRE})`,
  };
  const c = OCHRE;
  const map: Record<"tl" | "tr" | "bl" | "br", React.CSSProperties> = {
    tl: { top: 6, left: 6, borderTop: `2px solid ${c}`, borderLeft: `2px solid ${c}` },
    tr: { top: 6, right: 6, borderTop: `2px solid ${c}`, borderRight: `2px solid ${c}` },
    bl: { bottom: 6, left: 6, borderBottom: `2px solid ${c}`, borderLeft: `2px solid ${c}` },
    br: { bottom: 6, right: 6, borderBottom: `2px solid ${c}`, borderRight: `2px solid ${c}` },
  };
  return <span aria-hidden style={{ ...base, ...map[pos] }} />;
}

function Dot({ delay = "0ms" }: { delay?: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full"
      style={{ background: OCHRE, boxShadow: `0 0 8px ${OCHRE}`, animation: `jarvis-blink 1.1s ${delay} ease-in-out infinite` }}
    />
  );
}

function HudStyles() {
  return (
    <style>{`
      @keyframes jarvis-spin { to { transform: rotate(360deg); } }
      @keyframes jarvis-blink { 0%,100% { opacity:.25; transform:scale(.8);} 50% { opacity:1; transform:scale(1);} }
      @keyframes jarvis-blip { 0%,100% { opacity:1; } 50% { opacity:.25; } }
      @keyframes jarvis-corepulse { 0%,100% { opacity:.8; transform:translate(-50%,-50%) scale(1);} 50% { opacity:1; transform:translate(-50%,-50%) scale(1.18);} }
      @keyframes jarvis-scanmove { 0% { top:0; opacity:0;} 10% { opacity:.85;} 90% { opacity:.85;} 100% { top:100%; opacity:0;} }
      .jarvis-grid {
        background-image:
          linear-gradient(rgba(233,169,107,0.06) 1px, transparent 1px),
          linear-gradient(90deg, rgba(233,169,107,0.06) 1px, transparent 1px);
        background-size: 26px 26px;
        mask-image: radial-gradient(120% 80% at 50% 0%, #000 30%, transparent 90%);
      }
      .jarvis-scan {
        background: linear-gradient(90deg, transparent, rgba(233,169,107,0.65), transparent);
        animation: jarvis-scanmove 7s linear infinite;
      }
      .jarvis-blip { animation: jarvis-blip 1.6s ease-in-out infinite; }
      .jarvis-core { animation: jarvis-corepulse 2.4s ease-in-out infinite; }
      .jarvis-chip:hover, .jarvis-send:hover:not(:disabled) {
        background: rgba(233,169,107,0.24) !important;
        box-shadow: 0 0 22px rgba(233,169,107,0.6) !important;
      }
      .jarvis-input:focus {
        border-color: ${OCHRE} !important;
        box-shadow: 0 0 0 1px rgba(233,169,107,0.5), 0 0 24px rgba(233,169,107,0.35);
      }
      .jarvis-input::placeholder { color: rgba(246,231,210,0.4); }
      .jarvis-hud ::-webkit-scrollbar { width: 8px; }
      .jarvis-hud ::-webkit-scrollbar-thumb { background: rgba(233,169,107,0.35); border-radius: 8px; }
      .jarvis-hud ::-webkit-scrollbar-track { background: transparent; }
    `}</style>
  );
}
