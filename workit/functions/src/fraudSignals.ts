/**
 * Free fraud signals for verification review (founder-approved 2026-07-11).
 *
 * Uses only data we already hold — no paid providers:
 *
 *  1. onVerificationFraudSignals (private-doc trigger)
 *     - DUPLICATE ID: a one-way-hashed index of every submitted SA ID number
 *       (idIndex/{sha256}); the same number on 2+ accounts is flagged.
 *     - UNDER-18 FROM THE ID: the ID number encodes the birth date — if it
 *       says under 18, flag it regardless of the typed signup DOB.
 *     - OCR CROSS-CHECK: Vision text-detection on the ID photo — does the
 *       typed ID number (and the account name) actually appear in the
 *       document they uploaded? Catches "uploaded someone else's/random doc".
 *       (Vision free tier covers current volume; PDFs are skipped.)
 *  2. onUserBanRegistry (users trigger)
 *     - Suspending an account registers sha256 hashes of its email/phone in
 *       bannedIndex; new sign-ups matching a banned identifier are flagged.
 *       Reinstating removes the hashes.
 *  3. onVerificationFileDuplicate (storage trigger)
 *     - Storage's own md5 of each verification upload goes into fileIndex;
 *       byte-identical documents on different accounts are flagged.
 *
 * All flags land on the PRIVATE doc at verification.fraud (owner/admin only),
 * surfaced on the admin review card via getVerificationPayload. Index
 * collections (idIndex / fileIndex / bannedIndex) have no client rules —
 * default-deny — and store only hashes, never raw identifiers.
 */
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { logger } from "firebase-functions";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import vision from "@google-cloud/vision";
import { createHash } from "node:crypto";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const visionClient = new vision.ImageAnnotatorClient();

type AnyDoc = Record<string, unknown>;

/** Decode the YYMMDD birth date from a 13-digit SA ID → age in whole years.
 *  Mirrors the century heuristic in src/lib/saId.ts (packages don't share code). */
function ageFromIdNumber(id: string): number | null {
  if (!/^\d{13}$/.test(id)) return null;
  const yy = Number(id.slice(0, 2));
  const mm = Number(id.slice(2, 4));
  const dd = Number(id.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const curYY = new Date().getFullYear() % 100;
  let year = yy <= curYY ? 2000 + yy : 1900 + yy;
  if (year > new Date().getFullYear()) year -= 100;
  const dob = new Date(Date.UTC(year, mm - 1, dd));
  if (dob.getUTCMonth() !== mm - 1 || dob.getUTCDate() !== dd) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - year;
  const m = now.getUTCMonth() - (mm - 1);
  if (m < 0 || (m === 0 && now.getUTCDate() < dd)) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

export const onVerificationFraudSignals = onDocumentWritten(
  "users/{uid}/private/{docId}",
  async (event) => {
    if (event.params.docId !== "profile") return;
    const after = event.data?.after.data() as AnyDoc | undefined;
    if (!after) return;
    const uid = event.params.uid;
    const v = (after.verification ?? {}) as AnyDoc;

    const idNumber = String(v.idNumber ?? "").replace(/\D/g, "");
    const rawPhoto = typeof v.idPhotoURL === "string" ? v.idPhotoURL : "";
    const idPhotoPath = rawPhoto && !rawPhoto.startsWith("http") ? rawPhoto : "";
    if (!idNumber && !idPhotoPath) return;

    // Self-trigger guard: we write verification.fraud below, which re-fires
    // this function — skip when the inputs that drive the signals are unchanged.
    const inputsHash = sha(`${idNumber}|${idPhotoPath}`);
    const prevFraud = v.fraud as AnyDoc | undefined;
    if (prevFraud?.inputsHash === inputsHash) return;

    const db = getFirestore();
    const fraud: AnyDoc = { inputsHash, ran: Date.now() };

    if (idNumber.length === 13) {
      // Duplicate-ID index (hash only — the index never holds raw numbers).
      const ref = db.collection("idIndex").doc(sha(idNumber));
      await ref.set({ uids: FieldValue.arrayUnion(uid), updatedAt: Date.now() }, { merge: true });
      const snap = await ref.get();
      const others = ((snap.data()?.uids ?? []) as string[]).filter((u) => u !== uid);
      fraud.duplicateIdUids = others;

      const age = ageFromIdNumber(idNumber);
      fraud.idAge = age;
      fraud.idUnder18 = age !== null && age < 18;

      if (others.length) {
        logger.warn("Duplicate ID number across accounts", { uid, others });
      }
    }

    // OCR cross-check — images only (Vision sync text detection can't read PDFs).
    if (idPhotoPath && idNumber.length === 13) {
      if (/\.pdf$/i.test(idPhotoPath.split("?")[0])) {
        fraud.ocr = { forPath: idPhotoPath, skipped: "pdf" };
      } else {
        try {
          const bucket = getStorage().bucket().name;
          const [res] = await visionClient.textDetection(`gs://${bucket}/${idPhotoPath}`);
          const text =
            res.fullTextAnnotation?.text ?? res.textAnnotations?.[0]?.description ?? "";
          const idNumberFound = text.replace(/\D/g, "").includes(idNumber);
          // Compare against the account's display name (public doc).
          const pub = await db.doc(`users/${uid}`).get();
          const name = String((pub.data() as AnyDoc | undefined)?.displayName ?? "");
          const tokens = name.toLowerCase().split(/\s+/).filter((t) => t.length >= 3);
          const lower = text.toLowerCase();
          const nameTokensFound = tokens.filter((t) => lower.includes(t)).length;
          fraud.ocr = {
            forPath: idPhotoPath,
            idNumberFound,
            nameTokens: tokens.length,
            nameTokensFound,
            textChars: text.length,
          };
        } catch (err) {
          fraud.ocr = { forPath: idPhotoPath, error: String(err).slice(0, 200) };
        }
      }
    }

    await event.data!.after.ref.set({ verification: { fraud } }, { merge: true });
  },
);

export const onUserBanRegistry = onDocumentWritten("users/{uid}", async (event) => {
  const before = event.data?.before.data() as AnyDoc | undefined;
  const after = event.data?.after.data() as AnyDoc | undefined;
  const uid = event.params.uid;
  const db = getFirestore();

  const identifiers = (d: AnyDoc | undefined): Array<[string, string]> => {
    const out: Array<[string, string]> = [];
    const email = String(d?.email ?? "").trim().toLowerCase();
    const phone = String(d?.phone ?? "").trim();
    if (email) out.push(["email", email]);
    if (phone) out.push(["phone", phone]);
    return out;
  };

  // New sign-up → check identifiers against the banned index.
  if (!before && after) {
    if (after.role === "admin") return;
    const hits: string[] = [];
    for (const [kind, val] of identifiers(after)) {
      const snap = await db.collection("bannedIndex").doc(sha(`${kind}:${val}`)).get();
      if (snap.exists) hits.push(kind);
    }
    if (hits.length) {
      await db
        .doc(`users/${uid}/private/profile`)
        .set({ verification: { fraud: { banMatch: hits, banMatchAt: Date.now() } } }, { merge: true });
      logger.warn("New signup matches banned identifiers", { uid, hits });
    }
    return;
  }

  // Suspension transitions maintain the index. (Rejected users may fix docs
  // and return — only suspension means "keep them out".)
  if (!after) return;
  const was = before?.accountStatus;
  const now = after.accountStatus;
  if (was === now) return;
  if (now === "suspended") {
    for (const [kind, val] of identifiers(after)) {
      await db.collection("bannedIndex").doc(sha(`${kind}:${val}`)).set({ kind, uid, at: Date.now() });
    }
    logger.info("Registered suspended account identifiers", { uid });
  } else if (was === "suspended") {
    for (const [kind, val] of identifiers(after)) {
      await db.collection("bannedIndex").doc(sha(`${kind}:${val}`)).delete().catch(() => {});
    }
    logger.info("Cleared identifiers after reinstatement", { uid });
  }
});

export const onVerificationFileDuplicate = onObjectFinalized(
  { region: "africa-south1", memory: "256MiB", timeoutSeconds: 60 },
  async (event) => {
    const filePath = event.data.name ?? "";
    if (!filePath.startsWith("verification/")) return;
    const uid = filePath.split("/")[1];
    const md5 = event.data.md5Hash;
    if (!uid || !md5) return;

    const db = getFirestore();
    const ref = db.collection("fileIndex").doc(sha(md5));
    await ref.set(
      { entries: FieldValue.arrayUnion({ uid, path: filePath }), updatedAt: Date.now() },
      { merge: true },
    );
    const snap = await ref.get();
    const entries = (snap.data()?.entries ?? []) as Array<{ uid: string; path: string }>;
    const others = entries.filter((e) => e.uid !== uid);
    if (others.length === 0) return;

    await db.doc(`users/${uid}/private/profile`).set(
      {
        verification: {
          fraud: {
            duplicateFiles: FieldValue.arrayUnion({ path: filePath, matchesUid: others[0].uid }),
          },
        },
      },
      { merge: true },
    );
    logger.warn("Verification file byte-identical to another account's", {
      uid,
      filePath,
      others: others.map((o) => o.uid),
    });
  },
);
