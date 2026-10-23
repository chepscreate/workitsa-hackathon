# Workit — Security Audit (2026-06-08)

Manual review of Firestore/Storage rules, Cloud Functions, auth, and the client.
Severity: 🔴 high · 🟠 medium · 🟡 low · ✅ verified-good.

---

## 📌 OPEN ITEMS — re-verified 2026-07-06 (founder asked to note these; return to them)

Fresh code-level re-check of rules + functions on 2026-07-06. The data layer is
tight (default-deny, trust signals server-only, PII in private subcollection,
2FA-gated destructive callables). What remains is the **abuse/edge layer**:

1. 🟠 **No App Check anywhere + `requestPasswordReset` has no rate limit**
   (`functions/src/authEmails.ts:32-63`). Public unauthenticated callable —
   anyone with the (necessarily public) Firebase web config can script it:
   SendGrid budget burn, or email-bombing a victim's inbox. **Fix (small):**
   per-email + per-IP throttle doc in Firestore; then enable App Check
   (reCAPTCHA v3/Enterprise) and enforce on callables. *Do before marketing
   pushes draw attention.*
2. 🟠 **`email` + `phone` world-readable to signed-in users** on `users/{uid}`
   (accepted 2026-06-10 with eyes open — counterparty-contact UX depends on it).
   Mass-harvest is possible for any signed-in account. Revisit before scale
   (move to private doc + mint-on-demand callable for active counterparties).
3. 🟡 **Storage `jobs/{jobId}/…` writable by any signed-in user** (not just the
   job's participants). Cost/abuse vector only — files are inert unless
   referenced by the job doc. Tighten to employer + assigned worker.
4. 🟡 **`assignedAt` not in the job-update blacklist** (`firestore.rules`
   job-update rule) — employer could skew the admin-only time-to-fill metric.
5. ⬜ **External penetration test** before province-wide scale — everything
   above is internal review; no third-party audit has been done
   (LAUNCH_READINESS item).

---

## 🔴→✅ HIGH — Trust signals were client-forgeable (sweep 2026-06-17)

**Status: FIXED 2026-06-17.** A sweep found that the marketplace's core trust
signals — ratings, reputation badges, worker levels, prices — could be
fabricated by the user they describe. In a trust-first marketplace this is the
highest-severity class. Root cause + fixes:

- **Rating self-authorship.** The `jobs/{id}` update rule let the assigned
  worker write *any* field on their job, and `onJobRatingWritten` was a
  background trigger with **no auth context** — it credited whoever wrote
  `employerRating`. A worker could write their own 5-star and bank it. **Fix:**
  deleted the trigger; ratings now go through a **`submitRating` callable** that
  verifies the caller's role from their auth token, requires the work to be
  confirmed, and writes the rating + `ratingAvg`/`ratingCount` atomically in one
  transaction (single + crew). The callable is the only writer of reputation, so
  a stray rating field on a job doc is inert.
- **Badge/level farming.** `referralsCount`, `jobsCompleted`, `jobsCancelled`
  were missing from the forbidden-self-keys list → settable to anything (fake
  Connector/Ambassador + experience level). **Fix:** added all three to the
  forbidden list; the referral +1 branch now requires `request.auth.uid != uid`.
- **Price/status tampering.** The assigned worker could change `agreedPrice` /
  `suggestedPrice` / ownership fields / author `employerRating`; the employer
  could author `workerRating`. **Fix:** per-actor field guards on the job-update
  rule.
- **Offer self-accept.** A worker could set their own offer `status:"accepted"`.
  **Fix:** the offer's worker may only transition it to `withdrawn`.
- **Dormant counter (correctness, not exploit).** `jobsCompleted` was never
  incremented anywhere, so worker levels/badges/sorting were stuck at 0. **Fix:**
  new `onJobConfirmedCountWork` trigger increments it as each slot is confirmed.

Rules regression suite +10 → **68 tests**, all green. Residual (accepted, low):
a crew worker can write a *cosmetic* rating field into their own roster entry,
but with the trigger gone it never affects the real aggregate.

## 🟡 Low — Storage `jobs/{jobId}` writable by any signed-in user
**Status: noted 2026-06-17 (not yet changed).** `storage.rules` lets any
signed-in user upload to `jobs/{jobId}/…` (15 MB images/video), not just the
job's participants. Minor cost/abuse vector — an uploaded file is inert unless
referenced from the job doc (which the job-update rules control). Tighten to
employer + assigned worker when convenient.

---

## 🔴→✅ HIGH — User profiles exposed sensitive PII + ID documents

**Status: Phase A FIXED 2026-06-08.** The verification payload (ID number + all
document URLs + address + skills) now lives in `users/{uid}/private/profile`,
readable only by owner + admin (rules enforced). Client merges it back for the
owner; admin review fetches it by uid; existing data moved by the
`migrateVerificationToPrivate` migration. The stranger-can-view-your-ID hole is
closed.
**Phase B FIXED 2026-06-10:** exact `homeLat/Lng` (+accuracy/pinnedAt) and
`dateOfBirth` now live in the private doc too. Public doc carries only derived
values: `approxLat/approxLng` (~1 km rounding, feeds the workers-directory
distance) and `birthYear` (feeds the public age display). Owner reads merge from
private (AuthContext); POPIA export includes the private fields; migration
extended (same admin "Run migration" button — re-run it after this deploy).
**Still public (accepted for now):** `email`, `phone` — harvestable by signed-in
users; moving them breaks the admin Users list + counterparty contact UX, so
deferred with eyes open. Revisit before scale.

---

### Original finding (for the record)
## 🔴 HIGH — User profiles are world-readable → sensitive PII + ID documents exposed

**What:** `match /users/{uid} { allow read: if isSignedIn(); }` lets **any signed-in
user read any other user's full profile document.** That document contains:
- `verification.idNumber` — the person's **SA ID number**
- `verification.idPhotoURL`, `selfieVideoURL`, `addressProofURL`,
  `policeClearanceURL` — these are **`getDownloadURL` tokenised links**, which
  **bypass Storage security rules** (the token in the URL grants access regardless
  of the owner+admin Storage rule). So a stranger can open someone's **ID photo,
  selfie video, proof of address, and police clearance.**
- `homeLat` / `homeLng` — **home GPS coordinates** (stalking / safety risk,
  especially for workers).
- `dateOfBirth`, `email`, `phone`, `businessVerification.registrationNumber`.

**Impact:** Any registered user can query `users/{anyUid}` via the SDK/REST and
harvest the above. Directly contradicts the Privacy Policy ("verification docs:
only you and Workit admins") and is a serious **POPIA** breach (special personal
information). **This is a launch blocker.**

**Fix (recommended):** split sensitive fields into a private subcollection
`users/{uid}/private/data`, readable only by owner + admin. The public `users/{uid}`
doc keeps only public fields (displayName, photoURL, role, suburb/city/province,
ratings, badges, business public fields, referralCode, tagline, portfolio,
availableNow). Move out: the whole `verification` object, `homeLat/Lng/Accuracy`,
`dateOfBirth`, and ideally `email`/`phone`. Requires a one-off migration of
existing docs. (Phase A: verification + home + DOB — the crown jewels. Phase B:
email/phone.)

---

## 🟠→✅ MEDIUM — Business "express interest" email-spam abuse — FIXED 2026-06-10

`onBusinessLeadCreated` now (1) deletes any lead whose target isn't a business
(no notification), and (2) dedupes — a second lead from the same worker to the
same business is deleted silently. Spam amplification path closed.

### Original finding (for the record)
The lead-create rule only checked `workerUid == auth.uid` + the path; no
target-role check, no dedupe → repeated emails to arbitrary users.

## 🟠→✅ MEDIUM — Permanent verification-doc URL tokens — FIXED 2026-06-10

New verification uploads persist the **Storage path** instead of a tokenised
download URL. The `getVerificationPayload` callable (owner or admin only) mints
**~15-minute signed URLs** on demand for the admin review + the worker's own
resubmission previews — a leaked link now dies in minutes. Legacy URL values
pass through until the worker next resubmits. (IAM: functions SA granted
`serviceAccountTokenCreator` on itself for signBlob.)

## 🟡→✅ LOW — Job social-proof bumping — TIGHTENED 2026-06-10

The counter-bump rules branch now requires an **approved account**, allows
`offerCount`/`messageCount` to move **up by at most 1 per write**, and caps
`offerWorkerPhotos` at 8 entries. Bulk inflation closed.

## 🟡 LOW — Fast-track signup widens the spam-account surface

Auto-approving employers/businesses means spam job-posters don't hit a human gate.
Mitigated by server-side job moderation (text screen + first-post review) + rate
limiting, so acceptable — but watch the moderation queue once you're public.

---

## ✅ Verified-good (no action)
- Catch-all `match /{document=**} { allow read, write: if false; }` — solid default-deny.
- Admin-only collections (auditLog, moderation, moderationLog) locked; server-only writes enforced.
- `reports`, `deletionRequests` validate `reporterId/uid == auth.uid`; no deletes (audit trail).
- Storage: the actual verification **files** are owner+admin only (the leak is via the
  tokenised URLs in Firestore, see HIGH/MEDIUM, not the Storage rule itself).
- **Jarvis** is admin-gated (server-side role re-check) on the dashboard; **WhatsApp**
  webhook verifies the HMAC signature AND owner-locks the sender; actions require
  explicit confirmation + are audit-logged.
- API keys (Gemini, SendGrid, WhatsApp) are **Secret Manager secrets**,
  never shipped to the client. Only the public Firebase web config is in the client (expected).
- **No open redirect** — `signin` ignores the `next` param (always → /account).
- **No XSS sink** — no `dangerouslySetInnerHTML` on user content (only static JSON-LD);
  React escapes by default; email HTML (digest, leads) escapes user input.
- Signup consent + verification consent recorded; POPIA export + deletion-request flow exist.

---

## Priority order
1. 🔴 Move sensitive fields to a private subcollection (Phase A: verification +
   home GPS + DOB). **Do before real users.**
2. 🟠 Harden `onBusinessLeadCreated` (business-only + dedupe).
3. 🟠 Signed URLs for verification docs (instead of permanent tokens).
4. 🟡 Tighten job social-proof writes; watch moderation queue post-launch.
