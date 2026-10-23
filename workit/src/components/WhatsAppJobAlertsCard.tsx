"use client";

import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/LocaleContext";
import type { UserProfile } from "@/lib/types";

/**
 * Worker opt-in for the WhatsApp Job Channel (low-data job alerts over
 * WhatsApp). The toggle IS the POPIA consent — recorded with a timestamp. The
 * number is stored normalised (27XXXXXXXXX) to match the webhook's lookup in
 * functions/src/whatsappJobChannel.ts. Non-protected user-doc fields, so the
 * self-update is allowed by the existing Firestore rules.
 */

/** Normalise an SA number to WhatsApp digits (27XXXXXXXXX). Mirrors toWa() on
 *  the server so the inbound-message lookup matches what we store. */
function toWa(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("27")) return d;
  if (d.startsWith("0")) return "27" + d.slice(1);
  if (d.length === 9) return "27" + d;
  return d;
}

const isValidSaMobile = (wa: string) => /^27[6-8]\d{8}$/.test(wa);

export default function WhatsAppJobAlertsCard({
  profile,
  variant = "worker",
}: {
  profile: UserProfile;
  variant?: "worker" | "employer";
}) {
  const { refreshProfile } = useAuth();
  const { t } = useTranslation();
  const on = !!profile.whatsappJobOptIn;
  const emp = variant === "employer";
  const titleKey = emp ? "waalerts.titleEmployer" : "waalerts.title";
  const onDescKey = emp ? "waalerts.onDescEmployer" : "waalerts.onDesc";
  const offDescKey = emp ? "waalerts.offDescEmployer" : "waalerts.offDesc";
  const consentKey = emp ? "waalerts.consentEmployer" : "waalerts.consent";

  const [editing, setEditing] = useState(false);
  const [number, setNumber] = useState(profile.whatsappNumber || profile.phone || "");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const wa = toWa(number);
    if (!isValidSaMobile(wa)) {
      setError(t("waalerts.invalidNumber"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateDoc(doc(getDb(), "users", profile.uid), {
        whatsappJobOptIn: true,
        whatsappNumber: wa,
        whatsappConsentAt: Date.now(),
      });
      refreshProfile().catch(() => {});
      setEditing(false);
    } catch {
      setError(t("waalerts.invalidNumber"));
    } finally {
      setSaving(false);
    }
  };

  const turnOff = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(getDb(), "users", profile.uid), {
        whatsappJobOptIn: false,
        whatsappOptOutAt: Date.now(),
      });
      refreshProfile().catch(() => {});
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl p-5 mb-6 bg-[var(--color-paper)] border border-[var(--color-line)]">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <span className="text-xl leading-none mt-0.5" aria-hidden>💬</span>
          <div className="min-w-0">
            <p className="font-medium text-[var(--color-ink)]">
              {t(titleKey)}
              {on && (
                <span className="ml-2 text-xs font-semibold text-[var(--color-sage-600)]">
                  ● {t("waalerts.on")}
                </span>
              )}
            </p>
            <p className="text-xs text-[var(--color-ink-muted)] mt-0.5 max-w-md">
              {on ? t(onDescKey) : t(offDescKey)}
            </p>
          </div>
        </div>

        {on ? (
          <button
            type="button"
            onClick={turnOff}
            disabled={saving}
            className="text-sm underline text-[var(--color-ink)] disabled:opacity-60 whitespace-nowrap"
          >
            {saving ? t("waalerts.saving") : t("waalerts.turnOff")}
          </button>
        ) : !editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="px-4 py-2 rounded-full text-sm font-medium bg-[var(--color-sage-600)] text-white whitespace-nowrap"
          >
            {t("waalerts.turnOn")}
          </button>
        ) : null}
      </div>

      {editing && !on && (
        <div className="mt-4 space-y-3 border-t border-[var(--color-line)] pt-4">
          <label className="block">
            <span className="text-sm text-[var(--color-ink)]">{t("waalerts.numberLabel")}</span>
            <input
              type="tel"
              inputMode="tel"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="067 748 2643"
              className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-cream-2)] px-3 py-2 text-sm"
            />
            <span className="text-xs text-[var(--color-ink-muted)] mt-1 block">
              {t("waalerts.numberHint")}
            </span>
          </label>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="w-5 h-5 mt-0.5 accent-[var(--color-sage-600)]"
            />
            <span className="text-sm text-[var(--color-ink-soft)]">{t(consentKey)}</span>
          </label>

          {error && <p className="text-xs text-[var(--color-brick)]">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving || !consent}
              className="px-4 py-2 rounded-full text-sm font-medium bg-[var(--color-sage-600)] text-white disabled:opacity-50"
            >
              {saving ? t("waalerts.saving") : t("waalerts.turnOn")}
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setError(null); }}
              disabled={saving}
              className="px-4 py-2 rounded-full text-sm text-[var(--color-ink)] disabled:opacity-60"
            >
              {t("waalerts.turnOff")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
