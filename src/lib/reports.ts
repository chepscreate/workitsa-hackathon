"use client";

import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "./firebase";
import type {
  Report,
  ReportReason,
  ReportResolution,
  ReportStatus,
  ReportTargetType,
  UserProfile,
} from "./types";

const COL = "reports";

export async function createReport(input: {
  reporter: UserProfile;
  targetType: ReportTargetType;
  targetId: string;
  targetParentId?: string;
  targetUserUid?: string;
  reason: ReportReason;
  description: string;
}): Promise<string> {
  const ref = await addDoc(collection(getDb(), COL), {
    reporterId: input.reporter.uid,
    reporterName: input.reporter.displayName,
    targetType: input.targetType,
    targetId: input.targetId,
    ...(input.targetParentId ? { targetParentId: input.targetParentId } : {}),
    ...(input.targetUserUid ? { targetUserUid: input.targetUserUid } : {}),
    reason: input.reason,
    description: input.description,
    status: "open" satisfies ReportStatus,
    createdAt: Date.now(),
    createdAtServer: serverTimestamp(),
  });
  return ref.id;
}

export function subscribeOpenReports(
  cb: (reports: Report[]) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), COL),
    where("status", "in", ["open", "reviewing"]),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Report, "id">) }))),
  );
}

/** Resolved + dismissed reports for the History tab. Capped client-side. */
export function subscribeResolvedReports(
  cb: (reports: Report[]) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), COL),
    where("status", "in", ["resolved", "dismissed"]),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(q, (snap) =>
    cb(
      snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Report, "id">) }))
        .slice(0, 200),
    ),
  );
}

export async function resolveReport(
  reportId: string,
  resolverUid: string,
  resolution: ReportResolution,
  note?: string,
): Promise<void> {
  await updateDoc(doc(getDb(), COL, reportId), {
    status: "resolved" satisfies ReportStatus,
    resolution,
    resolvedAt: Date.now(),
    resolverUid,
    ...(note ? { resolverNote: note } : {}),
  });
}

export async function dismissReport(
  reportId: string,
  resolverUid: string,
  note?: string,
): Promise<void> {
  await updateDoc(doc(getDb(), COL, reportId), {
    status: "dismissed" satisfies ReportStatus,
    resolvedAt: Date.now(),
    resolverUid,
    ...(note ? { resolverNote: note } : {}),
  });
}

/** Whether the current user has already reported this target — for client-side
 *  "you reported this" hint. One-shot read, not realtime. */
export async function hasReported(
  reporterUid: string,
  targetType: ReportTargetType,
  targetId: string,
): Promise<boolean> {
  const snap = await getDocs(
    query(
      collection(getDb(), COL),
      where("reporterId", "==", reporterUid),
      where("targetType", "==", targetType),
      where("targetId", "==", targetId),
    ),
  );
  return !snap.empty;
}
