"use client";

import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
  type UploadTask,
} from "firebase/storage";
import { getFirebaseStorage } from "./firebase";

export type UploadProgress = { progress: number; bytesTransferred: number; totalBytes: number };

export type UploadHandle = {
  task: UploadTask;
  cancel: () => boolean;
  promise: Promise<string>; // resolves to downloadURL
  /** The Storage object path (e.g. "verification/{uid}/123-id.jpg"). For
   *  sensitive docs we persist THIS instead of the tokenised download URL —
   *  viewers then mint short-lived signed URLs on demand. */
  path: string;
};

function slugFile(name: string): string {
  return name.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(-80);
}

export type UploadKind = "avatar" | "verification" | "job" | "portfolio";

function pathFor(kind: UploadKind, scopeId: string, file: File): string {
  const stamp = Date.now();
  const safe = slugFile(file.name);
  if (kind === "avatar") return `avatars/${scopeId}/${stamp}-${safe}`;
  if (kind === "verification") return `verification/${scopeId}/${stamp}-${safe}`;
  if (kind === "portfolio") return `portfolio/${scopeId}/${stamp}-${safe}`;
  return `jobs/${scopeId}/${stamp}-${safe}`;
}

export function uploadFile(
  kind: UploadKind,
  scopeId: string,
  file: File,
  onProgress?: (p: UploadProgress) => void,
): UploadHandle {
  const storage = getFirebaseStorage();
  const objectPath = pathFor(kind, scopeId, file);
  const r = ref(storage, objectPath);
  const task = uploadBytesResumable(r, file, {
    contentType: file.type || "application/octet-stream",
  });

  const promise = new Promise<string>((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => {
        if (onProgress) {
          onProgress({
            progress: snap.totalBytes > 0 ? snap.bytesTransferred / snap.totalBytes : 0,
            bytesTransferred: snap.bytesTransferred,
            totalBytes: snap.totalBytes,
          });
        }
      },
      (err) => reject(err),
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          // Belt-and-suspenders: confirm the image actually loads from its URL
          // before handing it back, so a flaky upload can never store a dead link.
          if (!(await verifyImageLoads(url))) {
            reject(new Error("Upload didn't store correctly — please try that file again."));
            return;
          }
          resolve(url);
        } catch (e) {
          reject(e);
        }
      },
    );
  });

  return {
    task,
    cancel: () => task.cancel(),
    promise,
    path: objectPath,
  };
}

/**
 * Confirm an uploaded image actually loads from its download URL before we hand
 * the URL back to the caller. Uses Image() (not fetch) so it works cross-origin
 * without bucket CORS config. Non-image files skip the check (we can't load them
 * this way), so a PDF clearance still goes through normally.
 */
function verifyImageLoads(url: string): Promise<boolean> {
  if (!/\.(png|jpe?g|webp|gif|heic|heif|avif)(\?|$)/i.test(url)) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(false), 10000);
    img.onload = () => {
      clearTimeout(timer);
      resolve(true);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(false);
    };
    img.src = url;
  });
}

export async function deleteByURL(url: string): Promise<void> {
  try {
    const storage = getFirebaseStorage();
    const r = ref(storage, url);
    await deleteObject(r);
  } catch {
    /* swallow — file may already be gone */
  }
}
