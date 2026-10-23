/**
 * One-time backfill for stats/totals + statsDaily/{day} from existing
 * users + jobs. Writes ABSOLUTE values (overwrites counters), so run it
 * BEFORE the stats triggers deploy — afterwards the triggers own the docs.
 *
 * Uses the Firestore REST API with your gcloud user token (the admin SDK
 * insists on a service-account key / ADC, which we deliberately avoid):
 *   node backfill-stats.mjs        (from workit/functions)
 *
 * Mirrors the bucketing in src/stats.ts: days are SAST; confirmed jobs
 * bucket by completedAt ?? updatedAt ?? createdAt; disputes by raisedAt.
 */

import { execSync } from "node:child_process";

const PROJECT = "workit-6a927";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const token = execSync("gcloud auth print-access-token", { encoding: "utf8" }).trim();
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

// ---- REST value decoding (just the types we read) ----
function decode(v) {
  if (v == null) return undefined;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("mapValue" in v) {
    const out = {};
    for (const [k, val] of Object.entries(v.mapValue.fields ?? {})) out[k] = decode(val);
    return out;
  }
  if ("arrayValue" in v) return (v.arrayValue.values ?? []).map(decode);
  if ("timestampValue" in v) return new Date(v.timestampValue).getTime();
  return undefined;
}

function encode(v) {
  if (typeof v === "number") {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  throw new Error(`unsupported encode: ${typeof v}`);
}

async function listAll(collection) {
  const docs = [];
  let pageToken = "";
  do {
    const url = `${BASE}/${collection}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`${collection}: ${res.status} ${await res.text()}`);
    const body = await res.json();
    for (const d of body.documents ?? []) {
      const data = {};
      for (const [k, val] of Object.entries(d.fields ?? {})) data[k] = decode(val);
      docs.push(data);
    }
    pageToken = body.nextPageToken ?? "";
  } while (pageToken);
  return docs;
}

// ---- aggregate ----
const dayKey = (ms) =>
  new Date(ms).toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });

const totals = {};
const daily = new Map();

function bump(at, counters) {
  const day = daily.get(dayKey(at)) ?? {};
  for (const [k, v] of Object.entries(counters)) {
    if (!v) continue;
    totals[k] = (totals[k] ?? 0) + v;
    day[k] = (day[k] ?? 0) + v;
  }
  daily.set(dayKey(at), day);
}

const users = await listAll("users");
for (const u of users) {
  if (u.role === "admin") continue;
  bump(u.createdAt ?? Date.now(), {
    signups: 1,
    signupsWorkers: u.role === "worker" ? 1 : 0,
    signupsEmployers: u.role === "employer" ? 1 : 0,
    signupsBusinesses: u.role === "business" ? 1 : 0,
  });
}

const jobs = await listAll("jobs");
for (const j of jobs) {
  bump(j.createdAt ?? Date.now(), { jobsPosted: 1 });
  if (j.status === "confirmed") {
    bump(j.completedAt ?? j.updatedAt ?? j.createdAt ?? Date.now(), {
      jobsConfirmed: 1,
      gmv: j.agreedPrice ?? j.suggestedPrice ?? 0,
    });
  }
  if (j.dispute?.raisedAt) {
    bump(j.dispute.raisedAt, { disputesRaised: 1 });
  }
}

// ---- write ----
function toWrite(path, counters) {
  const fields = { backfilledAt: encode(Date.now()) };
  for (const [k, v] of Object.entries(counters)) fields[k] = encode(v);
  return { update: { name: `projects/${PROJECT}/databases/(default)/documents/${path}`, fields } };
}

const writes = [toWrite("stats/totals", totals)];
for (const [day, counters] of daily) writes.push(toWrite(`statsDaily/${day}`, counters));

const res = await fetch(`${BASE.replace("/documents", "")}/documents:commit`, {
  method: "POST",
  headers,
  body: JSON.stringify({ writes }),
});
if (!res.ok) throw new Error(`commit failed: ${res.status} ${await res.text()}`);

console.log(`users scanned: ${users.length}, jobs scanned: ${jobs.length}`);
console.log("totals:", totals);
console.log(`daily docs written: ${daily.size}`);
