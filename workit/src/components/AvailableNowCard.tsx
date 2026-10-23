"use client";

import { useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { AVAILABLE_NOW_EXPIRE_MS, isAvailableNow, type UserProfile } from "@/lib/types";

/**
 * "Available now" toggle for workers. Self-flag = appears higher in employer
 * search + JobCard offer stack. Auto-expires 8h after toggled on so a worker
 * who forgets doesn't permanently look available.
 */
export default function AvailableNowCard({ profile }: { profile: UserProfile }) {
  const { refreshProfile } = useAuth();
  const [on, setOn] = useState(isAvailableNow(profile));
  // When the current window started. Tracked locally because the profile prop
  // is a fetch-time snapshot: after a fresh toggle-on, the stale
  // profile.availableNowAt (e.g. from yesterday) made the expiry effect below
  // think the window had already passed and flipped the switch straight back
  // off — the button looked dead for anyone who'd used it before.
  const [since, setSince] = useState<number | undefined>(profile.availableNowAt);
  const [saving, setSaving] = useState(false);

  // Auto-flip off when the 8-hour window expires while the page is open
  useEffect(() => {
    if (!on || !since) return;
    const ms = since + AVAILABLE_NOW_EXPIRE_MS - Date.now();
    if (ms <= 0) {
      setOn(false);
      return;
    }
    const t = setTimeout(() => setOn(false), ms);
    return () => clearTimeout(t);
  }, [on, since]);

  const toggle = async () => {
    const next = !on;
    const at = next ? Date.now() : undefined;
    setOn(next);
    setSince(at);
    setSaving(true);
    try {
      await updateDoc(doc(getDb(), "users", profile.uid), {
        availableNow: next,
        availableNowAt: at ?? null,
      });
      // Keep the app-wide profile snapshot in step (best-effort — the write
      // above already succeeded, so a refresh hiccup shouldn't revert the UI).
      refreshProfile().catch(() => {});
    } catch {
      // Firestore rejected — revert to what the profile actually says.
      setOn(isAvailableNow(profile));
      setSince(profile.availableNowAt);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl p-5 mb-6 bg-[var(--color-paper)] border border-[var(--color-line)] flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <span
          className={`w-3 h-3 rounded-full ${
            on ? "bg-[var(--color-sage-600)] animate-pulse" : "bg-[var(--color-ink-muted)]/40"
          }`}
        />
        <div>
          <p className="font-medium text-[var(--color-ink)]">
            {on ? "You're available right now" : "Set yourself as available"}
          </p>
          <p className="text-xs text-[var(--color-ink-muted)]">
            {on
              ? "Employers see you first. Auto-turns off after 8 hours."
              : "Workers who flag availability get more offers. Toggle on when you're ready to work."}
          </p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={on ? "Turn off available now" : "Set yourself as available now"}
        disabled={saving}
        onClick={toggle}
        className={`relative w-14 h-7 rounded-full transition-colors ${
          on ? "bg-[var(--color-sage-600)]" : "bg-[var(--color-line)]"
        } disabled:opacity-60`}
      >
        <span
          className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-7" : "translate-x-0.5"
          }`}
        />
      </button>
    </section>
  );
}
