/**
 * Jarvis core — the shared "brain" used by every Jarvis surface:
 *   - jarvis.ts        (admin dashboard chat, onCall)
 *   - jarvisDigest.ts  (scheduled morning brief)
 *   - jarvisWhatsApp.ts(owner-locked WhatsApp webhook)
 *
 * It holds the Gemini model config, the READ-ONLY Firestore tools, and the
 * agent loop (`runJarvis`). Auth / gating is the responsibility of each surface
 * — this module just runs the agent and never writes data.
 */
import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { GoogleGenAI, Type, type FunctionDeclaration, type Content, type Part } from "@google/genai";
import {
  ACTION_TOOLS,
  ACTION_TOOL_NAMES,
  stageActionTool,
  type PendingAction,
} from "./jarvisActions";

export const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

/** Model powering Jarvis. On postpay billing the daily free-tier cap no longer
 *  applies, so we use gemini-2.5-flash (sharper for ops reasoning + tool use).
 *  (gemini-2.0-flash was retired by Google — 404s if used.) */
const JARVIS_MODEL = "gemini-2.5-flash";

const MAX_TOOL_ROUNDS = 8;

export type ChatTurn = { role: "user" | "assistant"; text: string };

// ---------------------------------------------------------------------------
// Read-only Firestore tools
// ---------------------------------------------------------------------------

function db() {
  return getFirestore();
}

/** ms epoch | Firestore Timestamp -> ISO string (or undefined). */
function iso(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === "number") return new Date(v).toISOString();
  return undefined;
}

type AnyDoc = Record<string, unknown>;

/** Trim a user doc to the fields Jarvis actually needs (keeps tokens down). */
function compactUser(id: string, d: AnyDoc) {
  const verification = (d.verification ?? {}) as AnyDoc;
  return {
    uid: id,
    displayName: d.displayName,
    email: d.email,
    phone: d.phone,
    role: d.role,
    accountStatus: d.accountStatus ?? "approved (legacy)",
    verificationStatus: d.verificationStatus ?? "none",
    backgroundVerified: d.backgroundVerified ?? false,
    suburb: d.suburb,
    city: d.city,
    province: d.province,
    categories: d.categories,
    ratingAvg: d.ratingAvg,
    ratingCount: d.ratingCount,
    jobsCompleted: d.jobsCompleted ?? 0,
    jobsCancelled: d.jobsCancelled ?? 0,
    createdAt: iso(d.createdAt),
    verificationSubmittedAt: iso(verification.submittedAt),
    verificationReviewedAt: iso(verification.reviewedAt),
  };
}

/** Trim a job doc similarly. */
function compactJob(id: string, d: AnyDoc) {
  const dispute = (d.dispute ?? null) as AnyDoc | null;
  return {
    id,
    title: d.title,
    category: d.category,
    status: d.status,
    suburb: d.suburb,
    city: d.city,
    suggestedPrice: d.suggestedPrice,
    agreedPrice: d.agreedPrice,
    paymentMethod: d.paymentMethod,
    urgent: d.urgent ?? false,
    employerName: d.employerName,
    assignedWorkerName: d.assignedWorkerName,
    offerCount: d.offerCount ?? 0,
    createdAt: iso(d.createdAt),
    dispute: dispute
      ? {
          reason: dispute.reason,
          raisedByName: dispute.raisedByName,
          raisedByRole: dispute.raisedByRole,
          description: dispute.description,
          raisedAt: iso(dispute.raisedAt),
        }
      : undefined,
  };
}

async function countOf(q: FirebaseFirestore.Query): Promise<number> {
  try {
    const snap = await q.count().get();
    return snap.data().count;
  } catch (err) {
    logger.warn("jarvis count failed", { err: String(err) });
    return -1; // signal "couldn't read" rather than a misleading 0
  }
}

/** Clamp a model-supplied limit into a sane range. */
function clampLimit(n: unknown, def = 20, max = 50): number {
  const v = typeof n === "number" ? Math.floor(n) : def;
  return Math.max(1, Math.min(max, v || def));
}

const TOOLS: FunctionDeclaration[] = [
  {
    name: "get_metrics",
    description:
      "Get a live snapshot of the whole marketplace: total/worker/employer counts, " +
      "pending account approvals, pending worker verifications, total/open/disputed jobs, " +
      "and open moderation reports. Use this first for any 'how are we doing' question.",
  },
  {
    name: "list_pending_approvals",
    description: "List user accounts awaiting admin approval (accountStatus == 'pending'), newest first.",
    parameters: {
      type: Type.OBJECT,
      properties: { limit: { type: Type.NUMBER, description: "Max rows (1-50, default 20)." } },
    },
  },
  {
    name: "list_pending_verifications",
    description:
      "List workers who have submitted verification docs but haven't been reviewed yet " +
      "(role worker, verificationStatus 'none', docs submitted).",
    parameters: {
      type: Type.OBJECT,
      properties: { limit: { type: Type.NUMBER, description: "Max rows (1-50, default 20)." } },
    },
  },
  {
    name: "list_open_disputes",
    description: "List jobs currently frozen in a dispute (status == 'disputed'), newest first.",
    parameters: {
      type: Type.OBJECT,
      properties: { limit: { type: Type.NUMBER, description: "Max rows (1-50, default 20)." } },
    },
  },
  {
    name: "list_open_reports",
    description: "List community moderation reports that are still open or under review.",
    parameters: {
      type: Type.OBJECT,
      properties: { limit: { type: Type.NUMBER, description: "Max rows (1-50, default 20)." } },
    },
  },
  {
    name: "recent_signups",
    description: "List the most recently created user accounts, newest first.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: { type: Type.NUMBER, description: "Max rows (1-50, default 20)." },
        role: { type: Type.STRING, enum: ["worker", "employer", "admin"], description: "Optional role filter." },
      },
    },
  },
  {
    name: "recent_jobs",
    description: "List the most recently posted jobs, newest first. Optionally filter by status.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: { type: Type.NUMBER, description: "Max rows (1-50, default 20)." },
        status: {
          type: Type.STRING,
          enum: ["open", "assigned", "in_progress", "completed", "confirmed", "disputed", "cancelled"],
          description: "Optional job status filter.",
        },
      },
    },
  },
  {
    name: "search_users",
    description:
      "Find users by exact email (if the query contains '@') or by display-name prefix " +
      "(case-sensitive prefix match). Optionally filter by role.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: "Email address, or a name prefix." },
        role: { type: Type.STRING, enum: ["worker", "employer", "admin"], description: "Optional role filter." },
        limit: { type: Type.NUMBER, description: "Max rows (1-50, default 20)." },
      },
      required: ["query"],
    },
  },
  {
    name: "get_user",
    description: "Fetch the full compact record for one user by their uid.",
    parameters: {
      type: Type.OBJECT,
      properties: { uid: { type: Type.STRING, description: "The user's uid." } },
      required: ["uid"],
    },
  },
];

/** Execute a read-only tool and return a plain JSON-serialisable result. */
async function runTool(name: string, input: AnyDoc): Promise<unknown> {
  const users = db().collection("users");
  const jobs = db().collection("jobs");

  switch (name) {
    case "get_metrics": {
      const [
        usersTotal,
        workers,
        employers,
        pendingApprovals,
        pendingVerifications,
        jobsTotal,
        openJobs,
        disputedJobs,
        reportsOpen,
        reportsReviewing,
      ] = await Promise.all([
        countOf(users),
        countOf(users.where("role", "==", "worker")),
        countOf(users.where("role", "==", "employer")),
        countOf(users.where("accountStatus", "==", "pending")),
        countOf(
          users
            .where("role", "==", "worker")
            .where("verificationStatus", "==", "none")
            .where("verification.submittedAt", ">", 0),
        ),
        countOf(jobs),
        countOf(jobs.where("status", "==", "open")),
        countOf(jobs.where("status", "==", "disputed")),
        countOf(db().collection("reports").where("status", "==", "open")),
        countOf(db().collection("reports").where("status", "==", "reviewing")),
      ]);
      return {
        generatedAt: new Date().toISOString(),
        users: { total: usersTotal, workers, employers, pendingApprovals, pendingVerifications },
        jobs: { total: jobsTotal, open: openJobs, disputed: disputedJobs },
        moderation: { openReports: reportsOpen + reportsReviewing },
        note: "A value of -1 means that count could not be read (e.g. an index is still building).",
      };
    }

    case "list_pending_approvals": {
      const snap = await users
        .where("accountStatus", "==", "pending")
        .orderBy("createdAt", "desc")
        .limit(clampLimit(input.limit))
        .get();
      return snap.docs.map((d) => compactUser(d.id, d.data()));
    }

    case "list_pending_verifications": {
      const snap = await users
        .where("role", "==", "worker")
        .where("verificationStatus", "==", "none")
        .where("verification.submittedAt", ">", 0)
        .orderBy("verification.submittedAt", "desc")
        .limit(clampLimit(input.limit))
        .get();
      return snap.docs.map((d) => compactUser(d.id, d.data()));
    }

    case "list_open_disputes": {
      const snap = await jobs
        .where("status", "==", "disputed")
        .orderBy("updatedAt", "desc")
        .limit(clampLimit(input.limit))
        .get();
      return snap.docs.map((d) => compactJob(d.id, d.data()));
    }

    case "list_open_reports": {
      const snap = await db()
        .collection("reports")
        .where("status", "in", ["open", "reviewing"])
        .orderBy("createdAt", "desc")
        .limit(clampLimit(input.limit))
        .get();
      return snap.docs.map((d) => {
        const x = d.data() as AnyDoc;
        return {
          id: d.id,
          reason: x.reason,
          targetType: x.targetType,
          targetId: x.targetId,
          reporterName: x.reporterName,
          description: x.description,
          status: x.status,
          createdAt: iso(x.createdAt),
        };
      });
    }

    case "recent_signups": {
      let q: FirebaseFirestore.Query = users;
      if (typeof input.role === "string") q = q.where("role", "==", input.role);
      const snap = await q.orderBy("createdAt", "desc").limit(clampLimit(input.limit)).get();
      return snap.docs.map((d) => compactUser(d.id, d.data()));
    }

    case "recent_jobs": {
      let q: FirebaseFirestore.Query = jobs;
      if (typeof input.status === "string") q = q.where("status", "==", input.status);
      const snap = await q.orderBy("createdAt", "desc").limit(clampLimit(input.limit)).get();
      return snap.docs.map((d) => compactJob(d.id, d.data()));
    }

    case "search_users": {
      const qStr = String(input.query ?? "").trim();
      if (!qStr) return { error: "Empty query." };
      const limit = clampLimit(input.limit);
      const role = typeof input.role === "string" ? input.role : undefined;

      // Combining a text predicate with a role equality would need extra
      // composite indexes, so we query on text only and filter role in memory
      // (these result sets are small).
      let snap;
      if (qStr.includes("@")) {
        snap = await users.where("email", "==", qStr.toLowerCase()).limit(limit).get();
        let rows = snap.docs.map((d) => compactUser(d.id, d.data()));
        if (role) rows = rows.filter((u) => u.role === role);
        return rows;
      }
      // Display-name prefix range query ( = highest code point).
      snap = await users
        .orderBy("displayName")
        .startAt(qStr)
        .endAt(qStr + "")
        .limit(limit)
        .get();
      let rows = snap.docs.map((d) => compactUser(d.id, d.data()));
      if (role) rows = rows.filter((u) => u.role === role);
      return rows;
    }

    case "get_user": {
      const uid = String(input.uid ?? "").trim();
      if (!uid) return { error: "Missing uid." };
      const doc = await users.doc(uid).get();
      if (!doc.exists) return { error: "No user with that uid." };
      return compactUser(doc.id, doc.data() as AnyDoc);
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ---------------------------------------------------------------------------
// Agent loop
// ---------------------------------------------------------------------------

function systemPrompt(adminName: string, allowActions: boolean): string {
  const today = new Date().toISOString().slice(0, 10);
  const limits = allowActions
    ? [
        `ACTIONS: you can take a few actions — approve/reject/suspend/reinstate an account, approve`,
        `(optionally with Gold badge) or reject a worker's verification, and resolve a disputed job.`,
        `These work in two steps: you STAGE the action with the matching propose_* tool, then the`,
        `founder must explicitly CONFIRM it before anything changes. After staging, clearly state what`,
        `you've staged and ask them to confirm — NEVER say it's done until you're told it's confirmed.`,
        `Look up the target's uid (or job id) with the read tools first. For disputes, you must have a`,
        `resolver note of at least 5 characters; ask for one if it's missing. You still cannot delete`,
        `anything or send messages. Do not give legal or financial advice.`,
      ]
    : [
        `LIMITS: you are READ-ONLY. You cannot approve, reject, suspend, verify, message, or delete`,
        `anything. If asked to act, explain what you'd do and tell the founder where in /admin to do it`,
        `(e.g. the Approvals, Verification, or Disputes tab). Do not give legal or financial advice.`,
      ];
  return [
    `You are Jarvis, the private operations assistant for Workit — a South African`,
    `two-sided gig-work marketplace (workitsa.co.za). You report only to ${adminName || "the founder"},`,
    `who is the sole admin. Today is ${today}.`,
    ``,
    `Workit connects employers who post small jobs with workers who do them, mostly in Gauteng.`,
    `Workers get verified (SA ID, selfie, address, skill proof). Payment is cash or EFT on completion`,
    `— Workit takes no commission during launch. Money is always in South African Rand (R).`,
    ``,
    `YOUR JOB: answer questions about the live state of the marketplace and surface what needs`,
    `the founder's attention — pending approvals, workers waiting on verification, open disputes,`,
    `moderation reports, growth and activity. Use the tools to get real numbers; never invent figures.`,
    `If a metric comes back as -1, say it couldn't be read rather than reporting it as zero.`,
    ``,
    `STYLE: concise and direct. Lead with the answer. Use short bullet lists for queues. Format money`,
    `as "R 250". When you list people or jobs, give names and the one or two facts that matter, not raw`,
    `dumps. Proactively flag anything urgent (open disputes, CSAM/illegal reports, a backlog building up).`,
    ``,
    ...limits,
  ].join("\n");
}

export type JarvisResult = { reply: string; pendingAction?: PendingAction };

const ACTION_NAME_SET = new Set<string>(ACTION_TOOL_NAMES);

/**
 * Run the Jarvis agent for one user message.
 * Stateless apart from the `history` you pass in. With `allowActions`, the model
 * may STAGE an action (never executes here) — the staged action is returned as
 * `pendingAction` for the caller to confirm + execute separately.
 */
export async function runJarvis(opts: {
  apiKey: string;
  message: string;
  history?: ChatTurn[];
  adminName?: string;
  allowActions?: boolean;
}): Promise<JarvisResult> {
  const ai = new GoogleGenAI({ apiKey: opts.apiKey });
  const allowActions = opts.allowActions ?? false;

  const contents: Content[] = [
    ...(opts.history ?? []).map(
      (t): Content => ({
        role: t.role === "assistant" ? "model" : "user",
        parts: [{ text: t.text }],
      }),
    ),
    { role: "user", parts: [{ text: opts.message }] },
  ];

  const config = {
    systemInstruction: systemPrompt(opts.adminName ?? "", allowActions),
    tools: [{ functionDeclarations: allowActions ? [...TOOLS, ...ACTION_TOOLS] : TOOLS }],
    temperature: 0.4,
  };

  let pendingAction: PendingAction | undefined;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await ai.models.generateContent({ model: JARVIS_MODEL, contents, config });

    const calls = response.functionCalls ?? [];
    if (calls.length === 0) {
      return { reply: (response.text ?? "").trim() || "(no answer)", pendingAction };
    }

    const modelContent = response.candidates?.[0]?.content;
    if (modelContent) contents.push(modelContent);

    const parts: Part[] = [];
    for (const call of calls) {
      const callName = String(call.name);
      let result: unknown;
      try {
        if (allowActions && ACTION_NAME_SET.has(callName)) {
          const staged = await stageActionTool(callName, (call.args ?? {}) as AnyDoc);
          result = staged.result;
          if (staged.pending) pendingAction = staged.pending; // bubble up the latest staged action
        } else {
          result = await runTool(callName, (call.args ?? {}) as AnyDoc);
        }
      } catch (err) {
        logger.error("jarvis tool error", { tool: callName, err: String(err) });
        result = { error: "Tool failed to run." };
      }
      parts.push({
        functionResponse: {
          ...(call.id ? { id: call.id } : {}),
          name: callName,
          response: { result },
        },
      });
    }
    contents.push({ role: "user", parts });
  }

  return {
    reply: "I gathered a lot of data but couldn't wrap up in time — try asking something more specific.",
    pendingAction,
  };
}
