"use client";

import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "./firebase";

/**
 * Save / unsave jobs for a worker.
 * Stored at users/{uid}/saved/{jobId} as a minimal stub with the saved-at
 * timestamp. The job content itself is read live from /jobs/{id}.
 */

export async function saveJob(uid: string, jobId: string): Promise<void> {
  await setDoc(doc(getDb(), "users", uid, "saved", jobId), {
    jobId,
    savedAt: Date.now(),
  });
}

export async function unsaveJob(uid: string, jobId: string): Promise<void> {
  await deleteDoc(doc(getDb(), "users", uid, "saved", jobId));
}

export function subscribeSavedJobIds(
  uid: string,
  cb: (ids: Set<string>) => void,
): Unsubscribe {
  return onSnapshot(collection(getDb(), "users", uid, "saved"), (snap) => {
    cb(new Set(snap.docs.map((d) => d.id)));
  });
}
