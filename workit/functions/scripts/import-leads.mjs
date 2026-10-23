/**
 * Import a marketer-staged leads JSON file into the `marketingLeads` collection.
 *
 * This import is the HUMAN APPROVAL STEP of the outreach pipeline: nothing gets
 * emailed unless it passed through here (and marketing/config.enabled is true).
 *
 * Usage (from workit/):
 *   node functions/scripts/import-leads.mjs marketing/outreach/leads-2026-07-06.json
 *
 * Auth: uses your gcloud login (no service-account file):
 *   requires `gcloud auth login` done once on this machine.
 *
 * Input schema (array):
 *   [{ "businessName": "...", "email": "...", "contactName": "", "suburb": "",
 *      "category": "", "source": "" }]
 *
 * Skips (never overwrites) any lead whose email already exists in the
 * collection — an opt-out or already-contacted business is never re-queued.
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const PROJECT = "workit-6a927";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

const file = process.argv[2];
if (!file) {
  console.error("Usage: node functions/scripts/import-leads.mjs <leads.json>");
  process.exit(1);
}

const token = execSync("gcloud auth print-access-token", { encoding: "utf8" }).trim();
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

const leads = JSON.parse(readFileSync(file, "utf8"));
if (!Array.isArray(leads)) {
  console.error("Input must be a JSON array of lead objects.");
  process.exit(1);
}

const str = (v) => ({ stringValue: String(v ?? "") });
const int = (v) => ({ integerValue: String(v) });

// Existing emails (any status) — never double-queue an address.
const existing = new Set();
let pageToken = "";
do {
  const url = `${BASE}/marketingLeads?pageSize=300&mask.fieldPaths=email${pageToken ? `&pageToken=${pageToken}` : ""}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    if (res.status === 404) break; // collection doesn't exist yet — fine
    console.error(`Failed listing existing leads: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const data = await res.json();
  for (const doc of data.documents ?? []) {
    const e = doc.fields?.email?.stringValue?.toLowerCase().trim();
    if (e) existing.add(e);
  }
  pageToken = data.nextPageToken ?? "";
} while (pageToken);

let added = 0, skipped = 0;
for (const lead of leads) {
  const email = String(lead.email ?? "").toLowerCase().trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.log(`  ✗ skip (bad email): ${lead.businessName ?? "?"} <${lead.email ?? ""}>`);
    skipped++;
    continue;
  }
  if (existing.has(email)) {
    console.log(`  ✗ skip (already in queue/history): ${lead.businessName ?? "?"} <${email}>`);
    skipped++;
    continue;
  }
  const body = {
    fields: {
      businessName: str(lead.businessName),
      contactName: str(lead.contactName),
      email: str(email),
      suburb: str(lead.suburb),
      category: str(lead.category),
      source: str(lead.source),
      status: str("pending"),
      createdAt: int(Date.now()),
    },
  };
  const res = await fetch(`${BASE}/marketingLeads`, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) {
    console.error(`  ✗ FAILED: ${lead.businessName} <${email}> — ${res.status} ${await res.text()}`);
    skipped++;
    continue;
  }
  existing.add(email);
  console.log(`  ✓ queued: ${lead.businessName ?? "?"} <${email}>`);
  added++;
}

console.log(`\nDone: ${added} queued, ${skipped} skipped.`);
console.log(`They'll be emailed weekdays 08:30 SAST, ${added ? "once" : "if"} marketing/config.enabled is true.`);
