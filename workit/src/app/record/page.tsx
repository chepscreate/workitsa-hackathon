"use client";

/**
 * Work Record — a worker's shareable, verifiable proof-of-work certificate.
 *
 * Public bearer-token page (/record?t={token}, same model as /u?id=): anyone
 * with the link — a landlord, lender, or prospective employer — sees the
 * server-aggregated record from workRecords/{token} and can trust it because
 * only the generateWorkRecord callable can write it. The owner additionally
 * gets share / refresh / download controls. The certificate itself renders in
 * WorkRecordView (print-styled — "Download PDF" is just window.print()).
 */

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import Button from "@/components/Button";
import WhatsAppShare from "@/components/WhatsAppShare";
import WorkRecordView from "@/components/WorkRecordView";
import { useAuth } from "@/contexts/AuthContext";
import { getWorkRecord, generateWorkRecord, type WorkRecord } from "@/lib/workRecord";

function RecordInner({ token }: { token: string }) {
  const { user } = useAuth();
  const [record, setRecord] = useState<WorkRecord | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shareUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://workitsa.co.za"}/record?t=${token}`;

  useEffect(() => {
    let cancelled = false;
    getWorkRecord(token).then(
      (r) => { if (!cancelled) setRecord(r); },
      () => { if (!cancelled) setRecord(null); },
    );
    return () => { cancelled = true; };
  }, [token]);

  if (record === undefined) {
    return <div className="h-80 rounded-2xl bg-[var(--color-cream-2)] animate-pulse" />;
  }
  if (record === null) {
    return (
      <div className="rounded-2xl p-8 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft text-center">
        <h1 className="font-display text-2xl tracking-tight mb-2">Record not found</h1>
        <p className="text-sm text-[var(--color-ink-soft)] max-w-md mx-auto">
          This Work Record link is invalid or has been reset by its owner. Ask
          the worker to share a fresh link from their Workit account.
        </p>
        <p className="mt-4 text-sm">
          <Link href="/" className="underline">workitsa.co.za</Link>
        </p>
      </div>
    );
  }

  const isOwner = user?.uid === record.uid;

  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      await generateWorkRecord();
      const fresh = await getWorkRecord(token);
      setRecord(fresh ?? record);
    } catch {
      setError("Couldn't refresh the record just now — please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Owner toolbar — never printed */}
      {isOwner && (
        <div className="mb-6 rounded-2xl p-5 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft print:hidden">
          <p className="text-sm text-[var(--color-ink-soft)] mb-3">
            This is your live Work Record. Anyone with the link can view it —
            share it with a landlord, lender, or employer as proof of your work
            history. <b className="text-[var(--color-ink)]">Refresh</b> after new
            jobs so it stays current.
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            <Button size="sm" variant="outline" onClick={refresh} loading={busy} loadingText="Refreshing…">
              ↻ Refresh
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              ⬇ Download PDF
            </Button>
            <div className="flex-1 min-w-[220px]">
              <WhatsAppShare
                variant="button"
                text={`My verified Workit Work Record — ${record.totalJobs} jobs completed`}
                url={shareUrl}
              />
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-[var(--color-brick)]">{error}</p>}
        </div>
      )}

      <WorkRecordView record={record} shareUrl={shareUrl} />
    </>
  );
}

function RecordWithParams() {
  const search = useSearchParams();
  const t = search.get("t");
  if (!t) {
    return (
      <p>
        No record selected.{" "}
        <Link href="/" className="underline">Go to workitsa.co.za</Link>.
      </p>
    );
  }
  return <RecordInner token={t} />;
}

export default function WorkRecordPage() {
  return (
    <>
      <div className="print:hidden">
        <Header />
      </div>
      <main className="flex-1">
        <Container className="py-14 print:py-0 max-w-3xl">
          <Suspense fallback={<p className="text-[var(--color-ink-muted)]">Loading…</p>}>
            <RecordWithParams />
          </Suspense>
        </Container>
      </main>
      <div className="print:hidden">
        <Footer />
      </div>
    </>
  );
}
