/**
 * Firestore security-rules regression tests.
 *
 * The rules are the only wall between the public internet and users' PII
 * (ID numbers, home coordinates, verification documents) — these tests make
 * a bad rules edit fail BEFORE deploy instead of silently shipping.
 *
 * Run with:  npm run test:rules
 * (wraps `firebase emulators:exec --only firestore "vitest run"` — needs
 * Java for the emulator; no production data is touched.)
 *
 * Pattern: seed state with security rules disabled, then assert what each
 * actor (anonymous / pending / approved worker / employer / admin) can and
 * cannot do. Every test seeds its own docs under unique ids per actor where
 * needed; the whole emulator db is cleared between tests.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";

let env: RulesTestEnvironment;

// Actor UIDs
const ADMIN = "admin-uid";
const EMPLOYER = "employer-uid"; // approved employer
const WORKER = "worker-uid"; // approved worker
const PENDING = "pending-uid"; // pending (unapproved) worker
const STRANGER = "stranger-uid"; // approved employer, unrelated to the job

const JOB = "job-1";

function db(uid?: string) {
  return uid
    ? env.authenticatedContext(uid).firestore()
    : env.unauthenticatedContext().firestore();
}

/** Authenticated context whose session passed a second factor (TOTP).
 *  `sign_in_second_factor` isn't in the lib's TokenOptions type but does pass
 *  through to the emulated token at runtime — hence the cast. */
function db2fa(uid: string) {
  const tokenOptions = {
    firebase: { sign_in_provider: "password", sign_in_second_factor: "totp" },
  } as unknown as Parameters<typeof env.authenticatedContext>[1];
  return env.authenticatedContext(uid, tokenOptions).firestore();
}

/** Seed the standard cast + one open job, bypassing rules. */
async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const f = ctx.firestore();
    await setDoc(doc(f, "users", ADMIN), {
      uid: ADMIN, role: "admin", accountStatus: "approved", displayName: "Admin",
    });
    await setDoc(doc(f, "users", EMPLOYER), {
      uid: EMPLOYER, role: "employer", accountStatus: "approved", displayName: "Emp",
    });
    await setDoc(doc(f, "users", WORKER), {
      uid: WORKER, role: "worker", accountStatus: "approved", displayName: "Wrk",
      verificationStatus: "approved", referralsCount: 0,
    });
    await setDoc(doc(f, "users", PENDING), {
      uid: PENDING, role: "worker", accountStatus: "pending", displayName: "New",
    });
    await setDoc(doc(f, "users", STRANGER), {
      uid: STRANGER, role: "employer", accountStatus: "approved", displayName: "Str",
    });
    await setDoc(doc(f, "users", WORKER, "private", "profile"), {
      idNumber: "9001015800087", homeLat: -26.1, homeLng: 28.0,
    });
    await setDoc(doc(f, "jobs", JOB), {
      employerId: EMPLOYER, title: "Trim the hedge", status: "open",
      suggestedPrice: 300, offerCount: 0, messageCount: 0,
    });
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "workit-rules-test",
    firestore: {
      rules: readFileSync(resolve(__dirname, "../../firestore.rules"), "utf8"),
    },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await seed();
});

// ---------- USERS ----------

describe("users collection", () => {
  it("anonymous visitors cannot read user profiles", async () => {
    await assertFails(getDoc(doc(db(), "users", WORKER)));
  });

  it("signed-in users can read profiles", async () => {
    await assertSucceeds(getDoc(doc(db(STRANGER), "users", WORKER)));
  });

  it("a user can create their own profile with a normal role", async () => {
    await assertSucceeds(
      setDoc(doc(db("newbie"), "users", "newbie"), {
        uid: "newbie", role: "employer", accountStatus: "pending",
      }),
    );
  });

  it("nobody can self-register as admin", async () => {
    await assertFails(
      setDoc(doc(db("evil"), "users", "evil"), { uid: "evil", role: "admin" }),
    );
  });

  it("a user cannot create someone else's profile", async () => {
    await assertFails(
      setDoc(doc(db("evil"), "users", "victim"), { uid: "victim", role: "worker" }),
    );
  });

  it("self can update harmless profile fields", async () => {
    await assertSucceeds(
      updateDoc(doc(db(WORKER), "users", WORKER), { bio: "I love gardens" }),
    );
  });

  for (const field of [
    ["role", "admin"],
    ["verificationStatus", "approved"],
    ["backgroundVerified", true],
    ["ratingAvg", 5],
    ["accountStatus", "approved"],
    // Trust signals — must be server-authored, never self-set.
    ["referralsCount", 50],
    ["jobsCompleted", 99],
    ["jobsCancelled", 3],
    ["employerJobsHired", 80],
  ] as const) {
    it(`self cannot change protected field: ${field[0]}`, async () => {
      await assertFails(
        updateDoc(doc(db(PENDING), "users", PENDING), { [field[0]]: field[1] }),
      );
    });
  }

  it("a user cannot bump their OWN referralsCount (no self-farming badges)", async () => {
    await assertFails(
      updateDoc(doc(db(WORKER), "users", WORKER), { referralsCount: 1 }),
    );
  });

  it("admin can change verification status", async () => {
    await assertSucceeds(
      updateDoc(doc(db(ADMIN), "users", WORKER), { verificationStatus: "rejected" }),
    );
  });

  it("employer may self-upgrade to business (role only)", async () => {
    await assertSucceeds(
      updateDoc(doc(db(EMPLOYER), "users", EMPLOYER), { role: "business" }),
    );
  });

  it("worker may NOT self-upgrade to business", async () => {
    await assertFails(
      updateDoc(doc(db(WORKER), "users", WORKER), { role: "business" }),
    );
  });

  it("employer may not self-upgrade to admin", async () => {
    await assertFails(
      updateDoc(doc(db(EMPLOYER), "users", EMPLOYER), { role: "admin" }),
    );
  });

  it("another user may bump referralsCount by exactly 1", async () => {
    await assertSucceeds(
      updateDoc(doc(db(STRANGER), "users", WORKER), { referralsCount: 1 }),
    );
  });

  it("referralsCount cannot jump by more than 1", async () => {
    await assertFails(
      updateDoc(doc(db(STRANGER), "users", WORKER), { referralsCount: 5 }),
    );
  });

  it("referral bump cannot smuggle other field changes", async () => {
    await assertFails(
      updateDoc(doc(db(STRANGER), "users", WORKER), {
        referralsCount: 1, displayName: "Hacked",
      }),
    );
  });

  it("only admins can delete user docs", async () => {
    await assertFails(deleteDoc(doc(db(WORKER), "users", WORKER)));
    await assertSucceeds(deleteDoc(doc(db(ADMIN), "users", PENDING)));
  });
});

// ---------- PRIVATE PII SUBCOLLECTION ----------

describe("users/{uid}/private (ID numbers, home GPS)", () => {
  it("owner can read their private doc", async () => {
    await assertSucceeds(getDoc(doc(db(WORKER), "users", WORKER, "private", "profile")));
  });

  it("admin WITHOUT a 2FA session CANNOT read private docs", async () => {
    await assertFails(getDoc(doc(db(ADMIN), "users", WORKER, "private", "profile")));
  });

  it("admin WITH a 2FA session can read private docs", async () => {
    await assertSucceeds(getDoc(doc(db2fa(ADMIN), "users", WORKER, "private", "profile")));
  });

  it("other signed-in users CANNOT read private docs", async () => {
    await assertFails(getDoc(doc(db(STRANGER), "users", WORKER, "private", "profile")));
  });

  it("anonymous CANNOT read private docs", async () => {
    await assertFails(getDoc(doc(db(), "users", WORKER, "private", "profile")));
  });

  it("others cannot write private docs", async () => {
    await assertFails(
      setDoc(doc(db(STRANGER), "users", WORKER, "private", "profile"), { idNumber: "x" }),
    );
  });
});

describe("users/{uid}/fcmTokens", () => {
  it("others cannot read push tokens", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users", WORKER, "fcmTokens", "t1"), { token: "secret" });
    });
    await assertFails(getDoc(doc(db(STRANGER), "users", WORKER, "fcmTokens", "t1")));
    await assertSucceeds(getDoc(doc(db(WORKER), "users", WORKER, "fcmTokens", "t1")));
  });
});

// ---------- JOBS ----------

describe("jobs collection", () => {
  it("jobs are publicly readable (WhatsApp share preview)", async () => {
    await assertSucceeds(getDoc(doc(db(), "jobs", JOB)));
  });

  it("approved employer can post a job as themselves", async () => {
    await assertSucceeds(
      setDoc(doc(db(EMPLOYER), "jobs", "job-new"), {
        employerId: EMPLOYER, title: "Paint", status: "open", suggestedPrice: 500,
      }),
    );
  });

  it("PENDING accounts cannot post jobs", async () => {
    await assertFails(
      setDoc(doc(db(PENDING), "jobs", "job-x"), {
        employerId: PENDING, title: "Spam", status: "open", suggestedPrice: 10,
      }),
    );
  });

  it("cannot post a job under someone else's employerId", async () => {
    await assertFails(
      setDoc(doc(db(STRANGER), "jobs", "job-x"), {
        employerId: EMPLOYER, title: "Fake", status: "open", suggestedPrice: 10,
      }),
    );
  });

  it("cannot create a job already assigned / with zero price", async () => {
    await assertFails(
      setDoc(doc(db(EMPLOYER), "jobs", "job-x"), {
        employerId: EMPLOYER, title: "X", status: "assigned", suggestedPrice: 100,
      }),
    );
    await assertFails(
      setDoc(doc(db(EMPLOYER), "jobs", "job-y"), {
        employerId: EMPLOYER, title: "Y", status: "open", suggestedPrice: 0,
      }),
    );
  });

  it("employer can update their own job", async () => {
    await assertSucceeds(
      updateDoc(doc(db(EMPLOYER), "jobs", JOB), { status: "cancelled" }),
    );
  });

  it("strangers cannot edit someone's job content", async () => {
    await assertFails(
      updateDoc(doc(db(STRANGER), "jobs", JOB), { title: "Defaced" }),
    );
  });

  it("approved user may bump offerCount by exactly 1 (social proof)", async () => {
    await assertSucceeds(
      updateDoc(doc(db(WORKER), "jobs", JOB), { offerCount: 1, lastOfferAt: 123, updatedAt: 123 }),
    );
  });

  it("offerCount cannot be inflated by more than 1 per write", async () => {
    await assertFails(
      updateDoc(doc(db(WORKER), "jobs", JOB), { offerCount: 50, updatedAt: 123 }),
    );
  });

  it("counter bump cannot smuggle a title change", async () => {
    await assertFails(
      updateDoc(doc(db(WORKER), "jobs", JOB), { offerCount: 1, title: "Defaced" }),
    );
  });

  it("employer can delete their OPEN job; not once assigned", async () => {
    await assertSucceeds(deleteDoc(doc(db(EMPLOYER), "jobs", JOB)));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "jobs", "job-assigned"), {
        employerId: EMPLOYER, title: "T", status: "assigned", suggestedPrice: 100,
      });
    });
    await assertFails(deleteDoc(doc(db(EMPLOYER), "jobs", "job-assigned")));
  });
});

// ---------- JOB RATING / PRICE INTEGRITY ----------

describe("jobs rating + price integrity", () => {
  // A confirmed single-worker job: WORKER did EMPLOYER's job.
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "jobs", "job-done"), {
        employerId: EMPLOYER, assignedWorkerId: WORKER, assignedWorkerIds: [WORKER],
        title: "T", status: "confirmed", suggestedPrice: 300, agreedPrice: 300,
      });
    });
  });

  it("worker CANNOT author the employer's rating of them (self-5-star)", async () => {
    await assertFails(
      updateDoc(doc(db(WORKER), "jobs", "job-done"), {
        employerRating: { stars: 5, at: 1 },
      }),
    );
  });

  it("worker CANNOT change the agreed price on their job", async () => {
    await assertFails(
      updateDoc(doc(db(WORKER), "jobs", "job-done"), { agreedPrice: 99999 }),
    );
  });

  it("employer CANNOT author the worker's rating of them", async () => {
    await assertFails(
      updateDoc(doc(db(EMPLOYER), "jobs", "job-done"), {
        workerRating: { stars: 5, at: 1 },
      }),
    );
  });

  it("worker can still run their own lifecycle + leave their workerRating", async () => {
    await assertSucceeds(
      updateDoc(doc(db(WORKER), "jobs", "job-done"), { enRouteAt: 123 }),
    );
    await assertSucceeds(
      updateDoc(doc(db(WORKER), "jobs", "job-done"), { workerRating: { stars: 4, at: 1 } }),
    );
  });

  it("employer can still confirm + leave their employerRating", async () => {
    await assertSucceeds(
      updateDoc(doc(db(EMPLOYER), "jobs", "job-done"), { employerRating: { stars: 5, at: 1 } }),
    );
  });

  it("a participant can raise an SOS (write emergency); a stranger cannot", async () => {
    const sos = (at: number) => ({ emergency: { triggeredBy: WORKER, at, status: "active", lat: -26.1, lng: 28.0 } });
    // Stranger first, on a doc with no emergency yet, so it's a real change.
    await assertFails(updateDoc(doc(db(STRANGER), "jobs", "job-done"), sos(1)));
    await assertSucceeds(updateDoc(doc(db(WORKER), "jobs", "job-done"), sos(2)));
    await assertSucceeds(updateDoc(doc(db(EMPLOYER), "jobs", "job-done"), sos(3)));
  });
});

// ---------- PAYMENT HANDSHAKE + WORK RECORDS ----------

describe("payment handshake + workRecords", () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "jobs", "job-paid"), {
        employerId: EMPLOYER, assignedWorkerId: WORKER, assignedWorkerIds: [WORKER],
        title: "T", status: "confirmed", suggestedPrice: 300, agreedPrice: 300,
      });
      await setDoc(doc(ctx.firestore(), "workRecords", "tok-1"), {
        uid: WORKER, displayName: "Wrk", totalJobs: 1, totalEarned: 300,
      });
    });
  });

  it("worker CANNOT stamp payment fields on their job (confirmPayment callable only)", async () => {
    await assertFails(
      updateDoc(doc(db(WORKER), "jobs", "job-paid"), { paymentReceivedAt: 1 }),
    );
    await assertFails(
      updateDoc(doc(db(WORKER), "jobs", "job-paid"), { paymentConfirmedAt: 1 }),
    );
  });

  it("employer CANNOT stamp payment fields on their job (confirmPayment callable only)", async () => {
    await assertFails(
      updateDoc(doc(db(EMPLOYER), "jobs", "job-paid"), { paymentPaidAt: 1 }),
    );
    await assertFails(
      updateDoc(doc(db(EMPLOYER), "jobs", "job-paid"), { paymentConfirmedAt: 1 }),
    );
  });

  it("nobody can inflate their own payment tallies (server-authored trust signal)", async () => {
    await assertFails(
      updateDoc(doc(db(WORKER), "users", WORKER), { paymentsConfirmedCount: 999 }),
    );
    await assertFails(
      updateDoc(doc(db(EMPLOYER), "users", EMPLOYER), { employerPaymentsConfirmed: 999 }),
    );
  });

  it("workRecords: anyone with the token can GET it — even signed out", async () => {
    await assertSucceeds(getDoc(doc(db(), "workRecords", "tok-1")));
  });

  it("workRecords: clients can never write (server-only)", async () => {
    await assertFails(
      setDoc(doc(db(WORKER), "workRecords", "tok-forged"), { uid: WORKER, totalEarned: 999999 }),
    );
    await assertFails(
      updateDoc(doc(db(WORKER), "workRecords", "tok-1"), { totalEarned: 999999 }),
    );
  });

  it("workRecords: the collection cannot be LISTED (token stays a bearer secret)", async () => {
    await assertFails(getDocs(collection(db(WORKER), "workRecords")));
    await assertFails(getDocs(collection(db(), "workRecords")));
  });
});

// ---------- OFFERS ----------

describe("jobs/{jobId}/offers", () => {
  it("approved worker can offer on an open job", async () => {
    await assertSucceeds(
      setDoc(doc(db(WORKER), "jobs", JOB, "offers", "o1"), {
        workerId: WORKER, status: "pending", price: 250,
      }),
    );
  });

  it("pending-account worker cannot offer", async () => {
    await assertFails(
      setDoc(doc(db(PENDING), "jobs", JOB, "offers", "o2"), {
        workerId: PENDING, status: "pending", price: 250,
      }),
    );
  });

  it("cannot offer in someone else's name", async () => {
    await assertFails(
      setDoc(doc(db(STRANGER), "jobs", JOB, "offers", "o3"), {
        workerId: WORKER, status: "pending", price: 250,
      }),
    );
  });

  it("cannot offer on a non-open job", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "jobs", "job-closed"), {
        employerId: EMPLOYER, title: "T", status: "assigned", suggestedPrice: 100,
      });
    });
    await assertFails(
      setDoc(doc(db(WORKER), "jobs", "job-closed", "offers", "o4"), {
        workerId: WORKER, status: "pending", price: 250,
      }),
    );
  });

  it("employer + offer's worker can read; strangers cannot", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "jobs", JOB, "offers", "o1"), {
        workerId: WORKER, status: "pending", price: 250,
      });
    });
    await assertSucceeds(getDoc(doc(db(EMPLOYER), "jobs", JOB, "offers", "o1")));
    await assertSucceeds(getDoc(doc(db(WORKER), "jobs", JOB, "offers", "o1")));
    await assertFails(getDoc(doc(db(STRANGER), "jobs", JOB, "offers", "o1")));
  });

  it("employer can accept an offer; strangers cannot touch it", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "jobs", JOB, "offers", "o1"), {
        workerId: WORKER, status: "pending", price: 250,
      });
    });
    await assertSucceeds(
      updateDoc(doc(db(EMPLOYER), "jobs", JOB, "offers", "o1"), { status: "accepted" }),
    );
    await assertFails(
      updateDoc(doc(db(STRANGER), "jobs", JOB, "offers", "o1"), { status: "rejected" }),
    );
  });

  it("worker CANNOT self-accept their own offer; may only withdraw it", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "jobs", JOB, "offers", "o1"), {
        workerId: WORKER, status: "pending", price: 250,
      });
    });
    await assertFails(
      updateDoc(doc(db(WORKER), "jobs", JOB, "offers", "o1"), { status: "accepted" }),
    );
    await assertSucceeds(
      updateDoc(doc(db(WORKER), "jobs", JOB, "offers", "o1"), { status: "withdrawn" }),
    );
  });
});

// ---------- MESSAGES ----------

describe("jobs/{jobId}/messages", () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "jobs", "job-chat"), {
        employerId: EMPLOYER, assignedWorkerId: WORKER,
        title: "T", status: "assigned", suggestedPrice: 100,
      });
      await setDoc(doc(ctx.firestore(), "jobs", "job-chat", "messages", "m0"), {
        senderId: EMPLOYER, text: "hi",
      });
    });
  });

  it("participants can read + send; strangers can do neither", async () => {
    await assertSucceeds(getDoc(doc(db(EMPLOYER), "jobs", "job-chat", "messages", "m0")));
    await assertSucceeds(getDoc(doc(db(WORKER), "jobs", "job-chat", "messages", "m0")));
    await assertFails(getDoc(doc(db(STRANGER), "jobs", "job-chat", "messages", "m0")));
    await assertSucceeds(
      setDoc(doc(db(WORKER), "jobs", "job-chat", "messages", "m1"), {
        senderId: WORKER, text: "On my way",
      }),
    );
    await assertFails(
      setDoc(doc(db(STRANGER), "jobs", "job-chat", "messages", "m2"), {
        senderId: STRANGER, text: "let me in",
      }),
    );
  });

  it("blocks empty messages and >2000-char essays", async () => {
    await assertFails(
      setDoc(doc(db(WORKER), "jobs", "job-chat", "messages", "m3"), {
        senderId: WORKER, text: "",
      }),
    );
    await assertFails(
      setDoc(doc(db(WORKER), "jobs", "job-chat", "messages", "m4"), {
        senderId: WORKER, text: "x".repeat(2001),
      }),
    );
  });
});

describe("jobs/{jobId}/secure (start PIN — server-only)", () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "jobs", JOB, "secure", "start"), {
        pin: "1234", attempts: 0,
      });
    });
  });

  it("nobody (employer, worker, admin, stranger, anon) can read the start PIN", async () => {
    await assertFails(getDoc(doc(db(EMPLOYER), "jobs", JOB, "secure", "start")));
    await assertFails(getDoc(doc(db(WORKER), "jobs", JOB, "secure", "start")));
    await assertFails(getDoc(doc(db(ADMIN), "jobs", JOB, "secure", "start")));
    await assertFails(getDoc(doc(db(STRANGER), "jobs", JOB, "secure", "start")));
    await assertFails(getDoc(doc(db(), "jobs", JOB, "secure", "start")));
  });

  it("nobody can write the start PIN from a client (only the Admin SDK)", async () => {
    await assertFails(
      setDoc(doc(db(EMPLOYER), "jobs", JOB, "secure", "start"), { pin: "0000" }),
    );
    await assertFails(
      setDoc(doc(db(WORKER), "jobs", JOB, "secure", "start"), { pin: "0000" }),
    );
    await assertFails(
      updateDoc(doc(db(ADMIN), "jobs", JOB, "secure", "start"), { attempts: 99 }),
    );
  });
});

// ---------- ADMIN-ONLY COLLECTIONS ----------

describe("deletionRequests", () => {
  it("user can file their own pending request; admins read", async () => {
    await assertSucceeds(
      setDoc(doc(db(WORKER), "deletionRequests", "d1"), {
        uid: WORKER, status: "pending",
      }),
    );
    await assertFails(getDoc(doc(db(WORKER), "deletionRequests", "d1")));
    await assertSucceeds(getDoc(doc(db(ADMIN), "deletionRequests", "d1")));
  });

  it("cannot file a request pre-approved or for someone else", async () => {
    await assertFails(
      setDoc(doc(db(WORKER), "deletionRequests", "d2"), { uid: WORKER, status: "done" }),
    );
    await assertFails(
      setDoc(doc(db(STRANGER), "deletionRequests", "d3"), { uid: WORKER, status: "pending" }),
    );
  });
});

describe("auditLog", () => {
  it("admin writes own entries; immutable afterwards; non-admins blocked", async () => {
    await assertSucceeds(
      setDoc(doc(db(ADMIN), "auditLog", "a1"), { adminUid: ADMIN, action: "approve" }),
    );
    await assertFails(
      updateDoc(doc(db(ADMIN), "auditLog", "a1"), { action: "tampered" }),
    );
    await assertFails(deleteDoc(doc(db(ADMIN), "auditLog", "a1")));
    await assertFails(
      setDoc(doc(db(EMPLOYER), "auditLog", "a2"), { adminUid: EMPLOYER, action: "x" }),
    );
    await assertFails(getDoc(doc(db(EMPLOYER), "auditLog", "a1")));
  });
});

describe("moderation (server-only writes)", () => {
  it("nobody — not even admins — can create flags client-side", async () => {
    await assertFails(setDoc(doc(db(ADMIN), "moderation", "f1"), { kind: "x" }));
    await assertFails(setDoc(doc(db(WORKER), "moderationLog", "l1"), { kind: "x" }));
  });
});

describe("idDocAccessLog (RBAC phase 3 · POPIA PII access log)", () => {
  it("server-only writes (even admins blocked client-side); non-admins can't read", async () => {
    // The log is written ONLY by getVerificationPayload via the Admin SDK.
    await assertFails(
      setDoc(doc(db(ADMIN), "idDocAccessLog", "l1"), { adminUid: ADMIN, targetUid: WORKER, at: 1 }),
    );
    await assertFails(
      setDoc(doc(db(WORKER), "idDocAccessLog", "l2"), { adminUid: WORKER, targetUid: ADMIN, at: 1 }),
    );
    // Non-admins can never read who viewed whose ID documents.
    await assertFails(getDoc(doc(db(EMPLOYER), "idDocAccessLog", "l1")));
  });
});

describe("reports", () => {
  it("valid report accepted; reporter reads own; others blocked", async () => {
    await assertSucceeds(
      setDoc(doc(db(WORKER), "reports", "r1"), {
        reporterId: WORKER, status: "open", targetType: "job",
        reason: "scam", description: "Looks fake",
      }),
    );
    await assertSucceeds(getDoc(doc(db(WORKER), "reports", "r1")));
    await assertFails(getDoc(doc(db(STRANGER), "reports", "r1")));
    await assertFails(updateDoc(doc(db(WORKER), "reports", "r1"), { status: "resolved" }));
    await assertSucceeds(updateDoc(doc(db(ADMIN), "reports", "r1"), { status: "resolved" }));
  });

  it("rejects invalid targetType and oversized descriptions", async () => {
    await assertFails(
      setDoc(doc(db(WORKER), "reports", "r2"), {
        reporterId: WORKER, status: "open", targetType: "everything",
        reason: "x", description: "y",
      }),
    );
    await assertFails(
      setDoc(doc(db(WORKER), "reports", "r3"), {
        reporterId: WORKER, status: "open", targetType: "user",
        reason: "x", description: "y".repeat(501),
      }),
    );
  });
});

// ---------- PLATFORM STATS ----------

describe("stats + statsDaily (server-maintained counters)", () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "stats", "totals"), { signups: 5, gmv: 1000 });
      await setDoc(doc(ctx.firestore(), "statsDaily", "2026-06-12"), { signups: 2 });
    });
  });

  it("admins can read; regular users and anonymous cannot", async () => {
    await assertSucceeds(getDoc(doc(db(ADMIN), "stats", "totals")));
    await assertSucceeds(getDoc(doc(db(ADMIN), "statsDaily", "2026-06-12")));
    await assertFails(getDoc(doc(db(WORKER), "stats", "totals")));
    await assertFails(getDoc(doc(db(), "statsDaily", "2026-06-12")));
  });

  it("nobody — not even admins — can write counters client-side", async () => {
    await assertFails(updateDoc(doc(db(ADMIN), "stats", "totals"), { gmv: 999999 }));
    await assertFails(setDoc(doc(db(WORKER), "statsDaily", "2026-06-12"), { signups: 100 }));
  });
});

describe("supportMessages + supportState (WhatsApp front door)", () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "supportMessages", "m1"), {
        waNumber: "27820000000", text: "help me", direction: "inbound",
      });
      await setDoc(doc(ctx.firestore(), "supportState", "27820000000"), { lastAckAt: 1 });
    });
  });

  it("admins read; everyone else (incl. anonymous) cannot", async () => {
    await assertSucceeds(getDoc(doc(db(ADMIN), "supportMessages", "m1")));
    await assertFails(getDoc(doc(db(WORKER), "supportMessages", "m1")));
    await assertFails(getDoc(doc(db(), "supportState", "27820000000")));
  });

  it("nobody can write support docs client-side", async () => {
    await assertFails(setDoc(doc(db(WORKER), "supportMessages", "m2"), { text: "spam" }));
    await assertFails(updateDoc(doc(db(ADMIN), "supportMessages", "m1"), { handled: true }));
  });
});

describe("broadcasts (admin push campaigns)", () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "broadcasts", "b1"), {
        title: "Now in Tembisa", segment: "all", sent: 12, createdAt: 1,
      });
    });
  });

  it("admins read; everyone else cannot", async () => {
    await assertSucceeds(getDoc(doc(db(ADMIN), "broadcasts", "b1")));
    await assertFails(getDoc(doc(db(WORKER), "broadcasts", "b1")));
    await assertFails(getDoc(doc(db(), "broadcasts", "b1")));
  });

  it("nobody can write broadcasts client-side (server/callable only)", async () => {
    await assertFails(setDoc(doc(db(ADMIN), "broadcasts", "b2"), { title: "x" }));
  });
});

// ---------- CATCH-ALL ----------

describe("catch-all deny", () => {
  it("unknown collections are locked for everyone, even admins", async () => {
    await assertFails(setDoc(doc(db(ADMIN), "randomCollection", "x"), { a: 1 }));
    await assertFails(getDoc(doc(db(ADMIN), "randomCollection", "x")));
  });
});

// ---------- INTERNAL ADMIN NOTES ----------

describe("adminNotes collection", () => {
  it("admins can write and read a note", async () => {
    await assertSucceeds(
      setDoc(doc(db(ADMIN), "adminNotes", WORKER), {
        text: "Called him, docs coming Monday.",
        updatedAt: Date.now(),
        updatedBy: ADMIN,
        updatedByName: "Admin",
      }),
    );
    await assertSucceeds(getDoc(doc(db(ADMIN), "adminNotes", WORKER)));
  });

  it("the user the note is about can NEVER read it", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "adminNotes", WORKER), { text: "secret" });
    });
    await assertFails(getDoc(doc(db(WORKER), "adminNotes", WORKER)));
  });

  it("other signed-in users and guests cannot read or write", async () => {
    await assertFails(getDoc(doc(db(STRANGER), "adminNotes", WORKER)));
    await assertFails(setDoc(doc(db(STRANGER), "adminNotes", WORKER), { text: "x" }));
    await assertFails(getDoc(doc(db(), "adminNotes", WORKER)));
  });
});

// ---------- SCHEDULER HEARTBEATS ----------

describe("opsHealth collection", () => {
  it("admins can read heartbeats; others cannot; nobody writes client-side", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "opsHealth", "jarvisMorningDigest"), { lastRunAt: 1 });
    });
    await assertSucceeds(getDoc(doc(db(ADMIN), "opsHealth", "jarvisMorningDigest")));
    await assertFails(getDoc(doc(db(WORKER), "opsHealth", "jarvisMorningDigest")));
    await assertFails(getDoc(doc(db(), "opsHealth", "jarvisMorningDigest")));
    await assertFails(setDoc(doc(db(ADMIN), "opsHealth", "x"), { lastRunAt: 2 }));
  });
});

// ---------- RBAC PHASE 2 — role claims override the legacy binary admin ----------

const TAGGED_OPS = "tagged-ops-uid"; // users doc role=="admin" (Simphiwe case) + operations claims

const OPS_PERMS = {
  "approvals.manage": true, "verification.review": true, "business.verify": true,
  "disputes.resolve": true, "support.respond": true, "users.read": true,
  "users.suspend": true, "analytics.view": true, "audit.view": true,
};
const ANALYST_PERMS = { "analytics.view": true };

/** Authenticated context carrying RBAC claims (optionally + a 2FA session). */
function dbTagged(
  uid: string,
  adminRole: string,
  perms: Record<string, boolean>,
  secondFactor = false,
) {
  const tokenOptions = {
    adminRole,
    perms,
    ...(secondFactor
      ? { firebase: { sign_in_provider: "password", sign_in_second_factor: "totp" } }
      : {}),
  } as unknown as Parameters<typeof env.authenticatedContext>[1];
  return env.authenticatedContext(uid, tokenOptions).firestore();
}

describe("RBAC phase 2 (claim-tagged admins)", () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const f = ctx.firestore();
      await setDoc(doc(f, "users", TAGGED_OPS), {
        uid: TAGGED_OPS, role: "admin", adminRole: "operations",
        accountStatus: "approved", displayName: "Ops",
      });
      await setDoc(doc(f, "broadcasts", "rb1"), { title: "x" });
      await setDoc(doc(f, "stats", "totals"), { signups: 1 });
      await setDoc(doc(f, "adminNotes", WORKER), { text: "note" });
    });
  });

  it("tagged operations admin can work the queues (approvals.manage)", async () => {
    const f = dbTagged(TAGGED_OPS, "operations", OPS_PERMS);
    await assertSucceeds(updateDoc(doc(f, "users", PENDING), { accountStatus: "approved" }));
    await assertSucceeds(getDoc(doc(f, "auditLog", "nope"))); // audit.view read
  });

  it("tagged operations admin is LOCKED OUT of owner surfaces despite legacy role==admin", async () => {
    const f = dbTagged(TAGGED_OPS, "operations", OPS_PERMS);
    await assertFails(getDoc(doc(f, "broadcasts", "rb1"))); // broadcast.send is owner-only
  });

  it("tagged analyst is read-only: stats yes, notes/user-updates no", async () => {
    const f = dbTagged(TAGGED_OPS, "analyst", ANALYST_PERMS);
    await assertSucceeds(getDoc(doc(f, "stats", "totals")));
    await assertFails(getDoc(doc(f, "adminNotes", WORKER))); // no users.read
    await assertFails(updateDoc(doc(f, "users", PENDING), { accountStatus: "approved" }));
  });

  it("private ID docs need verification.review + 2FA — support role denied even with 2FA", async () => {
    const ver = dbTagged(TAGGED_OPS, "verification", { "verification.review": true, "users.read": true }, true);
    await assertSucceeds(getDoc(doc(ver, "users", WORKER, "private", "profile")));
    const verNo2fa = dbTagged(TAGGED_OPS, "verification", { "verification.review": true, "users.read": true }, false);
    await assertFails(getDoc(doc(verNo2fa, "users", WORKER, "private", "profile")));
    const support = dbTagged(TAGGED_OPS, "support", { "support.respond": true, "users.read": true }, true);
    await assertFails(getDoc(doc(support, "users", WORKER, "private", "profile")));
  });
});
