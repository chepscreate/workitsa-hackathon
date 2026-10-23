"use client";

/**
 * Prompts the signed-in user to enable browser push notifications.
 *
 * Hides itself if:
 *   - The browser doesn't support push (Notification API + service workers + VAPID key)
 *   - The user already granted permission
 *   - The user dismissed it (localStorage)
 *
 * Cost: zero — Firebase Cloud Messaging is free. Push works for any user
 * who installs the PWA OR opens the site in Chrome / Edge / iOS Safari
 * 16.4+ and allows notifications.
 */

import { useEffect, useState } from "react";
import Button from "./Button";
import {
  currentPushPermission,
  enablePushNotifications,
  pushIsSupportedSync,
} from "@/lib/messaging";

const DISMISS_KEY = "workit_push_dismissed_v1";

export default function PushPermissionPrompt() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setSupported(pushIsSupportedSync());
    setPermission(currentPushPermission());
    if (typeof window !== "undefined") {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
    }
  }, []);

  if (!supported || permission === "granted" || dismissed) return null;
  if (done) {
    return (
      <section className="rounded-2xl p-5 bg-[var(--color-sage-100)]/40 border border-[var(--color-sage-400)]/50 text-sm text-[var(--color-ink-soft)]">
        ✓ Push notifications on for this device. New offers, accepted jobs and
        confirmations will buzz your phone even when Workit is closed.
      </section>
    );
  }

  const onEnable = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await enablePushNotifications();
      if (result === "granted") {
        setPermission("granted");
        setDone(true);
      } else if (result === "denied") {
        setError(
          "You blocked notifications in your browser. Open browser settings → Site permissions → workitsa.co.za → allow notifications, then come back.",
        );
      } else if (result === "no-vapid") {
        setError(
          "Push not configured on this build (admin: NEXT_PUBLIC_FIREBASE_VAPID_KEY missing).",
        );
      } else if (result === "unsupported") {
        setError("This browser / device doesn't support push notifications.");
      } else {
        setError("Couldn't enable push. Try refreshing the page.");
      }
    } finally {
      setBusy(false);
    }
  };

  const onDismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, "1");
    }
    setDismissed(true);
  };

  return (
    <section className="rounded-2xl p-5 bg-[var(--color-ochre-50)] border border-[var(--color-ochre-300)] text-sm flex items-start justify-between gap-3 flex-wrap">
      <div className="flex-1 min-w-[240px]">
        <p className="font-medium text-[var(--color-ink)]">
          Enable push notifications?
        </p>
        <p className="mt-1 text-[var(--color-ink-soft)]">
          Get a buzz on this device when an offer comes in, when a job is
          accepted, or when something needs your action — even when Workit
          isn&apos;t open. Free, works in the browser, no app needed.
        </p>
        {error && <p className="mt-2 text-[var(--color-brick)] text-xs">{error}</p>}
      </div>
      <div className="flex gap-2 flex-wrap">
        <Button onClick={onEnable} variant="primary" size="md" loading={busy} loadingText="Enabling…">
          Enable push
        </Button>
        <button
          type="button"
          onClick={onDismiss}
          className="px-4 py-2 rounded-pill text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
        >
          Not now
        </button>
      </div>
    </section>
  );
}
