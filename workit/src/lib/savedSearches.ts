"use client";

/**
 * Per-worker saved searches with live alerts.
 *
 * Stored as a subcollection under each user (users/{uid}/searches/{searchId})
 * so the security rule is trivial: owner only.
 *
 * Notifications fire client-side via NotificationsContext — when a new open
 * job lands and matches any saved search, a toast pops. No Cloud Function
 * needed for v1.
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "./firebase";
import type { Job, SavedSearch, SavedSearchRadius, CategoryId } from "./types";

function colRef(uid: string) {
  return collection(getDb(), "users", uid, "searches");
}

export async function saveSearch(
  uid: string,
  input: {
    category: CategoryId | "all";
    keyword?: string;
    radiusKm: SavedSearchRadius;
    name?: string;
  },
): Promise<string> {
  const ref = await addDoc(colRef(uid), {
    category: input.category,
    radiusKm: input.radiusKm,
    ...(input.keyword?.trim() ? { keyword: input.keyword.trim() } : {}),
    ...(input.name?.trim() ? { name: input.name.trim() } : {}),
    createdAt: Date.now(),
    createdAtServer: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteSavedSearch(uid: string, searchId: string): Promise<void> {
  await deleteDoc(doc(getDb(), "users", uid, "searches", searchId));
}

export async function bumpLastNotified(
  uid: string,
  searchId: string,
  jobId: string,
): Promise<void> {
  await updateDoc(doc(getDb(), "users", uid, "searches", searchId), {
    lastNotifiedJobId: jobId,
  });
}

export function subscribeSavedSearches(
  uid: string,
  cb: (list: SavedSearch[]) => void,
): Unsubscribe {
  const q = query(colRef(uid), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) =>
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<SavedSearch, "id">),
      })),
    ),
  );
}

/** Pure helper — given a saved search + a job + the worker's home, does it match? */
export function matchesSavedSearch(
  s: SavedSearch,
  job: Job,
  home: { lat: number; lng: number } | null,
): boolean {
  if (s.category !== "all" && job.category !== s.category) return false;
  if (s.keyword) {
    const q = s.keyword.toLowerCase();
    const blob = `${job.title} ${job.description} ${job.suburb}`.toLowerCase();
    if (!blob.includes(q)) return false;
  }
  if (s.radiusKm !== "all" && home && typeof job.lat === "number" && typeof job.lng === "number") {
    const km = haversine(home.lat, home.lng, job.lat, job.lng);
    if (km > s.radiusKm) return false;
  }
  return true;
}

/** Inline haversine — same formula as lib/geo but kept local to avoid the import cycle. */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
