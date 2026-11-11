"use client";

import { useRef, useState } from "react";
import { uploadFile, type UploadHandle } from "@/lib/storage";
import { measure } from "@/lib/performance";

/**
 * Compress a phone-camera image down to a sensible web size before upload.
 * Saves Storage cost + bandwidth (workers on data budgets) without losing
 * usable detail. Leaves non-image files untouched (so PDFs / videos pass
 * through as-is).
 */
async function compressImage(
  file: File,
  { maxDim = 1600, quality = 0.82, stamp = false }: { maxDim?: number; quality?: number; stamp?: boolean } = {},
): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  // Skip if already small — UNLESS we need to burn in a proof-of-work stamp,
  // in which case we always re-render through the canvas.
  if (!stamp && file.size < 600 * 1024) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const ratio = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * ratio);
    const h = Math.round(bitmap.height * ratio);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);

    // Proof-of-work stamp: burn a legible "Workit · <date, time>" watermark into
    // the bottom-left so the photo itself carries when it was captured — much
    // harder to pass off a random gallery image as fresh on-the-job evidence.
    if (stamp) {
      const label =
        "Workit · " +
        new Date().toLocaleString("en-ZA", {
          day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
        });
      const fontPx = Math.max(13, Math.round(h * 0.032));
      ctx.font = `bold ${fontPx}px Arial, sans-serif`;
      ctx.textBaseline = "middle";
      const padX = Math.round(fontPx * 0.6);
      const barH = Math.round(fontPx * 1.8);
      const txtW = ctx.measureText(label).width;
      ctx.fillStyle = "rgba(31,22,18,0.62)";
      ctx.fillRect(0, h - barH, Math.min(w, txtW + padX * 2), barH);
      ctx.fillStyle = "#FAF4EC";
      ctx.fillText(label, padX, h - barH / 2);
    }

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) return file;
    // If compression somehow made the file BIGGER (rare), keep the original —
    // but never when stamping, since the stamped pixels must be preserved.
    if (!stamp && blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, ".jpg");
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

type Props = {
  kind: "avatar" | "verification" | "job" | "portfolio";
  scopeId: string;
  accept?: string;
  label?: string;
  hint?: string;
  // Called with the final downloadURL after a successful upload. `path` is the
  // Storage object path — persist THAT (not the tokenised url) for sensitive
  // docs, so viewers mint short-lived signed URLs instead of forever-links.
  onUploaded: (url: string, file: File, path: string) => void;
  // Optional preview already set (so the component shows existing image)
  initialPreview?: string;
  multiple?: boolean;
  // When set, hints the device to open the camera directly ("environment" = rear
  // camera, "user" = selfie). Used for on-the-job proof photos so evidence is
  // captured live rather than picked from the gallery.
  capture?: "environment" | "user";
  // When true, burns a "Workit · <date, time>" watermark into the image.
  stamp?: boolean;
  // When set, the upload is measured as a Firebase Performance custom trace of
  // this name (e.g. "upload_verification_doc").
  traceName?: string;
};

export default function PhotoUploader({
  kind,
  scopeId,
  accept = "image/*",
  label = "Choose a file",
  hint,
  onUploaded,
  initialPreview,
  multiple = false,
  capture,
  stamp = false,
  traceName,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewURL, setPreviewURL] = useState<string | undefined>(initialPreview);
  const handleRef = useRef<UploadHandle | null>(null);

  const onPick = () => inputRef.current?.click();

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setError(null);

    const fileList = Array.from(files);
    for (const original of fileList) {
      try {
        setUploading(true);
        setProgress(0);

        // Compress phone-camera images down to ~1600px JPEG @ q82 before
        // upload, but only for images — videos and PDFs go through untouched.
        const file = original.type.startsWith("image/")
          ? await compressImage(original, { stamp })
          : original;

        // Show local preview immediately for images
        if (file.type.startsWith("image/")) {
          const objectUrl = URL.createObjectURL(file);
          setPreviewURL(objectUrl);
        }

        const handle = uploadFile(kind, scopeId, file, (p) => setProgress(p.progress));
        handleRef.current = handle;
        const url = traceName
          ? await measure(traceName, () => handle.promise)
          : await handle.promise;
        onUploaded(url, file, handle.path);
        setPreviewURL(url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setUploading(false);
        handleRef.current = null;
        if (inputRef.current) inputRef.current.value = "";
      }
    }
  };

  const onCancel = () => {
    if (handleRef.current) handleRef.current.cancel();
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        {...(capture ? { capture } : {})}
        multiple={multiple}
        onChange={onChange}
        className="hidden"
      />

      <div className="flex items-center gap-4">
        {previewURL && accept.startsWith("image") && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewURL}
            alt="preview"
            className="w-20 h-20 rounded-xl object-cover border border-[var(--color-line)] bg-[var(--color-cream-2)]"
          />
        )}
        <div className="flex-1">
          <button
            type="button"
            onClick={uploading ? onCancel : onPick}
            className="px-4 py-2 rounded-pill bg-[var(--color-ink)] text-[var(--color-cream)] text-sm font-medium hover:opacity-90"
          >
            {uploading ? "Cancel upload" : label}
          </button>
          {hint && !uploading && (
            <p className="mt-1.5 text-xs text-[var(--color-ink-muted)]">{hint}</p>
          )}
          {uploading && (
            <div className="mt-3">
              <div className="h-1.5 rounded-full bg-[var(--color-cream-2)] overflow-hidden">
                <div
                  className="h-full bg-[var(--color-ochre-500)] transition-all"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-[var(--color-ink-muted)]">
                Uploading… {Math.round(progress * 100)}%
              </p>
            </div>
          )}
          {error && <p className="mt-2 text-xs text-[var(--color-brick)]">{error}</p>}
        </div>
      </div>
    </div>
  );
}
