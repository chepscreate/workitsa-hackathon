"use client";

/**
 * Account security — two-step verification (TOTP) management.
 *
 * Enrollment: generate secret → show QR (rendered locally with the `qrcode`
 * package — the secret never leaves the device) + manual key → verify a
 * 6-digit code → enrolled. Both enroll and remove can throw
 * auth/requires-recent-login, handled inline with a password or Google
 * re-authentication panel. Admins are REQUIRED to enroll — /admin blocks
 * until they have (see app/admin/page.tsx).
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import Button from "@/components/Button";
import Badge from "@/components/Badge";
import Input from "@/components/Input";
import { useAuth } from "@/contexts/AuthContext";
import { getFirebaseAuth } from "@/lib/firebase";
import {
  finishTotpEnrollment,
  hasTotp,
  isRecentLoginError,
  startTotpEnrollment,
  totpFactor,
  unenrollTotp,
  type TotpEnrollment,
} from "@/lib/mfa";
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
} from "firebase/auth";

/**
 * Turn a TOTP-enrollment start failure into a clear, actionable message.
 * The old code collapsed everything into "Couldn't start setup", which hid the
 * real Firebase reason. We name the common ones and surface the raw code for
 * anything unexpected so support can act on it.
 */
function describeTotpStartError(err: unknown): { message: string; emailUnverified: boolean } {
  const code = (err as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/unverified-email":
      return {
        message:
          "Your email address isn't verified yet. Two-step verification needs a verified email — verify it first, then come back.",
        emailUnverified: true,
      };
    case "auth/operation-not-allowed":
    case "auth/admin-restricted-operation":
      return {
        message:
          "Two-step verification isn't switched on for this project yet. An admin needs to enable the Authenticator app (TOTP) under Firebase → Authentication → Sign-in method.",
        emailUnverified: false,
      };
    case "auth/unsupported-first-factor":
      return {
        message:
          "This account can't add an authenticator because it has no email or Google login. Add an email sign-in first, then try again.",
        emailUnverified: false,
      };
    case "auth/too-many-requests":
      return {
        message: "Too many attempts. Please wait a few minutes and try again.",
        emailUnverified: false,
      };
    default:
      return {
        message: code
          ? `Couldn't start setup (${code}). Please send this code to support if it keeps happening.`
          : "Couldn't start setup. Please try again.",
        emailUnverified: false,
      };
  }
}

export default function SecurityPage() {
  const router = useRouter();
  const { user, profile, loading, resendEmailVerification } = useAuth();
  // enrolledFactors lives on the (mutable) Firebase user — compute at render,
  // and bump() after enroll/remove so the render reflects the change.
  const [, bump] = useState(0);
  const enrolled = hasTotp(user ? getFirebaseAuth().currentUser : null);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // Re-auth panel state — which pending action triggered it.
  const [reauthFor, setReauthFor] = useState<"enroll" | "remove" | null>(null);
  const [reauthPassword, setReauthPassword] = useState("");
  // Set when setup failed because the account's email isn't verified — we then
  // offer a one-tap "resend verification email" button.
  const [emailUnverified, setEmailUnverified] = useState(false);
  const [resendNote, setResendNote] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/signin");
  }, [loading, user, router]);

  const isAdmin = profile?.role === "admin";
  const hasPasswordProvider = user?.providerData.some((p) => p.providerId === "password");
  const hasGoogleProvider = user?.providerData.some((p) => p.providerId === "google.com");

  const begin = async () => {
    const u = getFirebaseAuth().currentUser;
    if (!u) return;
    setBusy(true);
    setError(null);
    setEmailUnverified(false);
    setResendNote(null);
    try {
      const e = await startTotpEnrollment(u);
      setEnrollment(e);
      // Render the QR locally — dynamic import keeps qrcode off every other page.
      const QRCode = (await import("qrcode")).default;
      setQrDataUrl(await QRCode.toDataURL(e.qrUri, { margin: 1, width: 220 }));
    } catch (err) {
      if (isRecentLoginError(err)) {
        setReauthFor("enroll");
      } else {
        const { message, emailUnverified } = describeTotpStartError(err);
        setError(message);
        setEmailUnverified(emailUnverified);
      }
    } finally {
      setBusy(false);
    }
  };

  const resendVerification = async () => {
    setBusy(true);
    setResendNote(null);
    try {
      await resendEmailVerification();
      setError(null);
      setEmailUnverified(false);
      setResendNote(
        "Verification email sent. Open it, click the link, then come back and tap “Set up authenticator” again.",
      );
    } catch {
      setResendNote("Couldn't send the email just now — please try again shortly.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = getFirebaseAuth().currentUser;
    if (!u || !enrollment) return;
    setBusy(true);
    setError(null);
    try {
      await finishTotpEnrollment(u, enrollment.secret, code);
      setEnrollment(null);
      setQrDataUrl(null);
      setCode("");
      setDone(true);
      bump((n) => n + 1);
    } catch (err) {
      const c = (err as { code?: string })?.code ?? "";
      setError(
        c === "auth/invalid-verification-code"
          ? "That code didn't match — check the app and try again."
          : "Couldn't verify the code. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const u = getFirebaseAuth().currentUser;
    if (!u) return;
    if (isAdmin) {
      setError("Admins can't remove two-step verification — it's required for admin accounts.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await unenrollTotp(u);
      setDone(false);
      bump((n) => n + 1);
    } catch (err) {
      if (isRecentLoginError(err)) setReauthFor("remove");
      else setError("Couldn't remove the authenticator. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const reauth = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = getFirebaseAuth().currentUser;
    if (!u) return;
    setBusy(true);
    setError(null);
    try {
      if (hasPasswordProvider && reauthPassword) {
        const cred = EmailAuthProvider.credential(u.email ?? "", reauthPassword);
        await reauthenticateWithCredential(u, cred);
      } else if (hasGoogleProvider) {
        await reauthenticateWithPopup(u, new GoogleAuthProvider());
      } else {
        setError("Please sign out and sign in again, then retry.");
        return;
      }
      const pending = reauthFor;
      setReauthFor(null);
      setReauthPassword("");
      if (pending === "enroll") await begin();
      else if (pending === "remove") await remove();
    } catch {
      setError("Re-authentication failed. Check your password and try again.");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user) {
    return (
      <>
        <Header />
        <main className="flex-1">
          <Container className="py-14">
            <div className="h-32 rounded-2xl bg-[var(--color-cream-2)] animate-pulse" />
          </Container>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="flex-1">
        <Container className="py-12 max-w-2xl">
          <Badge tone="ochre">Security</Badge>
          <h1 className="mt-3 font-display text-4xl tracking-tight">
            Two-step verification
          </h1>
          <p className="mt-3 text-[var(--color-ink-soft)]">
            A 6-digit code from an authenticator app (Google Authenticator,
            Authy, Microsoft Authenticator) is asked for at sign-in, on top of
            your password. {isAdmin && (
              <strong className="text-[var(--color-ink)]">
                Required for admin accounts.
              </strong>
            )}
          </p>

          <div className="mt-8 rounded-2xl p-7 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
            {/* STATUS */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    enrolled ? "bg-[var(--color-sage-600)]" : "bg-[var(--color-ochre-500)] animate-pulse"
                  }`}
                />
                <p className="text-sm text-[var(--color-ink)]">
                  {enrolled
                    ? "Two-step verification is ON"
                    : "Two-step verification is off"}
                </p>
              </div>
              {enrolled && !isAdmin && (
                <Button variant="outline" size="sm" onClick={remove} disabled={busy}>
                  Remove
                </Button>
              )}
            </div>
            {enrolled && totpFactor(getFirebaseAuth().currentUser!)?.enrollmentTime && (
              <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                Authenticator added {totpFactor(getFirebaseAuth().currentUser!)!.enrollmentTime}
              </p>
            )}

            {done && (
              <div className="mt-4 rounded-xl p-4 bg-[var(--color-sage-100)] text-sm text-[var(--color-sage-700)] animate-pop-in">
                ✓ Authenticator linked. You&apos;ll be asked for a code next time you
                sign in. {isAdmin && (
                  <Link href="/admin" className="underline font-medium">
                    Back to the admin panel →
                  </Link>
                )}
              </div>
            )}

            {/* RE-AUTH PANEL */}
            {reauthFor && (
              <form onSubmit={reauth} className="mt-6 space-y-4 border-t border-[var(--color-line)] pt-6 animate-slide-up">
                <p className="text-sm text-[var(--color-ink-soft)]">
                  For your security, please confirm it&apos;s you first.
                </p>
                {hasPasswordProvider ? (
                  <>
                    <Input
                      label="Your password"
                      name="reauth-password"
                      type="password"
                      autoComplete="current-password"
                      value={reauthPassword}
                      onChange={(e) => setReauthPassword(e.target.value)}
                      error={error ?? undefined}
                    />
                    <Button type="submit" variant="primary" loading={busy} loadingText="Confirming…">
                      Confirm
                    </Button>
                  </>
                ) : (
                  <Button type="submit" variant="primary" loading={busy} loadingText="Opening Google…">
                    Confirm with Google
                  </Button>
                )}
              </form>
            )}

            {/* ENROLL FLOW */}
            {!enrolled && !enrollment && !reauthFor && (
              <div className="mt-6 border-t border-[var(--color-line)] pt-6">
                <Button onClick={begin} variant="primary" loading={busy} loadingText="Preparing…">
                  Set up authenticator
                </Button>
                {error && <p className="mt-3 text-sm text-[var(--color-brick)]">{error}</p>}
                {emailUnverified && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    loading={busy}
                    loadingText="Sending…"
                    onClick={resendVerification}
                  >
                    Resend verification email
                  </Button>
                )}
                {resendNote && (
                  <p className="mt-3 text-sm text-[var(--color-sage-700)]">{resendNote}</p>
                )}
              </div>
            )}

            {enrollment && (
              <div className="mt-6 border-t border-[var(--color-line)] pt-6 animate-slide-up">
                <ol className="space-y-6 list-none">
                  <li>
                    <p className="text-sm font-medium text-[var(--color-ink)]">
                      1 · Scan this QR code with your authenticator app
                    </p>
                    {qrDataUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={qrDataUrl}
                        alt="QR code for authenticator setup"
                        className="mt-3 rounded-xl border border-[var(--color-line)] bg-white p-2"
                        width={220}
                        height={220}
                      />
                    )}
                    <p className="mt-3 text-xs text-[var(--color-ink-muted)]">
                      Can&apos;t scan? Enter this key manually — and{" "}
                      <strong>save it somewhere safe</strong>; it&apos;s also your
                      backup if you lose your phone:
                    </p>
                    <code className="mt-2 inline-block px-3 py-2 rounded-md bg-[var(--color-cream-2)] text-sm tracking-wider break-all select-all">
                      {enrollment.secretKey}
                    </code>
                  </li>
                  <li>
                    <form onSubmit={verify} className="space-y-4">
                      <p className="text-sm font-medium text-[var(--color-ink)]">
                        2 · Enter the 6-digit code the app shows
                      </p>
                      <Input
                        label="Verification code"
                        name="enroll-code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="123456"
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        error={error ?? undefined}
                      />
                      <div className="flex gap-3">
                        <Button type="submit" variant="primary" loading={busy} loadingText="Verifying…">
                          Turn on two-step verification
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={busy}
                          onClick={() => {
                            setEnrollment(null);
                            setQrDataUrl(null);
                            setCode("");
                            setError(null);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </li>
                </ol>
              </div>
            )}

            {!reauthFor && !enrollment && error && enrolled && (
              <p className="mt-3 text-sm text-[var(--color-brick)]">{error}</p>
            )}
          </div>

          <p className="mt-6 text-xs text-[var(--color-ink-muted)] leading-relaxed">
            Lost your authenticator? Re-add the saved setup key to a new app.
            If you&apos;ve lost both, contact{" "}
            <a href="mailto:tshepowayne@workitsa.co.za" className="underline">support</a>{" "}
            to reset two-step verification on your account.
          </p>
        </Container>
      </main>
      <Footer />
    </>
  );
}
