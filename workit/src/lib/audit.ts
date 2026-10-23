"use client";

import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "./firebase";

export type AuditAction =
  | "account_approve"
  | "account_reject"
  | "account_suspend"
  | "account_pending"
  | "verification_approve"
  | "verification_reject"
  | "verification_pending"
  | "verification_request_changes"
  | "user_email_sent"
  | "welcome_email_sent"
  | "business_verify_approve"
  | "business_verify_reject"
  | "dispute_resolve_force_completed"
  | "dispute_resolve_cancelled_no_fault"
  | "dispute_resolve_cancelled_with_warning"
  | "dispute_resolve_dismissed"
  | "bulk_action"
  | "moderation_warn"
  | "moderation_remove_content"
  | "moderation_dismiss"
  | "moderation_resolve_other"
  | "account_erased"
  | "broadcast_sent";

export type AuditEntry = {
  id: string;
  adminUid: string;
  adminName: string;
  action: AuditAction;
  targetUid?: string;
  targetName?: string;
  targetJobId?: string;
  note?: string;
  meta?: Record<string, unknown>;
  at: number;
};

export async function logAudit(input: Omit<AuditEntry, "id" | "at">): Promise<void> {
  try {
    await addDoc(collection(getDb(), "auditLog"), {
      ...input,
      at: Date.now(),
      atServer: serverTimestamp(),
    });
  } catch {
    /* never fail the user action because logging failed */
  }
}

export function subscribeAuditLog(
  max: number,
  cb: (entries: AuditEntry[]) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "auditLog"),
    orderBy("at", "desc"),
    limit(max),
  );
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditEntry, "id">) }))),
  );
}

export function describeAction(a: AuditAction): string {
  return {
    account_approve: "approved account",
    account_reject: "rejected account",
    account_suspend: "suspended account",
    account_pending: "moved account to pending",
    verification_approve: "approved verification",
    verification_reject: "rejected verification",
    verification_pending: "moved verification to pending",
    verification_request_changes: "requested verification changes",
    user_email_sent: "emailed a user",
    welcome_email_sent: "sent the welcome manual",
    business_verify_approve: "verified a business",
    business_verify_reject: "rejected business verification",
    dispute_resolve_force_completed: "resolved dispute · force completed",
    dispute_resolve_cancelled_no_fault: "resolved dispute · cancelled (no fault)",
    dispute_resolve_cancelled_with_warning: "resolved dispute · cancelled (with warning)",
    dispute_resolve_dismissed: "dismissed dispute · resumed job",
    bulk_action: "performed a bulk action",
    moderation_warn: "warned a user (moderation)",
    moderation_remove_content: "removed content (moderation)",
    moderation_dismiss: "dismissed a report",
    moderation_resolve_other: "resolved a moderation report",
    account_erased: "erased an account (POPIA deletion request)",
    broadcast_sent: "sent a broadcast notification",
    // Server-written actions (Cloud Functions write these with the Admin SDK,
    // so they can predate or postdate this client map — see fallback below).
    marketingRunNow: "triggered a marketing run (send/post now)",
    role_changed: "changed an admin role",
    role_removed: "removed an admin role",
  }[a] ??
    // Unknown/future action — show something readable instead of a blank row.
    `did ${String(a).replace(/[_-]/g, " ")}`;
}
