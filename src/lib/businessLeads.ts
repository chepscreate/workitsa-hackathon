"use client";

import {
  addDoc,
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "./firebase";
import type { BusinessLead } from "./types";

/**
 * A worker expresses interest in a business. Stored at
 * users/{businessUid}/leads/{leadId}. A Cloud Function (onBusinessLeadCreated)
 * emails + pushes the business.
 */
export async function createBusinessLead(input: {
  businessUid: string;
  workerUid: string;
  workerName: string;
  workerPhotoURL?: string;
  message?: string;
}): Promise<void> {
  await addDoc(collection(getDb(), "users", input.businessUid, "leads"), {
    businessUid: input.businessUid,
    workerUid: input.workerUid,
    workerName: input.workerName,
    ...(input.workerPhotoURL ? { workerPhotoURL: input.workerPhotoURL } : {}),
    ...(input.message ? { message: input.message } : {}),
    status: "new",
    createdAt: Date.now(),
  });
}

/** Has this worker already expressed interest in this business? (rules allow a
 *  worker to read only their own leads, so this query is scoped to workerUid.) */
export async function hasExpressedInterest(businessUid: string, workerUid: string): Promise<boolean> {
  const snap = await getDocs(
    query(
      collection(getDb(), "users", businessUid, "leads"),
      where("workerUid", "==", workerUid),
      limit(1),
    ),
  );
  return !snap.empty;
}

/** Live stream of a business's own leads (newest first). */
export function subscribeBusinessLeads(
  businessUid: string,
  cb: (leads: BusinessLead[]) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(getDb(), "users", businessUid, "leads"), orderBy("createdAt", "desc")),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BusinessLead, "id">) }))),
  );
}
