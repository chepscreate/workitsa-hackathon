"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ConfirmationResult, RecaptchaVerifier } from "firebase/auth";
import Input from "./Input";
import Button from "./Button";
import { useAuth, type PhoneSignUpInfo } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/LocaleContext";
import { normaliseSaPhone } from "@/lib/phone";
import type { UserRole } from "@/lib/types";

type Props = {
  /** "signin" hides the role+name+dob fields. "signup" shows them. */
  mode: "signin" | "signup";
  /** Pre-selected role on signup (from ?role= query param). */
  initialRole?: UserRole;
  /** Where to send the user after successful auth. */
  onSuccess: (info: { isNewUser: boolean }) => void;
  /** Whether to render the inline consent box (signup only). */
  showTerms?: boolean;
};

// 18-years-ago cap for the date input
const maxDob = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().split("T")[0];
})();

const isOver18 = (iso: string): boolean => {
  if (!iso) return false;
  const dob = new Date(iso);
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  return dob <= cutoff;
};

export default function PhoneAuthForm({
  mode,
  initialRole = "employer",
  onSuccess,
  showTerms = true,
}: Props) {
  const router = useRouter();
  const { startPhoneSignIn, confirmPhoneCode, configured } = useAuth();
  const { t } = useTranslation();

  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>(initialRole);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [agreed, setAgreed] = useState(false);

  const [stage, setStage] = useState<"enter" | "code">("enter");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string>("");

  // Cleanup any lingering reCAPTCHA verifier when this form unmounts so the
  // next visit to /signin or /signup doesn't reuse a detached DOM node.
  useEffect(() => {
    return () => {
      type WindowWithVerifier = Window & { _workitRecaptcha?: RecaptchaVerifier };
      const w = window as WindowWithVerifier;
      if (w._workitRecaptcha) {
        try {
          w._workitRecaptcha.clear();
        } catch {
          /* ignore */
        }
        delete w._workitRecaptcha;
      }
    };
  }, []);

  const onSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const e164 = normaliseSaPhone(phone);
    if (!e164) {
      setError(t("auth.err.invalidPhone"));
      return;
    }

    if (mode === "signup") {
      if (!displayName.trim()) {
        setError(t("auth.err.fullName"));
        return;
      }
      // Email is compulsory (2026-07-10): every account carries both contact
      // channels — decision emails, doc reminders and receipts need it.
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setError(t("auth.err.email"));
        return;
      }
      if (!isOver18(dateOfBirth)) {
        setError(t("auth.err.under18"));
        return;
      }
      if (showTerms && !agreed) {
        setError(t("auth.err.terms"));
        return;
      }
    }

    setBusy(true);
    try {
      const conf = await startPhoneSignIn(e164, "workit-recaptcha");
      setConfirmation(conf);
      setSentTo(e164);
      setStage("code");
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("auth.err.sendFail");
      // Translate Firebase's noisier messages
      if (msg.includes("auth/invalid-app-credential") || msg.includes("invalid-app-credential")) {
        setError(t("auth.err.recaptcha"));
      } else if (msg.includes("auth/too-many-requests")) {
        setError(t("auth.err.tooMany"));
      } else if (msg.includes("auth/operation-not-allowed")) {
        setError(t("auth.err.notEnabled"));
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!confirmation) return;
    if (code.replace(/\D/g, "").length !== 6) {
      setError(t("auth.err.enterCode"));
      return;
    }
    setBusy(true);
    try {
      const info: PhoneSignUpInfo | undefined =
        mode === "signup"
          ? { displayName: displayName.trim(), role, dateOfBirth, email: email.trim() }
          : undefined;
      const result = await confirmPhoneCode(confirmation, code, info);
      onSuccess(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("auth.err.verifyFail");
      if (msg.includes("auth/invalid-verification-code")) {
        setError(t("auth.err.codeMismatch"));
      } else if (msg.includes("auth/code-expired")) {
        setError(t("auth.err.codeExpired"));
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const onResend = async () => {
    setStage("enter");
    setCode("");
    setConfirmation(null);
  };

  return (
    <div className="space-y-5">
      {/* Container that Firebase's invisible reCAPTCHA attaches to */}
      <div id="workit-recaptcha" />

      {stage === "enter" && (
        <form onSubmit={onSendCode} className="space-y-5">
          {mode === "signup" && (
            <>
              <div>
                {/* No heading — the page title above already asks the question,
                    and repeating it read as clutter on mobile. */}
                <div className="grid grid-cols-2 gap-2">
                  <RoleCard
                    active={role === "employer" || role === "business"}
                    onClick={() => setRole("employer")}
                    title={t("auth.role.needWork.title")}
                    subtitle={t("auth.role.needWork.sub")}
                    icon="🛠"
                  />
                  <RoleCard
                    active={role === "worker"}
                    onClick={() => setRole("worker")}
                    title={t("auth.role.doWork.title")}
                    subtitle={t("auth.role.doWork.sub")}
                    icon="💪"
                  />
                </div>

                {(role === "employer" || role === "business") && (
                  <div className="mt-3 rounded-xl p-3 bg-[var(--color-cream-2)] border border-[var(--color-line)]">
                    <p className="text-sm font-medium text-[var(--color-ink)] mb-2">
                      {t("auth.biz.question")}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setRole("employer")}
                        className={`px-4 py-2 rounded-pill text-sm transition-colors ${
                          role === "employer"
                            ? "bg-[var(--color-ink)] text-[var(--color-cream)]"
                            : "bg-[var(--color-paper)] border border-[var(--color-line)] text-[var(--color-ink-soft)]"
                        }`}
                      >
                        {t("auth.biz.no")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole("business")}
                        className={`px-4 py-2 rounded-pill text-sm transition-colors ${
                          role === "business"
                            ? "bg-[var(--color-ink)] text-[var(--color-cream)]"
                            : "bg-[var(--color-paper)] border border-[var(--color-line)] text-[var(--color-ink-soft)]"
                        }`}
                      >
                        {t("auth.biz.yes")}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <Input
                label={t("auth.field.fullName")}
                name="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t("auth.field.fullNamePh")}
                required
                autoComplete="name"
              />
              <Input
                label={t("auth.field.email")}
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.field.emailPh")}
                required
                autoComplete="email"
                hint={t("auth.field.emailHintSignup")}
              />
              <Input
                label={t("auth.field.dob")}
                name="dateOfBirth"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                max={maxDob}
                required
                hint={t("auth.field.dobHint")}
              />
            </>
          )}

          <Input
            label={t("auth.field.mobile")}
            name="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t("auth.field.mobilePh")}
            required
            autoComplete="tel"
            hint={t("auth.field.mobileHint")}
          />

          {mode === "signup" && showTerms && (
            <label className="flex items-start gap-3 text-sm text-[var(--color-ink-soft)] cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 accent-[var(--color-ochre-500)] w-4 h-4 flex-shrink-0"
                required
              />
              <span>
                {t("auth.consent.pre")}{" "}
                <a href="/terms" target="_blank" className="underline text-[var(--color-ink)]">{t("auth.consent.terms")}</a>,{" "}
                <a href="/acceptable-use" target="_blank" className="underline text-[var(--color-ink)]">{t("auth.consent.aup")}</a>,{" "}
                {t("auth.and")}{" "}
                <a href="/privacy" target="_blank" className="underline text-[var(--color-ink)]">{t("auth.consent.privacy")}</a>.
              </span>
            </label>
          )}

          {error && <p className="text-sm text-[var(--color-brick)]">{error}</p>}

          <Button
            type="submit"
            size="lg"
            variant="primary"
            className="w-full"
            loading={busy}
            loadingText={t("auth.phone.sending")}
            disabled={!configured}
          >
            {t("auth.phone.sendCode")}
          </Button>
          <p className="text-[10px] text-[var(--color-ink-muted)] text-center">
            {t("auth.phone.smsRates")}
          </p>
        </form>
      )}

      {stage === "code" && (
        <form onSubmit={onVerify} className="space-y-5">
          <p className="text-sm text-[var(--color-ink-soft)]">
            {t("auth.phone.codeSentPre")} <b className="text-[var(--color-ink)]">{sentTo}</b>
            {t("auth.phone.codeSentPost")}
          </p>
          <Input
            label={t("auth.phone.codeLabel")}
            name="code"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t("auth.phone.codePh")}
            autoComplete="one-time-code"
            required
          />
          {error && <p className="text-sm text-[var(--color-brick)]">{error}</p>}
          <Button type="submit" size="lg" variant="primary" className="w-full" loading={busy} loadingText={t("auth.phone.verifying")}>
            {t("auth.phone.verify")}
          </Button>
          <div className="flex items-center justify-between text-xs text-[var(--color-ink-muted)]">
            <button type="button" onClick={onResend} className="underline">
              {t("auth.phone.wrongNumber")}
            </button>
            <button type="button" onClick={() => router.refresh()} className="underline">
              {t("auth.phone.notArrive")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function RoleCard({
  active,
  onClick,
  title,
  subtitle,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
  icon: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`text-left p-4 rounded-xl border transition-all ${
        active
          ? "bg-[var(--color-ochre-50)] border-[var(--color-ochre-500)] ring-2 ring-[var(--color-ochre-500)]/30"
          : "bg-[var(--color-paper)] border-[var(--color-line)] hover:border-[var(--color-ochre-300)]"
      }`}
    >
      <div className="text-2xl mb-1" aria-hidden>{icon}</div>
      <p className="font-display text-base text-[var(--color-ink)] leading-tight">
        {title}
      </p>
      <p className="text-xs text-[var(--color-ink-muted)] mt-0.5">{subtitle}</p>
    </button>
  );
}
