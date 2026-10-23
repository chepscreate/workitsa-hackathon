"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Minimal click-to-zoom lightbox for job/portfolio photos.
 * Usage:
 *   <PhotoGrid urls={[...]} />
 * Clicking a thumbnail opens an overlay with prev/next + esc to close.
 */
export function PhotoGrid({
  urls,
  className = "",
}: {
  urls: string[];
  className?: string;
}) {
  const [index, setIndex] = useState<number | null>(null);

  if (!urls || urls.length === 0) return null;

  return (
    <>
      <div className={`grid grid-cols-2 sm:grid-cols-3 gap-3 ${className}`}>
        {urls.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => setIndex(i)}
            className="block aspect-square rounded-lg overflow-hidden border border-[var(--color-line)] group"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Photo ${i + 1}`}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          </button>
        ))}
      </div>
      {index !== null && (
        <Lightbox
          urls={urls}
          index={index}
          onClose={() => setIndex(null)}
          onChange={(i) => setIndex(i)}
        />
      )}
    </>
  );
}

export function Lightbox({
  urls,
  index,
  onClose,
  onChange,
}: {
  urls: string[];
  index: number;
  onClose: () => void;
  onChange: (i: number) => void;
}) {
  // We portal into document.body so the overlay escapes any ancestor that
  // creates a containing block for fixed positioning (transform, filter,
  // will-change, etc.) — otherwise the dark backdrop ends up trapped inside
  // a card and the page bleeds through.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onChange((index - 1 + urls.length) % urls.length);
      if (e.key === "ArrowRight") onChange((index + 1) % urls.length);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [index, urls.length, onClose, onChange]);

  if (!mounted || typeof document === "undefined") return null;

  const url = urls[index];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close"
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white text-xl flex items-center justify-center"
      >
        ×
      </button>

      {urls.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange((index - 1 + urls.length) % urls.length);
            }}
            aria-label="Previous"
            className="absolute left-4 sm:left-8 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl flex items-center justify-center"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange((index + 1) % urls.length);
            }}
            aria-label="Next"
            className="absolute right-4 sm:right-8 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl flex items-center justify-center"
          >
            ›
          </button>
        </>
      )}

      <div
        className="max-w-[92vw] max-h-[88vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={`Photo ${index + 1} of ${urls.length}`}
          className="max-w-full max-h-[82vh] object-contain rounded-lg shadow-2xl"
        />
        <p className="mt-3 text-white/70 text-sm">
          {index + 1} / {urls.length}
        </p>
      </div>
    </div>,
    document.body,
  );
}
