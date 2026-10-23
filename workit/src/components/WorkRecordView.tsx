"use client";

/**
 * The Work Record certificate itself — pure presentation of a WorkRecord doc
 * (see lib/workRecord.ts). Rendered by /record?t={token} for anyone with the
 * link; print-styled so "Download PDF" is just window.print(). The QR encodes
 * shareUrl so a printed copy stays verifiable against the live record.
 */

import { useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import Badge from "@/components/Badge";
import Logo from "@/components/Logo";
import { StarsRead } from "@/components/Stars";
import { CATEGORIES } from "@/lib/types";
import type { WorkRecord } from "@/lib/workRecord";

function categoryLabel(id: string) {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

function fmtDate(ms: number, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  return new Date(ms).toLocaleDateString("en-ZA", opts);
}

function fmtRand(n: number) {
  return `R ${Math.round(n).toLocaleString("en-ZA")}`;
}

function StatTile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl p-4 bg-[var(--color-cream-2)] border border-[var(--color-line)] text-center">
      <p className="font-display text-2xl text-[var(--color-ink)]">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">{sub}</p>}
    </div>
  );
}

export default function WorkRecordView({ record, shareUrl }: { record: WorkRecord; shareUrl: string }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // QR of the record's own URL — the printed copy stays verifiable.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const QRCode = (await import("qrcode")).default;
        const url = await QRCode.toDataURL(shareUrl, { margin: 1, width: 140 });
        if (!cancelled) setQrDataUrl(url);
      } catch {
        /* QR is decoration — the URL is printed alongside it */
      }
    })();
    return () => { cancelled = true; };
  }, [shareUrl]);

  return (
    <section className="rounded-2xl bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft overflow-hidden print:border-0 print:shadow-none">
      {/* Brand band */}
      <div className="p-6 sm:p-8 border-b border-[var(--color-line)] flex items-center justify-between gap-4 flex-wrap">
        <Logo size="md" />
        <div className="text-right">
          <p className="font-display text-xl text-[var(--color-ink)]">Work Record</p>
          <p className="text-xs text-[var(--color-ink-muted)]">
            Generated {fmtDate(record.generatedAt)} · workitsa.co.za
          </p>
        </div>
      </div>

      <div className="p-6 sm:p-8">
        {/* Identity */}
        <div className="flex items-center gap-4 flex-wrap">
          <Avatar name={record.displayName} photoURL={record.photoURL} size="lg" />
          <div className="min-w-0">
            <h1 className="font-display text-3xl tracking-tight leading-tight">
              {record.displayName}
            </h1>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {record.verified && <Badge tone="sage">✓ ID verified</Badge>}
              {record.backgroundVerified && <Badge tone="ink">✓ Background checked</Badge>}
              <Badge tone="stone">Member since {fmtDate(record.memberSince, { month: "short", year: "numeric" })}</Badge>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile label="Jobs completed" value={record.totalJobs} />
          <StatTile label="Earned via Workit" value={fmtRand(record.totalEarned)} sub="agreed job prices" />
          <StatTile
            label="Rating"
            value={record.ratingCount > 0 ? `${record.ratingAvg.toFixed(1)} ★` : "—"}
            sub={record.ratingCount > 0 ? `${record.ratingCount} rating${record.ratingCount === 1 ? "" : "s"}` : "no ratings yet"}
          />
          <StatTile
            label="Payments confirmed"
            value={record.paymentsConfirmed}
            sub="by both parties"
          />
        </div>

        {record.firstJobAt && record.lastJobAt && (
          <p className="mt-4 text-sm text-[var(--color-ink-soft)]">
            Active from <b className="text-[var(--color-ink)]">{fmtDate(record.firstJobAt)}</b> to{" "}
            <b className="text-[var(--color-ink)]">{fmtDate(record.lastJobAt)}</b>.
          </p>
        )}

        {/* Category breakdown */}
        {record.categories.length > 0 && (
          <div className="mt-6">
            <p className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold mb-2">
              Work by category
            </p>
            <div className="flex flex-wrap gap-2">
              {record.categories.map((c) => (
                <span
                  key={c.id}
                  className="px-3 py-1.5 rounded-pill text-xs font-medium bg-[var(--color-cream-2)] border border-[var(--color-line)] text-[var(--color-ink-soft)]"
                >
                  {categoryLabel(c.id)} · {c.count} job{c.count === 1 ? "" : "s"} · {fmtRand(c.earned)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Job history */}
        {record.jobs.length > 0 ? (
          <div className="mt-6">
            <p className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold mb-2">
              Confirmed jobs {record.totalJobs > record.jobs.length ? `(latest ${record.jobs.length} of ${record.totalJobs})` : ""}
            </p>
            <ul className="divide-y divide-[var(--color-line)] border border-[var(--color-line)] rounded-xl overflow-hidden">
              {record.jobs.map((j, i) => (
                <li key={i} className="p-3 sm:px-4 flex items-center gap-3 flex-wrap bg-[var(--color-paper)]">
                  <div className="flex-1 min-w-[160px]">
                    <p className="text-sm font-medium text-[var(--color-ink)]">{j.title}</p>
                    <p className="text-xs text-[var(--color-ink-muted)]">
                      {categoryLabel(j.category)}{j.area ? ` · ${j.area}` : ""} · {fmtDate(j.at)}
                    </p>
                  </div>
                  {typeof j.stars === "number" && <StarsRead value={j.stars} />}
                  {j.paymentConfirmed && (
                    <span title="Payment confirmed by both parties" className="text-xs text-[var(--color-sage-700)]">💵 paid ✓</span>
                  )}
                  <p className="font-display text-lg text-[var(--color-ochre-600)] w-20 text-right">
                    {fmtRand(j.price)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-6 text-sm text-[var(--color-ink-soft)]">
            No confirmed jobs on this record yet.
          </p>
        )}

        {/* Verification footer */}
        <div className="mt-8 pt-6 border-t border-[var(--color-line)] flex items-center gap-4 flex-wrap">
          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="QR code linking to this record" className="w-[92px] h-[92px] rounded-lg border border-[var(--color-line)]" />
          )}
          <div className="flex-1 min-w-[220px] text-xs text-[var(--color-ink-muted)] leading-relaxed">
            <p>
              This record was generated by <b className="text-[var(--color-ink)]">Workit</b> (workitsa.co.za)
              from jobs confirmed on the platform — it cannot be edited by the worker.
              Verify the live version at:
            </p>
            <p className="mt-1 break-all font-medium text-[var(--color-ink-soft)]">{shareUrl}</p>
            <p className="mt-1">
              Amounts are the agreed job prices; payment happens directly between the parties.
              &ldquo;Paid ✓&rdquo; marks payments confirmed by both sides.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
