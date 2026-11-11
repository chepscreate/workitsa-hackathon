"use client";

import { useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import Button from "@/components/Button";
import Badge from "@/components/Badge";
import Input from "@/components/Input";
import { useAuth } from "@/contexts/AuthContext";

export default function ForgotPasswordPage() {
  const { resetPassword, configured } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Header />
      <main className="flex-1">
        <Container className="py-14 max-w-md">
          <div className="text-center mb-8">
            <Badge tone="ochre">Forgot password</Badge>
            <h1 className="mt-4 font-display text-4xl tracking-tight">
              Let&apos;s get you back in.
            </h1>
            <p className="mt-2 text-[var(--color-ink-soft)] text-sm">
              Enter your email — we&apos;ll send you a link to choose a new password.
            </p>
          </div>

          {sent ? (
            <div className="rounded-2xl p-7 bg-[var(--color-sage-100)]/40 border border-[var(--color-sage-400)]/50 text-center">
              <h2 className="font-display text-xl">Check your email.</h2>
              <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
                If <b>{email}</b> has a Workit account, a reset link is on its way.
                Tap it from your phone within 1 hour.
              </p>
              <p className="mt-4 text-xs text-[var(--color-ink-muted)]">
                Didn&apos;t arrive? Check your spam folder, or{" "}
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="underline text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                >
                  try again
                </button>
                .
              </p>
              <div className="mt-6">
                <Button href="/signin" variant="outline" size="md">
                  Back to sign in
                </Button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={onSubmit}
              className="space-y-5 rounded-2xl p-7 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft"
            >
              <Input
                label="Email address"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                error={error ?? undefined}
              />
              <Button
                type="submit"
                size="lg"
                variant="primary"
                className="w-full"
                loading={submitting}
                loadingText="Sending…"
                disabled={!configured}
              >
                Send reset link
              </Button>
              <p className="text-center text-sm text-[var(--color-ink-muted)]">
                Remembered it?{" "}
                <Link
                  href="/signin"
                  className="text-[var(--color-ochre-600)] hover:text-[var(--color-ochre-700)] underline-offset-2 hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </Container>
      </main>
      <Footer />
    </>
  );
}
