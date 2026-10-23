"use client";

import { useEffect, useState } from "react";
import * as Sentry from "@sentry/browser";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import Button from "@/components/Button";
import Badge from "@/components/Badge";

export default function SentryTestPage() {
  const [dsn, setDsn] = useState<string | undefined>(undefined);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  useEffect(() => {
    setDsn(process.env.NEXT_PUBLIC_SENTRY_DSN);
    setSdkLoaded(true);
    // Force-init here too in case AuthContext's init never ran
    if (process.env.NEXT_PUBLIC_SENTRY_DSN && !Sentry.getClient()) {
      Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        tracesSampleRate: 0,
      });
    }
    (window as unknown as { Sentry?: typeof Sentry }).Sentry = Sentry;
  }, []);

  const fireMessage = async () => {
    const id = Sentry.captureMessage(
      `Workit /sentry-test message — ${new Date().toISOString()}`,
      "info",
    );
    await Sentry.flush(2000);
    setLastResult(`captureMessage → event id: ${id ?? "(none)"} · flushed.`);
  };

  const fireException = async () => {
    const id = Sentry.captureException(
      new Error(`Workit /sentry-test exception — ${new Date().toISOString()}`),
    );
    await Sentry.flush(2000);
    setLastResult(`captureException → event id: ${id ?? "(none)"} · flushed.`);
  };

  const fireUncaught = () => {
    // Real uncaught error — should be picked up by window.onerror.
    setTimeout(() => {
      throw new Error(`Workit /sentry-test uncaught — ${new Date().toISOString()}`);
    }, 0);
    setLastResult("Threw uncaught error (check Sentry Issues feed).");
  };

  return (
    <>
      <Header />
      <main className="flex-1">
        <Container className="py-14 max-w-2xl">
          <Badge tone="ink">Diagnostic</Badge>
          <h1 className="mt-4 font-display text-4xl tracking-tight">
            Sentry test page.
          </h1>
          <p className="mt-3 text-[var(--color-ink-soft)]">
            Use this once to confirm error monitoring is wired. Delete it
            (or leave it — it&apos;s harmless) once you&apos;ve seen events
            land in your Sentry dashboard.
          </p>

          <section className="mt-8 rounded-2xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft space-y-3">
            <Row label="SDK module loaded" value={sdkLoaded ? "✓ yes" : "no"} />
            <Row
              label="NEXT_PUBLIC_SENTRY_DSN at build time"
              value={dsn ? `${dsn.slice(0, 30)}…` : "missing — env var not picked up"}
            />
            <Row
              label="Sentry client active"
              value={Sentry.getClient() ? "✓ yes" : "no client"}
            />
            <Row
              label="window.Sentry"
              value={
                typeof window !== "undefined"
                  && (window as unknown as { Sentry?: unknown }).Sentry
                  ? "✓ exposed"
                  : "not exposed"
              }
            />
          </section>

          <section className="mt-6 rounded-2xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
            <h2 className="font-display text-xl mb-3">Fire a test event</h2>
            <div className="flex flex-wrap gap-3">
              <Button onClick={fireMessage} variant="primary">Send captureMessage</Button>
              <Button onClick={fireException} variant="secondary">Send captureException</Button>
              <Button onClick={fireUncaught} variant="outline">Throw uncaught</Button>
            </div>
            {lastResult && (
              <p className="mt-4 text-sm text-[var(--color-sage-700)] font-mono">
                {lastResult}
              </p>
            )}
          </section>
        </Container>
      </main>
      <Footer />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-[var(--color-ink-muted)]">{label}</span>
      <span className="font-mono text-[var(--color-ink)] text-right">{value}</span>
    </div>
  );
}
