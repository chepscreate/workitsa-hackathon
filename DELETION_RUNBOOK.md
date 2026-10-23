# Workit — Account Deletion Runbook (POPIA)

_How a deletion request is actioned. Updated 2026-06-10._

## The promise we're honouring
- Privacy Policy: account profile deleted on request; **verification documents
  deleted within 30 days** of account deletion; **job + message history kept
  5 years** for dispute resolution / legal record-keeping.
- Internal SLA: action requests within **7 days** (stated on /how-it-works FAQ).

## How requests arrive
Users tap **Profile → Your data rights → Request account deletion**. That writes
a `deletionRequests/{id}` doc (`status: "pending"`). They are surfaced in
**/admin → Users tab** — a red "⚠ Deletion requests" panel appears whenever any
are pending.

## How to action one (the whole flow is one button)
1. Open **/admin → Users**.
2. In the red panel, optionally click the name to review the profile.
3. Click **Erase account** → read the confirm → **Yes, erase permanently**.
4. Done. The `eraseUserData` Cloud Function performs, in order:
   - **Storage wiped:** `verification/{uid}/`, `avatars/{uid}/`, `portfolio/{uid}/`
     (ID photo, selfie video, address proof, clearance, profile + portfolio media).
   - **Firestore wiped:** `users/{uid}/private/profile` (DOB, exact home, ID number)
     and the `saved`, `searches`, `templates`, `fcmTokens`, `leads` subcollections.
   - **Profile anonymised:** the public `users/{uid}` doc is REPLACED with a
     tombstone — `displayName: "Deleted user"`, role, `deletedAt`, nothing else.
   - **Auth deleted:** the Firebase Auth account is removed (sign-in impossible).
   - **Request closed:** `status: "completed"` + who/when; any partial failures
     are recorded on the request doc (`issues`) and flagged in the admin UI.
   - **Audit entry:** `account_erased` appears in the Audit log.

## What is deliberately KEPT (the 5-year record)
- **Jobs** the user posted or worked (incl. their denormalised name on those
  docs), messages, offers, ratings, disputes — retained for dispute resolution
  and legal record-keeping per the privacy policy, then eligible for cleanup.
- **auditLog** entries and the closed `deletionRequests` doc (proof the request
  was honoured — POPIA compliance evidence).

## Safety properties
- Erasure is **callable-only** (explicit admin action + typed confirmation);
  it can never fire as a side effect.
- The function refuses to erase **admin accounts** or **the acting admin**.
- Idempotent-ish: re-running on a completed request is rejected.

## Edge cases
- **"Erased with N issue(s)"** in the UI → open the request doc in Firestore
  Console; the `issues` array says which step failed (usually a Storage prefix);
  fix manually (Storage console → delete folder) and note it on the doc.
- **User asks to undo:** not possible (and that's the point) — they can sign up
  fresh. Their old jobs remain attributed to "Deleted user".
- **User emails instead of using the app:** create the request on their behalf —
  verify it's really them (reply-to-the-registered-email test) — then have them
  confirm in writing before erasing.
