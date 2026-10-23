"use client";

/**
 * Verification review for the admin queue.
 *
 * The sensitive payload (ID number, document URLs, address, skills) lives in the
 * private subcollection users/{uid}/private/profile — readable only by the owner
 * and admins — so this component fetches it directly by uid (not from the
 * world-readable user doc). Image docs open in the in-app lightbox; the selfie
 * video plays inline; PDFs stay as links.
 */

import { useEffect, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { Lightbox } from "@/components/ImageLightbox";
import { getFunctionsInstance } from "@/lib/firebase";
import { idCheckVerdict } from "@/lib/saId";
import type { SaIdCheck, UserProfile } from "@/lib/types";

type Verification = NonNullable<UserProfile["verification"]>;

/** Automated SA ID check result — green pass / amber warning / red fail. */
function IdCheckPanel({ check }: { check?: SaIdCheck }) {
  if (!check) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--color-line)] p-3 text-xs text-[var(--color-ink-muted)]">
        Automated ID check: not run (submitted before this feature, or no ID number).
      </div>
    );
  }
  const verdict = idCheckVerdict(check);
  const tone =
    verdict === "pass"
      ? { bg: "bg-[var(--color-sage-100)]/50", border: "border-[var(--color-sage-400)]/60", label: "✓ Passed automated ID check", text: "text-[var(--color-sage-700)]" }
      : verdict === "warn"
        ? { bg: "bg-[var(--color-ochre-50)]", border: "border-[var(--color-ochre-300)]", label: "⚠ Passed structure — mismatch flagged", text: "text-[var(--color-ochre-700)]" }
        : { bg: "bg-[var(--color-brick-soft)]/40", border: "border-[var(--color-brick)]", label: "✗ Failed automated ID check", text: "text-[var(--color-brick)]" };
  const yn = (b: boolean | null) => (b === null ? "—" : b ? "✓" : "✗");
  return (
    <div className={`rounded-lg border ${tone.border} ${tone.bg} p-3`}>
      <p className={`text-sm font-semibold ${tone.text}`}>{tone.label}</p>
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs text-[var(--color-ink-soft)]">
        <span>Check digit: <b>{check.luhnOk ? "valid" : "INVALID"}</b></span>
        <span>DOB on ID: <b>{check.dob ?? "—"}</b></span>
        <span>DOB matches: <b>{yn(check.dobMatch)}</b></span>
        <span>Gender matches: <b>{yn(check.genderMatch)}</b></span>
        <span>Gender: <b>{check.gender ?? "—"}</b></span>
        <span>Citizenship: <b>{check.citizenship ?? "—"}</b></span>
        <span className="col-span-2">Ran: {new Date(check.ran).toLocaleString()}</span>
      </div>
      {check.flags.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-[var(--color-brick)]">
          {check.flags.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[10px] text-[var(--color-ink-muted)]">
        Structural check only — confirms the number is well-formed and matches what they entered. Real
        Home Affairs validation + selfie match come with Smile ID (Layer 2).
      </p>
    </div>
  );
}

/** How many hard red flags a fraud payload carries (drives the header 🚩). */
export function countFraudAlerts(fraud?: Verification["fraud"]): number {
  if (!fraud) return 0;
  let n = 0;
  if (fraud.duplicateIdUids?.length) n += 1;
  if (fraud.idUnder18) n += 1;
  if (fraud.banMatch?.length) n += 1;
  if (fraud.duplicateFiles?.length) n += 1;
  const ocr = fraud.ocr;
  if (ocr && !ocr.skipped && !ocr.error && ocr.idNumberFound === false && (ocr.textChars ?? 0) >= 20) {
    n += 1;
  }
  return n;
}

/** Server-computed fraud signals — red flags first, then the OCR read. */
function FraudPanel({ fraud }: { fraud?: Verification["fraud"] }) {
  if (!fraud) return null;
  const alerts: string[] = [];
  if (fraud.duplicateIdUids?.length) {
    alerts.push(
      `Same ID number submitted by ${fraud.duplicateIdUids.length} other account${
        fraud.duplicateIdUids.length === 1 ? "" : "s"
      } (${fraud.duplicateIdUids.join(", ")})`,
    );
  }
  if (fraud.idUnder18) {
    alerts.push(`The ID number belongs to someone UNDER 18 (age ${fraud.idAge ?? "?"})`);
  }
  if (fraud.banMatch?.length) {
    alerts.push(`Signup ${fraud.banMatch.join(" + ")} matches a previously suspended account`);
  }
  if (fraud.duplicateFiles?.length) {
    alerts.push(
      `Uploaded document byte-identical to account ${fraud.duplicateFiles[0].matchesUid}`,
    );
  }

  const ocr = fraud.ocr;
  const ocrLine = !ocr
    ? null
    : ocr.skipped
      ? "OCR skipped — ID uploaded as PDF (check the number manually)."
      : ocr.error
        ? "OCR couldn't read the ID photo — check it manually."
        : ocr.idNumberFound
          ? `✓ Typed ID number found in the ID photo${
              (ocr.nameTokens ?? 0) > 0
                ? ` · name match ${ocr.nameTokensFound}/${ocr.nameTokens}`
                : ""
            }`
          : (ocr.textChars ?? 0) < 20
            ? "OCR read almost no text from the ID photo — likely blurry or not a document."
            : "⚠ Typed ID number NOT found in the ID photo text — verify carefully.";

  if (alerts.length === 0 && !ocrLine) return null;
  return (
    <div className="space-y-2">
      {alerts.length > 0 && (
        <div className="rounded-lg border border-[var(--color-brick)] bg-[var(--color-brick-soft)]/40 p-3">
          <p className="text-sm font-semibold text-[var(--color-brick)]">
            🚩 Fraud signals — review before approving
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-[var(--color-brick)]">
            {alerts.map((a, i) => (
              <li key={i}>• {a}</li>
            ))}
          </ul>
        </div>
      )}
      {ocrLine && (
        <p
          className={`text-xs ${
            ocrLine.startsWith("✓")
              ? "text-[var(--color-sage-700)]"
              : ocrLine.startsWith("⚠")
                ? "text-[var(--color-brick)]"
                : "text-[var(--color-ink-muted)]"
          }`}
        >
          {ocrLine}
        </p>
      )}
    </div>
  );
}

function classify(url?: string): "image" | "video" | "file" | null {
  if (!url) return null;
  const path = decodeURIComponent(url.split("?")[0]).toLowerCase();
  if (/\.(png|jpe?g|webp|gif|heic|heif|avif)$/.test(path)) return "image";
  if (/\.(mp4|webm|mov|m4v|ogg)$/.test(path)) return "video";
  return "file";
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">{label}</dt>
      <dd className="mt-1 text-[var(--color-ink)] whitespace-pre-wrap">
        {value || <span className="text-[var(--color-ink-muted)] italic">—</span>}
      </dd>
    </div>
  );
}

export default function VerificationDocs({
  uid,
  onFraud,
}: {
  uid: string;
  /** Reports the red-flag count upward once docs load, so the card header
   *  can show a 🚩 badge before the admin scrolls into the documents. */
  onFraud?: (alertCount: number) => void;
}) {
  const [v, setV] = useState<Verification | null>(null);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState<number | null>(null);
  // URLs whose <img> failed to load (PDF, bad upload) → render as a link instead.
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const markFailed = (url: string) =>
    setFailed((s) => {
      const n = new Set(s);
      n.add(url);
      return n;
    });
  // Kept in a ref so an inline parent callback doesn't re-trigger the fetch.
  const onFraudRef = useRef(onFraud);
  onFraudRef.current = onFraud;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // The callable resolves Storage paths to ~15-minute signed URLs —
        // document links shown here expire instead of living forever.
        const fn = httpsCallable<{ uid: string }, { verification: Verification }>(
          getFunctionsInstance(),
          "getVerificationPayload",
        );
        const res = await fn({ uid });
        if (cancelled) return;
        const payload = res.data?.verification ?? {};
        setV(payload);
        onFraudRef.current?.(countFraudAlerts(payload.fraud));
      } catch {
        if (!cancelled) setV({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  if (loading) {
    return <div className="sm:col-span-2 text-sm text-[var(--color-ink-muted)]">Loading documents…</div>;
  }

  const vd = v ?? {};

  // EVERY doc must render somewhere: images → thumbnail grid + lightbox,
  // videos → inline player, anything else (PDFs, odd formats) → link chip.
  // Previously only address/police had a file fallback — an SA ID uploaded
  // as a PDF classified as "file" and silently vanished from the review card.
  const imageDocs: { label: string; url: string }[] = [];
  const videoDocs: { label: string; url: string }[] = [];
  const fileDocs: { label: string; url: string }[] = [];
  const place = (label: string, url?: string) => {
    const kind = classify(url);
    if (!url || !kind) return;
    if (kind === "image") imageDocs.push({ label, url });
    else if (kind === "video") videoDocs.push({ label, url });
    else fileDocs.push({ label, url });
  };
  place("SA ID", vd.idPhotoURL);
  place("Proof of address", vd.addressProofURL);
  place("Police clearance", vd.policeClearanceURL);
  (vd.skillProofURLs ?? []).forEach((u, i) => place(`Past work ${i + 1}`, u));
  place("Selfie video", vd.selfieVideoURL);
  // Only images that actually loaded go in the lightbox; failed ones become links.
  const liveImages = imageDocs.filter((d) => !failed.has(d.url));
  const imageUrls = liveImages.map((d) => d.url);

  const nothing = imageDocs.length === 0 && videoDocs.length === 0 && fileDocs.length === 0;

  return (
    <div className="sm:col-span-2 grid sm:grid-cols-2 gap-4">
      <div className="sm:col-span-2">
        <IdCheckPanel check={vd.idCheck} />
      </div>
      <div className="sm:col-span-2">
        <FraudPanel fraud={vd.fraud} />
      </div>
      <Field label="SA ID" value={vd.idNumber} />
      <Field label="Address" value={vd.addressLine} />
      <div className="sm:col-span-2">
        <Field label="Skills" value={vd.skillsSummary} />
      </div>

      <div className="sm:col-span-2">
        <dt className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">Documents</dt>
        <dd className="mt-2 space-y-4">
          {nothing && (
            <p className="text-sm text-[var(--color-ink-muted)] italic">No documents uploaded yet.</p>
          )}

          {imageDocs.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {imageDocs.map((d) =>
                failed.has(d.url) ? (
                  // Failed to render as an image (e.g. a PDF) → clean link.
                  <a
                    key={d.url}
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`${d.label} — open document`}
                    className="w-24 h-24 rounded-lg border border-[var(--color-line)] bg-[var(--color-cream-2)] flex flex-col items-center justify-center gap-1 px-1 text-center hover:bg-[var(--color-cream)]"
                  >
                    <span className="text-xl" aria-hidden>📄</span>
                    <span className="text-[10px] leading-tight text-[var(--color-ochre-600)]">
                      {d.label} ↗
                    </span>
                  </a>
                ) : (
                  <button
                    key={d.url}
                    type="button"
                    onClick={() => setIdx(liveImages.findIndex((x) => x.url === d.url))}
                    className="group relative w-24 h-24 rounded-lg overflow-hidden border border-[var(--color-line)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ochre-300)]"
                    title={`${d.label} — click to preview`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={d.url}
                      alt={d.label}
                      loading="lazy"
                      onError={() => markFailed(d.url)}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-black/55 text-white text-[10px] leading-tight px-1.5 py-1 text-left">
                      {d.label}
                    </span>
                  </button>
                ),
              )}
            </div>
          )}

          {videoDocs.map((d) => (
            <div key={d.url}>
              <p className="text-xs text-[var(--color-ink-muted)] mb-1">{d.label}</p>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                src={d.url}
                controls
                preload="metadata"
                className="w-full max-w-xs rounded-lg border border-[var(--color-line)] bg-black aspect-video"
              />
            </div>
          ))}

          {fileDocs.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {fileDocs.map((d) => (
                <a
                  key={d.url}
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-pill border border-[var(--color-line)] text-xs text-[var(--color-ochre-600)] hover:text-[var(--color-ochre-700)] hover:bg-[var(--color-cream-2)]"
                >
                  📄 {d.label} ↗
                </a>
              ))}
            </div>
          )}
        </dd>
      </div>

      {idx !== null && imageUrls.length > 0 && (
        <Lightbox urls={imageUrls} index={idx} onClose={() => setIdx(null)} onChange={setIdx} />
      )}
    </div>
  );
}
