/**
 * Export the `marketingLeads` collection (business name, email, suburb,
 * category, status) to CSV — the cross-lane registry for the Zapier agents.
 *
 * WHY: two outreach lanes run in parallel (Firebase/SendGrid sender + the
 * founder's Zapier sender). The Zapier researcher checks the "Workit leads"
 * Google Sheet before adding a business, so pasting this export into the
 * sheet's "Firebase lane" tab guarantees the two lanes never email the same
 * company. Re-run + re-paste after every Firebase lead batch import.
 *
 * Usage (from workit/):
 *   node functions/scripts/export-leads.mjs > ../firebase-lane-leads.csv
 * or:
 *   node functions/scripts/export-leads.mjs marketing/outreach/firebase-lane-leads.csv
 *
 * Auth: same as import-leads.mjs — uses your gcloud login token.
 */
import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const PROJECT = "workit-6a927";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

const token = execSync("gcloud auth print-access-token", { encoding: "utf8" }).trim();
const headers = { Authorization: `Bearer ${token}` };

const rows = [["business_name", "email", "suburb", "category", "status"]];
let pageToken = "";
do {
  const url = `${BASE}/marketingLeads?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ""}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    if (res.status === 404) break; // collection doesn't exist yet
    console.error(`Failed listing leads: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const data = await res.json();
  for (const doc of data.documents ?? []) {
    const f = doc.fields ?? {};
    const s = (k) => f[k]?.stringValue ?? "";
    rows.push([s("businessName"), s("email"), s("suburb"), s("category"), s("status")]);
  }
  pageToken = data.nextPageToken ?? "";
} while (pageToken);

const esc = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const csv = rows.map((r) => r.map(esc).join(",")).join("\n") + "\n";

const out = process.argv[2];
if (out) {
  writeFileSync(out, csv, "utf8");
  console.error(`Wrote ${rows.length - 1} leads to ${out}`);
} else {
  process.stdout.write(csv);
  console.error(`(${rows.length - 1} leads)`);
}
