# Workit — Launch-Readiness Brief

_Last updated: 2026-06-06. Owner: Tshepo M (Furthersky Solutions)._

Purpose: get Workit safe and defensible before real strangers use it — workers
enter homes/businesses and you store sensitive ID data, so the bar is real.

> ⚠️ Not legal advice. The "needs an attorney" items below must be signed off by
> a qualified South African attorney before serious launch volume.

---

## ✅ Strong baseline (already in place)

- **Terms of Use** — genuinely thorough: independent-contractor classification
  (§3.1/3.2), domestic-worker exception (§3.3), worker tax/SARS (§6.1),
  UIF/COIDA disclaimers (§6.2), liability + CPA (§11), indemnity (§12), governing
  law (§14). Carries a clear "lawyer-review pending" banner + clause TODOs.
- **Privacy Policy** — POPIA-aligned: what's collected, purpose, who sees what,
  region (africa-south1), retention periods, data-subject rights, named
  Information Officer.
- **Acceptable Use Policy** + cookie banner present.
- **Storage rules** — verification docs (`/verification/{uid}`) are owner+admin
  only; avatars/portfolio/job photos public by design; catch-all denies the rest.
- **Firestore rules** — admin-gated, self-only profile writes, protected fields
  (role, verification, account status, rating) locked, catch-all deny.
- **POPIA mechanics** — in-app data export + account-deletion request queue;
  signup requires accepting Terms + Privacy (enforced).
- **Safety** — SAPS emergency button, opt-in live location, worker verification,
  two-sided ratings, reporting, moderation (Vision SafeSearch + text screen +
  zero-tolerance CSAM path), blocking, dispute system.

This is well ahead of a typical MVP. The work below is closing gaps, not building.

---

## Gaps — prioritized

### P0 — before onboarding real users
1. **Attorney sign-off on Terms + Privacy.** Already flagged in `terms/page.tsx`.
   Clauses to review: §3.1/3.2 (contractor + the SA 5-factor reality test),
   §6 (tax/SARS), §11 (CPA limitation of liability), §12/13 (indemnity scope &
   enforceability); Privacy retention + cross-border transfer wording; lawful
   basis for special personal information (ID numbers). _Legal — yours._
2. **Register the Information Officer with the Information Regulator.** POPIA
   requires the IO (you) to be *registered* via the Regulator's portal — naming
   them in the policy isn't enough. _Operational — yours._
3. **Explicit consent at verification upload.** Today there's no consent step
   when a worker submits ID number + ID photo + selfie video (special personal
   info under POPIA s26/s27). Add a required checkbox + record `consentAt` on the
   verification record. _Code — small._
4. **Record signup consent.** The checkbox is enforced but not stored. Persist
   `termsAcceptedAt` + a terms/privacy `version` on the profile as proof of
   consent. _Code — small._

### P1 — at / just after launch
5. **Automated erasure on deletion.** Privacy policy promises verification docs
   "deleted within 30 days of account deletion," but deletion is a manual queue
   and Storage objects must be purged by hand. Add a Cloud Function that, when a
   deletion request is actioned, purges `/verification/{uid}` + `/avatars/{uid}`
   from Storage and scrubs/anonymises the profile (retaining only what the 5-year
   dispute record needs). _Code — medium._
6. **Deletion runbook.** Written steps: what to delete now, what to retain for
   the stated 5-year dispute/legal record, how to anonymise references on jobs.
   _Doc._
7. **Sentry PII scrub.** Confirm error payloads don't carry emails/ID numbers;
   add a `beforeSend` scrubber if they do. _Code — small._

### P2 — later
8. ~~**Retention enforcement**~~ ✅ **Done 2026-06-13** — `scheduledRetentionCleanup`
   (`functions/src/retention.ts`) runs monthly and purges terminal jobs
   (confirmed/cancelled) + their messages/offers after 5 years of no activity;
   never touches active or disputed jobs. Decision logic unit-tested (14/14).
   No-op until records age past 5 years — enforcement is now live, not just stated.
9. **Insurance posture** — decide on personal-accident / public-liability cover
   messaging; the Terms already disclaim COIDA. _Business — yours._
10. **DMARC `p=quarantine` → `p=reject`** (already in BACKLOG).
11. **Abuse / rate-limit review** at scale (basic limits exist in `rateLimit.ts`).

---

## Attorney packet (hand this over)
- `src/app/terms/page.tsx` — clauses §3.1, §3.2, §3.3, §6.1, §6.2, §11, §12, §14.
- `src/app/privacy/page.tsx` — retention table, cross-border transfer paragraph,
  special-personal-information (ID/selfie) lawful basis.
- `src/app/acceptable-use/page.tsx`.
- Question for counsel: is the indemnity (§12) enforceable against consumers
  under the CPA, and does the contractor framing survive the SA reality test?

## Go / no-go checklist
- [ ] Terms + Privacy reviewed by an SA attorney
- [ ] Information Officer registered with the Information Regulator
- [x] Verification consent step live (P0-3) — ✅ 2026-06-06
- [x] Signup consent recorded (P0-4) — ✅ 2026-06-06 (`termsAcceptedAt` + version)
- [x] Erasure-on-deletion automated + runbook written (P1-5/6) — ✅ 2026-06-10
      (`eraseUserData` callable + admin "Deletion requests" panel on the Users
      tab + `DELETION_RUNBOOK.md`)
- [x] Sentry PII scrub confirmed (P1-7) — ✅ 2026-06-10 (breadcrumb query-string
      strip — Storage tokens — + email scrub in error text)
- [ ] Decision recorded on insurance posture
