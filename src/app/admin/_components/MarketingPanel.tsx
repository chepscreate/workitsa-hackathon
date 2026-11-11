"use client";

import { useCallback, useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { getFunctionsInstance } from "@/lib/firebase";
import Button from "@/components/Button";
import { useConfirm } from "@/contexts/ConfirmContext";

/**
 * Marketing automation controls — status of both channels + "run now" buttons
 * so the founder never has to visit Cloud Scheduler to trigger a send early.
 * Backed by marketingStatus (admin) + marketingRunNow (admin + 2FA); the
 * manual run uses the exact same code path and guardrails as the schedulers.
 */

type Status = {
  emailEnabled: boolean;
  fbEnabled: boolean;
  dailyCap: number;
  replyTo: string;
  sentToday: number;
  leads: { pending: number; sent: number; optout: number };
  posts: { queuedImages: number; queuedVideos: number; posted: number };
};

type RunResult = {
  ran: boolean;
  reason?: string;
  sent?: number;
  skipped?: number;
  fbPostId?: string;
  remaining?: number;
  error?: string;
};

const errMsg = (err: unknown) =>
  err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : "Something went wrong.";

export default function MarketingPanel({ initialStatus }: { initialStatus?: Status }) {
  const confirm = useConfirm();
  const [status, setStatus] = useState<Status | null>(initialStatus ?? null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"email" | "facebook" | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const fn = httpsCallable<unknown, Status>(getFunctionsInstance(), "marketingStatus");
      const res = await fn({});
      setStatus(res.data);
      setStatusError(null);
    } catch (err) {
      setStatusError(errMsg(err));
    }
  }, []);

  useEffect(() => {
    if (initialStatus) return; // lab/preview injection — skip the live fetch
    void refresh();
  }, [refresh, initialStatus]);

  const runNow = async (channel: "email" | "facebook") => {
    if (busy || !status) return;
    const ok = await confirm(
      channel === "email"
        ? {
            title: `Send the next email batch now?`,
            body: `Emails up to ${Math.max(0, status.dailyCap - status.sentToday)} more leads now (daily cap ${status.dailyCap}, ${status.sentToday} already sent today; ${status.leads.pending} waiting). Real emails to real businesses — can't be unsent.`,
            tone: "warning",
            confirmLabel: "Send batch now",
          }
        : {
            title: "Publish the next Facebook post now?",
            body: `Posts the oldest queued item (${status.posts.queuedVideos} clips + ${status.posts.queuedImages} images in the queue) to the Workitsa Page immediately. Public the moment it lands.`,
            tone: "warning",
            confirmLabel: "Post now",
          },
    );
    if (!ok) return;

    setBusy(channel);
    setLastResult(null);
    try {
      const fn = httpsCallable<{ channel: string }, RunResult>(getFunctionsInstance(), "marketingRunNow");
      const res = await fn({ channel });
      const r = res.data;
      if (!r.ran) {
        setLastResult(`Nothing sent — ${r.reason ?? "unknown reason"}`);
      } else if (channel === "email") {
        setLastResult(`✅ Sent ${r.sent ?? 0} email${(r.sent ?? 0) === 1 ? "" : "s"}${r.skipped ? `, skipped ${r.skipped}` : ""}. Summary email is on its way to ${status.replyTo}.`);
      } else if (r.error) {
        setLastResult(`⚠ Post attempt failed: ${r.error}`);
      } else {
        setLastResult(`✅ Posted to the Workitsa Page (${r.remaining ?? 0} still queued).`);
      }
      await refresh();
    } catch (err) {
      setLastResult(`Error: ${errMsg(err)}`);
    } finally {
      setBusy(null);
    }
  };

  const Pill = ({ on }: { on: boolean }) => (
    <span
      className={`px-2 py-0.5 rounded-pill text-[11px] font-semibold uppercase tracking-wide ${
        on
          ? "bg-[var(--color-sage-100,#e7eedd)] text-[var(--color-sage-600)]"
          : "bg-[var(--color-cream-2)] text-[var(--color-ink-muted)]"
      }`}
    >
      {on ? "On" : "Paused"}
    </span>
  );

  return (
    <div className="mb-6 rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-5 shadow-soft">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h3 className="font-display text-lg text-[var(--color-ink)]">Marketing automation</h3>
        <p className="text-[11px] text-[var(--color-ink-muted)]">
          Switches live in Firestore → <code>marketing/config</code> · runbook OPS_QUICKREF §5b–c
        </p>
      </div>

      {statusError ? (
        <p className="mt-3 text-sm text-[var(--color-brick)]">{statusError}</p>
      ) : !status ? (
        <p className="mt-3 text-sm text-[var(--color-ink-muted)]">Loading queue status…</p>
      ) : (
        <div className="mt-4 grid sm:grid-cols-2 gap-4">
          {/* Email outreach */}
          <div className="rounded-xl border border-[var(--color-line)] p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-[var(--color-ink)]">📧 B2B email outreach</p>
              <Pill on={status.emailEnabled} />
            </div>
            <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
              <b>{status.leads.pending}</b> waiting · {status.leads.sent} sent · {status.leads.optout} opted out
            </p>
            <p className="text-[11px] text-[var(--color-ink-muted)]">
              Weekdays 08:30 & 13:30 · {status.sentToday}/{status.dailyCap} sent today · replies → {status.replyTo}
            </p>
            <div className="mt-3">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => runNow("email")}
                loading={busy === "email"}
                loadingText="Sending batch…"
                disabled={
                  busy !== null ||
                  !status.emailEnabled ||
                  status.leads.pending === 0 ||
                  status.sentToday >= status.dailyCap
                }
              >
                Send next batch now
              </Button>
              {!status.emailEnabled ? (
                <p className="mt-1.5 text-[11px] text-[var(--color-ink-muted)]">
                  Paused — set <code>enabled: true</code> on marketing/config to use this.
                </p>
              ) : status.sentToday >= status.dailyCap ? (
                <p className="mt-1.5 text-[11px] text-[var(--color-ink-muted)]">
                  Daily cap reached — next batch next weekday 08:30 (or raise <code>dailyCap</code>).
                </p>
              ) : null}
            </div>
          </div>

          {/* Facebook */}
          <div className="rounded-xl border border-[var(--color-line)] p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-[var(--color-ink)]">📘 Facebook page posts</p>
              <Pill on={status.fbEnabled} />
            </div>
            <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
              <b>{status.posts.queuedVideos}</b> clips · <b>{status.posts.queuedImages}</b> images queued · {status.posts.posted} posted
            </p>
            <p className="text-[11px] text-[var(--color-ink-muted)]">Clips 08:00 · images 17:30 · Workitsa Page</p>
            <div className="mt-3">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => runNow("facebook")}
                loading={busy === "facebook"}
                loadingText="Posting…"
                disabled={busy !== null || !status.fbEnabled || status.posts.queuedImages + status.posts.queuedVideos === 0}
              >
                Post next queued now
              </Button>
              {status.posts.queuedImages + status.posts.queuedVideos === 0 && (
                <p className="mt-1.5 text-[11px] text-[var(--color-ink-muted)]">
                  Queue empty — stage a batch: <code>node functions/scripts/import-posts.mjs …</code>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {lastResult && (
        <p className="mt-3 text-sm text-[var(--color-ink-soft)] rounded-lg bg-[var(--color-cream-2)] px-3 py-2">
          {lastResult}
        </p>
      )}
    </div>
  );
}
