/**
 * Jarvis Phase-2 actions — the "hands".
 *
 * SAFETY MODEL
 *  - The model can only *stage* an action (validate + summarise). Staging never
 *    writes anything.
 *  - Execution happens ONLY after an explicit human confirmation, through
 *    executeAction() — called by the dashboard confirm callable or the WhatsApp
 *    "yes" path. Both re-verify admin identity and re-read live state first.
 *  - Every execution mirrors exactly what the /admin UI does and writes an
 *    entry to `auditLog` (tagged via:"jarvis"). No deletes, ever.
 */
import { logger } from "firebase-functions";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { Type, type FunctionDeclaration } from "@google/genai";

type AnyDoc = Record<string, unknown>;

export type JarvisActionType =
  | "account_approve"
  | "account_reject"
  | "account_suspend"
  | "account_reinstate"
  | "verification_approve"
  | "verification_approve_gold"
  | "verification_reject"
  | "dispute_force_completed"
  | "dispute_cancelled_no_fault"
  | "dispute_cancelled_with_warning"
  | "dispute_dismissed";

/** A validated, not-yet-executed action awaiting human confirmation. */
export type PendingAction = {
  type: JarvisActionType;
  targetUid?: string;
  targetName?: string;
  targetJobId?: string;
  note?: string; // visible to the user / both parties
  summary: string; // one-line human description for the confirm prompt
};

function db() {
  return getFirestore();
}

// ---------------------------------------------------------------------------
// Tool declarations (the model stages via these; they never write)
// ---------------------------------------------------------------------------

export const ACTION_TOOL_NAMES = [
  "propose_account_action",
  "propose_verification_action",
  "propose_dispute_resolution",
] as const;

export const ACTION_TOOLS: FunctionDeclaration[] = [
  {
    name: "propose_account_action",
    description:
      "STAGE an account decision for the founder to confirm. This does NOT take effect — it only " +
      "prepares the action; the founder must explicitly confirm before anything changes. Use for " +
      "approving, rejecting, suspending, or reinstating a user's account. Always tell the founder " +
      "what you've staged and that they must confirm.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        uid: { type: Type.STRING, description: "The target user's uid (use search_users/get_user to find it)." },
        decision: {
          type: Type.STRING,
          enum: ["approve", "reject", "suspend", "reinstate"],
          description: "What to do with the account.",
        },
        note: { type: Type.STRING, description: "Optional note shown to the user." },
      },
      required: ["uid", "decision"],
    },
  },
  {
    name: "propose_verification_action",
    description:
      "STAGE a worker verification decision for confirmation. Does NOT take effect until the founder " +
      "confirms. 'approve' marks them Verified; 'approve_gold' also grants the Gold background-verified " +
      "badge (only if a police clearance is on file); 'reject' rejects the documents.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        uid: { type: Type.STRING, description: "The worker's uid." },
        decision: { type: Type.STRING, enum: ["approve", "approve_gold", "reject"] },
        note: { type: Type.STRING, description: "Optional note shown to the worker." },
      },
      required: ["uid", "decision"],
    },
  },
  {
    name: "propose_dispute_resolution",
    description:
      "STAGE a resolution for a disputed job for confirmation. Does NOT take effect until the founder " +
      "confirms. A resolver note (at least 5 characters, shown to BOTH parties) is required. " +
      "'force_completed' marks the job confirmed and unlocks ratings; 'cancelled_no_fault' and " +
      "'cancelled_with_warning' cancel it; 'dismissed' resumes the job at its previous status.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        jobId: { type: Type.STRING, description: "The disputed job's id." },
        resolution: {
          type: Type.STRING,
          enum: ["force_completed", "cancelled_no_fault", "cancelled_with_warning", "dismissed"],
        },
        note: { type: Type.STRING, description: "Resolver note shown to both parties (min 5 chars)." },
      },
      required: ["jobId", "resolution", "note"],
    },
  },
];

// ---------------------------------------------------------------------------
// Staging (read-only validation → PendingAction)
// ---------------------------------------------------------------------------

const ACCOUNT_TYPE: Record<string, JarvisActionType> = {
  approve: "account_approve",
  reject: "account_reject",
  suspend: "account_suspend",
  reinstate: "account_reinstate",
};
const VERIF_TYPE: Record<string, JarvisActionType> = {
  approve: "verification_approve",
  approve_gold: "verification_approve_gold",
  reject: "verification_reject",
};
const DISPUTE_TYPE: Record<string, JarvisActionType> = {
  force_completed: "dispute_force_completed",
  cancelled_no_fault: "dispute_cancelled_no_fault",
  cancelled_with_warning: "dispute_cancelled_with_warning",
  dismissed: "dispute_dismissed",
};

type StageResult = { result: unknown; pending?: PendingAction };

/** Validate a staging tool call and return a PendingAction (no writes). */
export async function stageActionTool(name: string, input: AnyDoc): Promise<StageResult> {
  try {
    if (name === "propose_account_action") {
      const uid = String(input.uid ?? "").trim();
      const decision = String(input.decision ?? "");
      const note = input.note ? String(input.note) : undefined;
      if (!uid || !ACCOUNT_TYPE[decision]) return { result: { error: "Need a uid and a valid decision." } };
      const snap = await db().collection("users").doc(uid).get();
      if (!snap.exists) return { result: { error: "No user with that uid." } };
      const u = snap.data() as AnyDoc;
      if (u.role === "admin") return { result: { error: "Refusing to change an admin account." } };
      const targetName = String(u.displayName ?? "this user");
      const current = String(u.accountStatus ?? "approved (legacy)");
      const summary = `${verb(decision)} ${targetName}'s account (currently ${current}, role ${u.role})${
        note ? ` — note: "${note}"` : ""
      }`;
      const pending: PendingAction = {
        type: ACCOUNT_TYPE[decision],
        targetUid: uid,
        targetName,
        note,
        summary,
      };
      return { result: { staged: true, requiresConfirmation: true, summary }, pending };
    }

    if (name === "propose_verification_action") {
      const uid = String(input.uid ?? "").trim();
      const decision = String(input.decision ?? "");
      const note = input.note ? String(input.note) : undefined;
      if (!uid || !VERIF_TYPE[decision]) return { result: { error: "Need a uid and a valid decision." } };
      const snap = await db().collection("users").doc(uid).get();
      if (!snap.exists) return { result: { error: "No user with that uid." } };
      const u = snap.data() as AnyDoc;
      if (u.role !== "worker") return { result: { error: "Verification only applies to workers." } };
      const verification = (u.verification ?? {}) as AnyDoc;
      if (decision === "approve_gold" && !verification.policeClearanceURL) {
        return {
          result: {
            error: "Can't grant the Gold badge: no police clearance on file. Use plain approve instead.",
          },
        };
      }
      const targetName = String(u.displayName ?? "this worker");
      const summary = `${
        decision === "reject"
          ? "Reject verification for"
          : decision === "approve_gold"
            ? "Approve verification + Gold badge for"
            : "Approve verification for"
      } ${targetName}${note ? ` — note: "${note}"` : ""}`;
      const pending: PendingAction = {
        type: VERIF_TYPE[decision],
        targetUid: uid,
        targetName,
        note,
        summary,
      };
      return { result: { staged: true, requiresConfirmation: true, summary }, pending };
    }

    if (name === "propose_dispute_resolution") {
      const jobId = String(input.jobId ?? "").trim();
      const resolution = String(input.resolution ?? "");
      const note = String(input.note ?? "").trim();
      if (!jobId || !DISPUTE_TYPE[resolution]) return { result: { error: "Need a jobId and valid resolution." } };
      if (note.length < 5) {
        return { result: { error: "A resolver note of at least 5 characters is required — ask the founder for one." } };
      }
      const snap = await db().collection("jobs").doc(jobId).get();
      if (!snap.exists) return { result: { error: "No job with that id." } };
      const j = snap.data() as AnyDoc;
      if (j.status !== "disputed") return { result: { error: `That job isn't in dispute (status: ${j.status}).` } };
      const targetName = String(j.title ?? "this job");
      const summary = `Resolve dispute on "${targetName}" → ${readableResolution(resolution)} — note: "${note}"`;
      const pending: PendingAction = {
        type: DISPUTE_TYPE[resolution],
        targetJobId: jobId,
        targetName,
        note,
        summary,
      };
      return { result: { staged: true, requiresConfirmation: true, summary }, pending };
    }

    return { result: { error: `Unknown action tool: ${name}` } };
  } catch (err) {
    logger.error("stageActionTool failed", { name, err: String(err) });
    return { result: { error: "Couldn't stage that action." } };
  }
}

// ---------------------------------------------------------------------------
// Execution (writes + audit) — only ever called after human confirmation
// ---------------------------------------------------------------------------

export type ExecResult = { ok: boolean; message: string };

async function writeAudit(entry: AnyDoc): Promise<void> {
  try {
    await db().collection("auditLog").add({
      ...entry,
      via: "jarvis",
      at: Date.now(),
      atServer: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    logger.warn("jarvis audit write failed", { err: String(err) });
  }
}

/**
 * Execute a previously-staged action. Re-reads live state and re-validates, so
 * a stale or now-invalid action fails cleanly instead of corrupting data.
 */
export async function executeAction(
  p: PendingAction,
  admin: { uid: string; name: string },
): Promise<ExecResult> {
  const now = Date.now();

  // ---- account actions ----
  if (p.type.startsWith("account_")) {
    const uid = p.targetUid;
    if (!uid) return { ok: false, message: "Missing target user." };
    const ref = db().collection("users").doc(uid);
    const snap = await ref.get();
    if (!snap.exists) return { ok: false, message: "That user no longer exists." };
    const u = snap.data() as AnyDoc;
    if (u.role === "admin") return { ok: false, message: "Refusing to change an admin account." };

    const newStatus =
      p.type === "account_reject" ? "rejected" : p.type === "account_suspend" ? "suspended" : "approved"; // approve + reinstate
    const patch: AnyDoc = { accountStatus: newStatus, accountReviewedAt: now };
    if (p.note) patch.accountReviewerNote = p.note;
    if (u.role === "worker") {
      if (newStatus === "approved") patch.verificationStatus = "approved";
      else if (newStatus === "rejected") patch.verificationStatus = "rejected";
    }
    await ref.update(patch);
    const auditAction =
      p.type === "account_reject"
        ? "account_reject"
        : p.type === "account_suspend"
          ? "account_suspend"
          : "account_approve";
    await writeAudit({
      adminUid: admin.uid,
      adminName: admin.name,
      action: auditAction,
      targetUid: uid,
      targetName: p.targetName,
      note: p.note,
      meta: p.type === "account_reinstate" ? { reinstated: true } : undefined,
    });
    return { ok: true, message: `Done — ${p.targetName}'s account is now ${newStatus}.` };
  }

  // ---- verification actions ----
  if (p.type.startsWith("verification_")) {
    const uid = p.targetUid;
    if (!uid) return { ok: false, message: "Missing target worker." };
    const ref = db().collection("users").doc(uid);
    const snap = await ref.get();
    if (!snap.exists) return { ok: false, message: "That worker no longer exists." };
    const u = snap.data() as AnyDoc;
    if (u.role !== "worker") return { ok: false, message: "That user isn't a worker." };

    const newStatus = p.type === "verification_reject" ? "rejected" : "approved";
    const patch: AnyDoc = { verificationStatus: newStatus, "verification.reviewedAt": now };
    if (p.type === "verification_approve_gold") {
      if (!((u.verification ?? {}) as AnyDoc).policeClearanceURL) {
        return { ok: false, message: "No police clearance on file — can't grant the Gold badge." };
      }
      patch.backgroundVerified = true;
    }
    if (p.note) patch["verification.reviewerNote"] = p.note;
    await ref.update(patch);
    await writeAudit({
      adminUid: admin.uid,
      adminName: admin.name,
      action: newStatus === "approved" ? "verification_approve" : "verification_reject",
      targetUid: uid,
      targetName: p.targetName,
      note: p.note,
      meta: p.type === "verification_approve_gold" ? { backgroundVerified: true } : undefined,
    });
    return {
      ok: true,
      message: `Done — ${p.targetName}'s verification is now ${newStatus}${
        p.type === "verification_approve_gold" ? " with the Gold badge" : ""
      }.`,
    };
  }

  // ---- dispute resolutions ----
  if (p.type.startsWith("dispute_")) {
    const jobId = p.targetJobId;
    if (!jobId) return { ok: false, message: "Missing target job." };
    const ref = db().collection("jobs").doc(jobId);
    const snap = await ref.get();
    if (!snap.exists) return { ok: false, message: "That job no longer exists." };
    const j = snap.data() as AnyDoc;
    if (j.status !== "disputed") return { ok: false, message: `That job is no longer in dispute (now ${j.status}).` };
    if (!p.note || p.note.trim().length < 5) return { ok: false, message: "A resolver note is required." };

    const resolution = p.type.replace("dispute_", "") as
      | "force_completed"
      | "cancelled_no_fault"
      | "cancelled_with_warning"
      | "dismissed";
    const dispute = (j.dispute ?? {}) as AnyDoc;
    const newStatus =
      resolution === "force_completed"
        ? "confirmed"
        : resolution === "dismissed"
          ? String(dispute.previousStatus ?? "in_progress")
          : "cancelled";

    await ref.update({
      status: newStatus,
      "dispute.resolution": resolution,
      "dispute.resolverNote": p.note.trim(),
      "dispute.resolvedAt": now,
      updatedAt: now,
    });
    await writeAudit({
      adminUid: admin.uid,
      adminName: admin.name,
      action: `dispute_resolve_${resolution}`,
      targetJobId: jobId,
      targetName: p.targetName,
      note: p.note.trim(),
      meta: { restoredTo: newStatus },
    });
    return { ok: true, message: `Done — dispute on "${p.targetName}" resolved (${readableResolution(resolution)}).` };
  }

  return { ok: false, message: "Unknown action type." };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function verb(decision: string): string {
  return { approve: "Approve", reject: "Reject", suspend: "Suspend", reinstate: "Reinstate" }[decision] ?? decision;
}

function readableResolution(r: string): string {
  return (
    {
      force_completed: "force-complete (job confirmed, ratings unlocked)",
      cancelled_no_fault: "cancel (no fault)",
      cancelled_with_warning: "cancel with a warning",
      dismissed: "dismiss and resume the job",
    }[r] ?? r
  );
}
