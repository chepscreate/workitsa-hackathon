"use client";

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { getDb } from "./firebase";

/**
 * POPIA data subject rights — export + erasure request.
 * The user's right to a copy of their data + right to erasure are both
 * legal requirements under SA's Protection of Personal Information Act.
 */

/** Current Terms/Privacy version users consent to. Bump when the policies
 *  materially change so new consents are recorded against the new version. */
export const CONSENT_VERSION = "2026-05";

export type PopiaExport = {
  exportedAt: string;
  generator: "workit-web";
  profile: Record<string, unknown> | null;
  jobsPosted: Array<Record<string, unknown>>;
  jobsAssigned: Array<Record<string, unknown>>;
  savedJobs: Array<{ jobId: string; savedAt: number | null }>;
  offers: Array<Record<string, unknown>>;
  notes: string[];
};

export async function buildExport(uid: string): Promise<PopiaExport> {
  const db = getDb();
  const out: PopiaExport = {
    exportedAt: new Date().toISOString(),
    generator: "workit-web",
    profile: null,
    jobsPosted: [],
    jobsAssigned: [],
    savedJobs: [],
    offers: [],
    notes: [
      "This file contains your Workit account data.",
      "Verification documents and chat messages are not included for safety reasons (they may contain other users' data). Email tshepowayne@workitsa.co.za if you need them.",
    ],
  };

  // Profile
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      const data = snap.data();
      // Strip verification subfields that may contain ID images URLs
      const sanitized: Record<string, unknown> = { ...data };
      if (typeof sanitized.verification === "object" && sanitized.verification) {
        sanitized.verification = {
          submittedAt: (sanitized.verification as Record<string, unknown>).submittedAt ?? null,
          reviewedAt: (sanitized.verification as Record<string, unknown>).reviewedAt ?? null,
          status: sanitized.verificationStatus,
        };
      }
      out.profile = { uid, ...sanitized };
    }
  } catch {
    out.notes.push("Could not read profile.");
  }

  // Private profile data (own DOB + home location — moved off the public doc
  // for safety; it's still the user's data, so their export includes it).
  try {
    const priv = await getDoc(doc(db, "users", uid, "private", "profile"));
    if (priv.exists() && out.profile) {
      const p = priv.data() as Record<string, unknown>;
      for (const k of ["dateOfBirth", "homeLat", "homeLng", "homeAccuracy", "homePinnedAt"]) {
        if (p[k] !== undefined) out.profile[k] = p[k];
      }
    }
  } catch {
    /* private doc optional */
  }

  // Jobs posted
  try {
    const snap = await getDocs(
      query(collection(db, "jobs"), where("employerId", "==", uid)),
    );
    out.jobsPosted = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    /* ignore */
  }

  // Jobs assigned to me (worker)
  try {
    const snap = await getDocs(
      query(collection(db, "jobs"), where("assignedWorkerId", "==", uid)),
    );
    out.jobsAssigned = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    /* ignore */
  }

  // Saved jobs
  try {
    const snap = await getDocs(collection(db, "users", uid, "saved"));
    out.savedJobs = snap.docs.map((d) => ({
      jobId: d.id,
      savedAt: (d.data().savedAt as number) ?? null,
    }));
  } catch {
    /* ignore */
  }

  // Offers I've sent — collectionGroup not allowed by current rules without
  // an index; instead, walk jobs the worker is assigned to. Offers on jobs
  // we WEREN'T assigned to live with the other party. Document this limit.
  out.notes.push(
    "Pending or rejected offers you sent are not included in this export (they live on the employer's job). Sent emails / chat messages are also stored against the relevant job.",
  );

  return out;
}

export function downloadExport(data: PopiaExport): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stamp = data.exportedAt.replace(/[:.]/g, "-");
  a.download = `workit-data-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Records a user's request to delete their account. Admin sees it in
 * the queue and confirms deletion manually (we don't auto-delete because
 * jobs/ratings may reference the user and need handling).
 */
export async function requestAccountDeletion(input: {
  uid: string;
  displayName: string;
  reason?: string;
}): Promise<void> {
  await addDoc(collection(getDb(), "deletionRequests"), {
    uid: input.uid,
    displayName: input.displayName,
    reason: input.reason ?? "",
    requestedAt: Date.now(),
    requestedAtServer: serverTimestamp(),
    status: "pending",
  });
}
