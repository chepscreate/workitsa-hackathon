"use client";

import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getDb, getFunctionsInstance } from "./firebase";
import { track } from "./analytics";

/** One confirmed job as published on a Work Record (no employer identifiers). */
export type WorkRecordJobLine = {
  title: string;
  category: string;
  area: string;
  at: number;
  price: number;
  stars?: number;
  paymentConfirmed: boolean;
};

/**
 * A worker's shareable proof-of-work certificate, aggregated server-side by
 * the generateWorkRecord callable into workRecords/{token}. The token doc id
 * is the bearer secret — anyone with the link can verify the record at
 * /record?t={token}. See functions/src/workRecord.ts.
 */
export type WorkRecord = {
  uid: string;
  displayName: string;
  photoURL?: string;
  memberSince: number;
  generatedAt: number;
  verified: boolean;
  backgroundVerified: boolean;
  ratingAvg: number;
  ratingCount: number;
  paymentsConfirmed: number;
  totalJobs: number;
  totalEarned: number;
  firstJobAt?: number;
  lastJobAt?: number;
  categories: { id: string; count: number; earned: number }[];
  jobs: WorkRecordJobLine[];
};

/** (Re)generate the caller's Work Record; returns the share token. `rotate`
 *  mints a fresh token, killing links shared before. */
export async function generateWorkRecord(rotate = false): Promise<string> {
  const fn = httpsCallable<{ rotate?: boolean }, { token: string }>(
    getFunctionsInstance(),
    "generateWorkRecord",
  );
  const res = await fn(rotate ? { rotate: true } : {});
  track(rotate ? "work_record_rotated" : "work_record_generated");
  return res.data.token;
}

/** Fetch a Work Record by its share token (public — no auth needed). */
export async function getWorkRecord(token: string): Promise<WorkRecord | null> {
  const snap = await getDoc(doc(getDb(), "workRecords", token));
  if (!snap.exists()) return null;
  return snap.data() as WorkRecord;
}
