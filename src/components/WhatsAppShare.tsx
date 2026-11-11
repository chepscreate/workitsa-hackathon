"use client";

import { useState } from "react";

type Props = {
  text: string;
  url: string;
  /** Visual variant — chip is small, button is full-width primary */
  variant?: "chip" | "button";
};

const WA_GREEN = "#25D366";

export default function WhatsAppShare({ text, url, variant = "chip" }: Props) {
  const [copied, setCopied] = useState(false);
  const message = `${text}\n\n${url}`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(message)}`;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  if (variant === "button") {
    return (
      <div className="flex flex-col sm:flex-row gap-2">
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-pill text-[15px] font-medium text-white hover:opacity-90 transition-opacity"
          style={{ background: WA_GREEN }}
        >
          <WhatsAppIcon />
          Share on WhatsApp
        </a>
        <button
          type="button"
          onClick={onCopy}
          className="px-5 py-3 rounded-pill text-[15px] font-medium bg-[var(--color-paper)] border border-[var(--color-line)] hover:bg-[var(--color-cream-2)]"
        >
          {copied ? "Copied ✓" : "Copy link"}
        </button>
      </div>
    );
  }

  return (
    <div className="inline-flex gap-2">
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-pill text-sm font-medium text-white hover:opacity-90"
        style={{ background: WA_GREEN }}
      >
        <WhatsAppIcon size={14} />
        Share
      </a>
      <button
        type="button"
        onClick={onCopy}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-pill text-sm bg-[var(--color-paper)] border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] hover:bg-[var(--color-cream-2)]"
        aria-label="Copy link"
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}

function WhatsAppIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.81 11.81 0 0 1 8.413 3.488 11.82 11.82 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l.495.785-.991 3.617 3.475-.984zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479c0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/>
    </svg>
  );
}
