/**
 * Stage Facebook posts into the `marketingPosts` queue (one is published per
 * day at 17:30 SAST by scheduledFacebookPost).
 *
 * This import is the HUMAN APPROVAL STEP: nothing is ever posted unless it
 * passed through here.
 *
 * Usage (from workit/):
 *   node functions/scripts/import-posts.mjs marketing/queue/fb-week1.json
 *
 * Auth: your gcloud login (`gcloud auth login` once on this machine).
 *
 * Input schema (array, in the order they should be posted):
 *   [{ "caption": "text incl. hashtags",
 *      "imagePath": "marketing/content/2026-07-02-categories.png" }]  // optional
 *
 * Images are uploaded to Storage under marketing/posts/ (server-only path —
 * the poster mints a short-lived signed URL for Facebook at post time).
 */
import { readFileSync } from "node:fs";
import { basename, resolve, dirname } from "node:path";
import { execSync } from "node:child_process";

const PROJECT = "workit-6a927";
const BUCKET = "workit-6a927.firebasestorage.app";
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

const file = process.argv[2];
if (!file) {
  console.error("Usage: node functions/scripts/import-posts.mjs <posts.json>");
  process.exit(1);
}

const token = execSync("gcloud auth print-access-token", { encoding: "utf8" }).trim();
const auth = { Authorization: `Bearer ${token}` };

const posts = JSON.parse(readFileSync(file, "utf8"));
if (!Array.isArray(posts) || posts.length === 0) {
  console.error("Input must be a non-empty JSON array of { caption, imagePath? }.");
  process.exit(1);
}

const str = (v) => ({ stringValue: String(v ?? "") });
const int = (v) => ({ integerValue: String(v) });

// Existing posts (any status) — a RETRIED import must never double-queue.
// Keyed by original image basename (storagePath = marketing/posts/<ts>-<basename>)
// and by caption for image-less posts.
const existingImages = new Set();
const existingCaptions = new Set();
let pageToken = "";
do {
  const url = `${FIRESTORE}/marketingPosts?pageSize=300&mask.fieldPaths=storagePath&mask.fieldPaths=caption${pageToken ? `&pageToken=${pageToken}` : ""}`;
  const res = await fetch(url, { headers: auth });
  if (!res.ok) {
    if (res.status === 404) break; // collection doesn't exist yet — fine
    console.error(`Failed listing existing posts: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const data = await res.json();
  for (const doc of data.documents ?? []) {
    const sp = doc.fields?.storagePath?.stringValue ?? "";
    const base = sp.split("/").pop()?.replace(/^\d+-/, "");
    if (base) existingImages.add(base);
    const cap = doc.fields?.caption?.stringValue ?? "";
    if (cap) existingCaptions.add(cap);
  }
  pageToken = data.nextPageToken ?? "";
} while (pageToken);

let queued = 0;
let order = Date.now(); // preserves file order — the poster publishes oldest first

for (const post of posts) {
  const caption = String(post.caption ?? "").trim();
  if (!caption) {
    console.log("  ✗ skip: entry with empty caption");
    continue;
  }
  const incomingBase = (post.videoPath || post.imagePath) ? basename(post.videoPath || post.imagePath) : "";
  if ((incomingBase && existingImages.has(incomingBase)) || (!incomingBase && existingCaptions.has(caption))) {
    console.log(`  ✗ skip (already queued): ${caption.split("\n")[0].slice(0, 50)}`);
    continue;
  }

  // `imagePath` → 17:30 image slot · `videoPath` (mp4) → 08:00 clip slot
  const mediaLocal = post.videoPath || post.imagePath || "";
  const isVideo = Boolean(post.videoPath);
  let storagePath = "";
  if (mediaLocal) {
    // Media paths are relative to workit/ (where you run this from).
    const local = resolve(process.cwd(), mediaLocal);
    let bytes;
    try {
      bytes = readFileSync(local);
    } catch {
      console.log(`  ✗ skip "${caption.slice(0, 40)}…": media not found at ${local}`);
      continue;
    }
    storagePath = `marketing/posts/${order}-${basename(mediaLocal)}`;
    const up = await fetch(
      `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${encodeURIComponent(storagePath)}`,
      { method: "POST", headers: { ...auth, "Content-Type": isVideo ? "video/mp4" : "image/png" }, body: bytes },
    );
    if (!up.ok) {
      console.error(`  ✗ media upload FAILED (${up.status}): ${await up.text()}`);
      continue;
    }
  }

  const body = {
    fields: {
      caption: str(caption),
      storagePath: str(storagePath),
      mediaType: str(isVideo ? "video" : "image"),
      status: str("queued"),
      createdAt: int(order),
      sourceFile: str(basename(file)),
    },
  };
  const res = await fetch(`${FIRESTORE}/marketingPosts`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error(`  ✗ queue FAILED (${res.status}): ${await res.text()}`);
    continue;
  }
  console.log(`  ✓ queued${storagePath ? (isVideo ? " (clip → 08:00 slot)" : " (image → 17:30 slot)") : ""}: ${caption.split("\n")[0].slice(0, 60)}`);
  queued++;
  order++;
}

console.log(`\nDone: ${queued} post(s) queued.`);
console.log("Clips post daily 08:00 SAST, images daily 17:30 SAST. Pause: marketing/config.fbEnabled = false.");
