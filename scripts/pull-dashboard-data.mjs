// Pull Workit live data via the Firestore REST API (gcloud access token) and
// emit pre-aggregated JSON for the founder dashboard.
// Usage: TOKEN=$(gcloud auth print-access-token) node pull-dashboard-data.mjs

const TOKEN = process.env.TOKEN;
if (!TOKEN) {
  console.error("Set TOKEN env var (gcloud auth print-access-token)");
  process.exit(1);
}
const BASE =
  "https://firestore.googleapis.com/v1/projects/workit-6a927/databases/(default)/documents";

/** Firestore REST value → plain JS */
function val(v) {
  if (v == null) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("nullValue" in v) return null;
  if ("mapValue" in v) {
    const o = {};
    for (const [k, x] of Object.entries(v.mapValue.fields ?? {})) o[k] = val(x);
    return o;
  }
  if ("arrayValue" in v) return (v.arrayValue.values ?? []).map(val);
  return null;
}

async function fetchAll(collection) {
  const out = [];
  let pageToken = "";
  do {
    const url = `${BASE}/${collection}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (!res.ok) throw new Error(`${collection}: HTTP ${res.status} ${await res.text()}`);
    const data = await res.json();
    for (const doc of data.documents ?? []) {
      const id = doc.name.split("/").pop();
      const fields = {};
      for (const [k, v] of Object.entries(doc.fields ?? {})) fields[k] = val(v);
      out.push({ id, ...fields });
    }
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);
  return out;
}

const [users, jobs, reports] = await Promise.all([
  fetchAll("users"),
  fetchAll("jobs"),
  fetchAll("reports").catch(() => []),
]);

// ---------- aggregate ----------
const day = (ms) => new Date(ms).toISOString().slice(0, 10);

const usersOut = users.map((u) => ({
  name: u.displayName ?? "—",
  role: u.role ?? "—",
  status: u.accountStatus ?? "approved (legacy)",
  verified: u.verificationStatus === "approved",
  gold: !!u.backgroundVerified,
  suburb: u.suburb ?? "",
  city: u.city ?? "",
  rating: u.ratingAvg ?? null,
  ratings: u.ratingCount ?? 0,
  jobsDone: u.jobsCompleted ?? 0,
  joined: u.createdAt ? day(u.createdAt) : null,
}));

const jobsOut = jobs.map((j) => ({
  title: j.title ?? "—",
  category: j.category ?? "—",
  status: j.status ?? "—",
  suburb: j.suburb ?? "",
  price: j.agreedPrice ?? j.suggestedPrice ?? 0,
  offers: j.offerCount ?? 0,
  urgent: !!j.urgent,
  business: !!j.employerIsBusiness,
  posted: j.createdAt ? day(j.createdAt) : null,
}));

const out = {
  generatedAt: new Date().toISOString(),
  users: usersOut,
  jobs: jobsOut,
  reportsOpen: reports.filter((r) => r.status === "open" || r.status === "reviewing").length,
};

console.log(JSON.stringify(out, null, 2));
