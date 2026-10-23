# Workit — Changelog

## 2026-10-24 (WhatsApp — cold notifications via approved templates)

### Added — offer_accepted template wiring
`onOfferResolvedWhatsApp` now sends the approved `offer_accepted` template to the
worker when their offer is accepted **outside** the 24h window (previously
cold-skipped); in-window still uses free text, and cold rejections are still
skipped. Pairs with the already-wired `offer_received` (cold employer notice).
Both templates (`offer_received`, `offer_accepted`, Utility, en) submitted to
Meta for approval; cold sends start working once approved. tsc clean;
`onOfferResolvedWhatsApp` deployed.

## 2026-10-23 (WhatsApp onboarding — respect account approval + verification)

### Fixed — onboarded workers are no longer auto-approved
The first cut created WhatsApp-onboarded workers as `accountStatus: "approved"`,
which bypassed the account-approval + verification gates (anyone who texts in
became a matchable, approved worker). Now in
[whatsappJobChannel.ts](workit/functions/src/whatsappJobChannel.ts):
- `createWhatsAppWorker` creates them **`pending`** (and `availableNow:false`), so
  they land in the **Account approvals** queue like app signups and get **no job
  alerts** until an admin approves them (`onJobVisibleWhatsAppAlert` already
  requires `accountStatus === "approved"`).
- **Approval gate** in `handleWhatsAppJobReply`: offering (`1`/`ACCEPT`/`OFFER`)
  and `AVAILABLE` return an "under review" message for non-approved workers;
  `JOBS` browsing, `HELP`, `STOP` and safety (`SOS`/`REPORT`) stay open.
- Welcome message reworded to "under review / finish verification to speed it up."

Verified live end-to-end first (Simphiwe onboarded over WhatsApp: name → area →
skills → POPIA consent → registered), which surfaced the auto-approve gap.
tsc clean; `jarvisWhatsApp` deployed.

## 2026-10-23 (WhatsApp — app-less worker onboarding)

### Added — register as a worker entirely over WhatsApp (no app, no data)
A jobseeker who has never used Workit can now join over WhatsApp. An unknown
number texting an opening word (`hi`, `work`, `join`, `jobs`, `start`…) enters a
short guided flow — **name → area → work types (numbered) → POPIA consent** —
and on `YES` a worker record is created and they immediately start receiving job
alerts. In [whatsappJobChannel.ts](workit/functions/src/whatsappJobChannel.ts):
- **`handleOnboarding`** — a state machine stored in `waOnboarding/{number}`
  (idempotent per messageId; `STOP` cancels any time). Runs when
  `lookupWorkerByWa` finds no user; non-onboarding messages from strangers still
  fall through to support unchanged.
- **`createWhatsAppWorker`** — writes `users/wa_<number>` (role worker, account
  `approved` so matching works at once, `verificationStatus:"none"` so employers
  still see them as unverified until they finish ID verification on the web;
  categories mapped to the canonical `CATEGORIES`; area distance-matched via a
  Gauteng suburb→coords map, else city/province). Opens their 24h window and
  nudges them to verify for the trusted badge.
- Entry of `handleWhatsAppJobReply` restructured: lookup first, then onboarding
  for unknown numbers, then the existing known-user command flow.

This is the lowest-friction possible on-ramp to work — the core of the Youth
Employment & Work Readiness challenge. tsc clean; `jarvisWhatsApp` deployed.

## 2026-10-23 (WhatsApp — HELP / MENU command)

### Added — self-serve command menu
So a user who doesn't know what to text gets their options, `handleWhatsAppJobReply`
now recognises **`HELP` / `MENU` / `options` / a greeting (`hi`, `hello`, `hey`,
`howzit`)** and replies with a role-aware list of commands — the worker menu
(JOBS / number to offer / AVAILABLE / START / DONE / REPORT / SOS / STOP) or the
employer menu (OFFERS / ACCEPT n / DECLINE n / STOP). Works as a free-text reply
inside the 24h window — no Meta template approval needed. SOS's "help me" is still
matched first, so safety wins. Job alerts now also mention "*HELP* for options".
tsc clean; `jarvisWhatsApp` deployed.

## 2026-10-23 (WhatsApp — employers accept/decline offers over WhatsApp)

### Added — employer side of the WhatsApp loop
Employers can now hire entirely over WhatsApp, closing the two-sided loop
(worker offers over WhatsApp → employer accepts over WhatsApp).
In [whatsappJobChannel.ts](workit/functions/src/whatsappJobChannel.ts):
- **`onOfferCreatedNotifyEmployerWhatsApp`** (new trigger, exported in
  [index.ts](workit/functions/src/index.ts)) — when a worker makes an offer, the
  employer (if WhatsApp-opted-in) gets a WhatsApp notice. In-window → free text
  with the `OFFERS` prompt; cold → `offer_received` template (⚠ to be submitted
  for approval).
- **Employer commands in `handleWhatsAppJobReply`** — messages from an
  employer-side user route to a new `handleEmployerReply`:
  - **`OFFERS`** — lists their pending offers, numbered, and remembers the list.
  - **`ACCEPT n`** — hires offer #n via `acceptOfferServer` (mirrors the
    single-worker path of `lib/jobs.ts` acceptOffer: assigns the job, sets
    `agreedPrice` + `requireStartPin`, auto-rejects the other pending offers).
    Setting the offer to `accepted` fires the existing `onOfferResolvedWhatsApp`
    (worker is WhatsApp'd) + `onOfferAccepted` email/push. Crew jobs defer to the app.
  - **`DECLINE n`** — rejects offer #n. Accept requires an explicit `ACCEPT`/`HIRE`
    word so a stray "ok"/"yes" can never hire by accident.
- **Opt-in UI** — `WhatsAppJobAlertsCard` gained an `employer` variant (new
  `waalerts.*Employer` keys in en/af/zu); rendered in the employer account section.

tsc clean (app + functions); production build clean.

## 2026-10-20 (WhatsApp — offer feedback + quote-tolerant pricing)

### Fixed — counter-offer price ignored when wrapped in quotes
`3 "800"` (quotes copied from the footer's `"1 400"` example) parsed the job pick
but dropped the price, so the offer fell back to the suggested price. The `NUMBER`
and `OFFER` regexes now tolerate spaces, straight and curly quotes between the
index and the price; the `JOBS` footer no longer shows literal quotes.

### Added — employer accept/reject reaches the WhatsApp worker
New `onOfferResolvedWhatsApp` ([whatsappJobChannel.ts](workit/functions/src/whatsappJobChannel.ts),
exported in [index.ts](workit/functions/src/index.ts)): when an offer goes
`pending → accepted` or `pending → rejected`, the worker (if WhatsApp-opted-in +
in the 24h window) gets a WhatsApp reply — accepted prompts START/DONE, rejected
points them back to `JOBS`. Closes the loop for app-less workers who only had the
in-app push before. tsc clean; `jarvisWhatsApp` + `onOfferResolvedWhatsApp` deployed.

## 2026-10-20 (WhatsApp Job Channel — negotiation + safety commands)

### Added — worker commands (reuse existing backend; one deploy)
In [whatsappJobChannel.ts](workit/functions/src/whatsappJobChannel.ts) `handleWhatsAppJobReply`:
- **`OFFER 400`** (or **`1 400`**) — counter-offer at a custom price instead of the
  suggested one. `createWhatsAppOffer` gained a `priceOverride`; the offer records a
  counter message.
- **`AVAILABLE`** — sets the worker `availableNow` flag (+8h) so they rank higher.
- **`SOS` / `HELP ME`** — writes a fresh `emergency` on the worker's active job →
  fires the existing `onJobEmergencyAlert` (admin push + founder email). Reply tells
  them to call SAPS 10111 and share location.
- **`REPORT …`** — files a doc in the `reports` collection → fires the existing
  `onReportCreated` (admin). 
- **Location check-in** — `jarvisWhatsApp` now passes WhatsApp **location** messages
  (not just text) to the handler; a shared location is saved as `lastCheckIn` on the
  active job, and attaches coordinates to an active SOS (without re-firing it). `START`
  now prompts for a location share + mentions `SOS`.
- tsc (functions) clean. Deployed `jarvisWhatsApp` (bundles the handler).
- Still to come (Batch B): employer-accepts-over-WhatsApp, WhatsApp-only onboarding.

## 2026-10-20 (WhatsApp proof-of-work — Work Record on job confirmation)

### Added — employment → work readiness (hackathon Tier 2)
- When a job is **confirmed**, `onJobConfirmedWhatsAppRecord`
  ([whatsappJobChannel.ts](workit/functions/src/whatsappJobChannel.ts)) refreshes
  the worker's **Work Record** and WhatsApps them the shareable
  `/record?t={token}` link — "proof of work to share with landlords, lenders or
  employers." Gated on WhatsApp opt-in + an open 24h session (free-text only, no
  template). Directly ties the employment loop to work-readiness.
- Refactored [workRecord.ts](workit/functions/src/workRecord.ts): extracted
  `upsertWorkRecord(uid, {rotate})` (server-side builder) now shared by the
  `generateWorkRecord` callable and the new trigger. Callable behaviour unchanged.
- tsc clean. **Deployed** ✅ `onJobConfirmedWhatsAppRecord` + `generateWorkRecord`.

## 2026-10-20 (WhatsApp Job Channel — free-text fallback + JOBS pull)

### Added — works before template approval + worker-initiated job search
- **Free-text fallback** in `onJobVisibleWhatsAppAlert`
  ([whatsappJobChannel.ts](workit/functions/src/whatsappJobChannel.ts)): if a
  worker has messaged the number in the last 24h (open WhatsApp session), the job
  alert goes out as **plain text with full detail** (free, no template); only
  *cold* workers get the `job_alert` template. So the live demo works even while
  the template is still "in review" — the worker just texts the number once.
  Any inbound from a known worker records `lastInboundAt` to open that window.
- **`JOBS` / `WORK` pull command** — a worker texts `JOBS` and gets a numbered
  list (top 5) of open jobs matching their category + area (reverse of the alert
  matching), then replies with the number to send an offer. Worker-initiated
  access, no template needed. Numeric replies are list-aware; `1`/`ACCEPT` still
  maps to the last single alert.
- Opt-in card copy (en/af/zu) now mentions texting `JOBS`.
- tsc (app + functions) + build clean. **Deployed** ✅ `jarvisWhatsApp` +
  `onJobVisibleWhatsAppAlert` + hosting.

## 2026-10-19 (WhatsApp Job Channel — folded into the Jarvis webhook + shipped)

### Re-architected & deployed
Setting up the Meta webhook revealed the "separate test app" is actually the
**same app already running Jarvis + support** — and Meta allows only one callback
URL per number, so a second webhook would have broken Jarvis. Changed course:
- Dropped the standalone `whatsappJobWebhook` (deployed then **deleted**). Inbound
  worker replies now run **inside `jarvisWhatsApp`**: new
  `handleWhatsAppJobReply()` in [whatsappJobChannel.ts](workit/functions/src/whatsappJobChannel.ts)
  is called from the non-owner branch BEFORE the support fallback — a known
  opted-in worker's keyword (`1`/`ACCEPT`/`START`/`DONE`/`STOP`) is handled;
  anything else returns false and falls through to support unchanged. Wrapped in
  try/catch so the job path can never break support. Owner → Jarvis path untouched.
- `onJobVisibleWhatsAppAlert` now sends the `job_alert` template from the
  **production number** (`WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID`, shared with
  Jarvis) — one consistent number per worker, no 5-recipient test cap.
- **Deployed** ✅ `jarvisWhatsApp` + `onJobVisibleWhatsAppAlert` (africa-south1);
  `whatsappJobWebhook` deleted. tsc clean. **No Meta webhook change needed** — the
  existing Jarvis callback URL already receives everything.
- Remaining founder action: approve the `job_alert` template (production WABA).
  The 3 `WHATSAPP_JOB_*` secrets are now unused (harmless). Updated setup doc:
  `Documents/WorkitSA - WhatsApp Job Channel - Setup & Templates.md`.

## 2026-10-18 (WhatsApp Job Channel — low-data access to work)

### Built — WhatsApp job alerts + reply flow (hackathon feature)
The youth-employment hackathon feature: workers get job alerts over WhatsApp and
can offer/start/finish by replying — no app, low data. Runs on a **separate Meta
test app** (phone-number-ID 1124501730748959), fully isolated from the production
Jarvis + support number so it can never collide with that single webhook.
- New [functions/src/whatsappJobChannel.ts](workit/functions/src/whatsappJobChannel.ts):
  - `onJobVisibleWhatsAppAlert` — Firestore trigger mirroring [jobAlerts.ts](workit/functions/src/jobAlerts.ts)
    matching (category + 25 km / city / province), but only to **opted-in, verified**
    workers with a confirmed WhatsApp number. Sends the `job_alert` **template**
    (business-initiated → template required). Records `waJobThreads/{wa}` so a bare
    `1`/`ACCEPT` reply maps to the right job.
  - `whatsappJobWebhook` — GET verify-token handshake, POST verifies
    `X-Hub-Signature-256`, **idempotent on message ID** (`waJobInbox/{id}`). Routes
    worker replies: `1`/`ACCEPT` → write a normal offer (so `onOfferCreatedPush` /
    email / funnel fire unchanged), `START` → in_progress, `DONE` → completed,
    `STOP` → opt out. Replies are free-text inside the 24 h window (free, no template).
  - Own secret set (`WHATSAPP_JOB_TOKEN`, `WHATSAPP_JOB_APP_SECRET`,
    `WHATSAPP_JOB_VERIFY_TOKEN`) — does **not** touch the Jarvis secrets.
- Worker opt-in UI: new [WhatsAppJobAlertsCard.tsx](workit/src/components/WhatsAppJobAlertsCard.tsx)
  in the worker [account page](workit/src/app/account/page.tsx) — toggle = POPIA
  consent (timestamped), number confirmation, number stored normalised (27…).
  Added `waalerts.*` keys (en + af/zu drafts). New `UserProfile` fields
  `whatsappJobOptIn` / `whatsappNumber` / `whatsappConsentAt` / `whatsappOptOutAt`
  (non-protected → existing rules already allow self-update; no rules change).
- Privacy: messages carry only title, category, suburb/city, budget — never ID
  numbers, exact addresses or customer phone numbers.
- tsc (app + functions) + build clean. **Not yet deployed** — gated on the founder
  setting the 3 secrets (Meta token pasted by hand) and approving the 3 templates.
  Setup steps + templates + test checklist: `Documents/WorkitSA - WhatsApp Job Channel - Setup & Templates.md`.

## 2026-10-14 (i18n — translate the site properly, Phase 1 begins)

### Diagnosed — language switcher works, but coverage was ~8%
Only 11 of ~148 components used `useTranslation()`; everything else was hardcoded
English, so picking Afrikaans/isiZulu only changed the home/header/footer/find-work/
post-a-job areas. Plan: phase it — **Phase 1** public + onboarding pages, **Phase 2**
core app, **Phase 3** admin last. af/zu strings are drafts flagged for native review.

### Translated — How it works (Phase 1, page 1)
- Split [how-it-works/page.tsx](workit/src/app/how-it-works/page.tsx) into a thin
  server page (keeps SEO metadata) + new client [HowItWorksContent.tsx](workit/src/app/how-it-works/HowItWorksContent.tsx)
  that flows every string through `t()`. Rich bodies flattened to plain strings;
  inline links preserved as trailing translated links (Step/Card gained an optional `link`).
- Added ~60 `hiw.*` keys to the [Messages type](workit/src/i18n/locales.ts) +
  [en](workit/src/i18n/messages/en.ts) / [af](workit/src/i18n/messages/af.ts) /
  [zu](workit/src/i18n/messages/zu.ts) (af + zu are **review-pending drafts**).
- Verified in preview: the full page renders in English, Afrikaans **and** isiZulu.
  tsc + build clean, **deployed** ✅ hosting.
- Remaining Phase 1: sign in/up, verification, safety, account.

### Translated — Sign in + Sign up (Phase 1, page 2)
- Wired `useTranslation()` through [signin](workit/src/app/signin/page.tsx) and
  [signup](workit/src/app/signup/page.tsx) pages **and** their shared components
  [PhoneAuthForm](workit/src/components/PhoneAuthForm.tsx) (the default tab) and
  [GoogleButton](workit/src/components/GoogleButton.tsx) — so the whole auth flow,
  including validation/error messages, placeholders, hints and the consent line,
  switches language.
- Added a shared `auth.*` namespace (role cards, business toggle, fields, phone/OTP
  flow, errors) + `signin.*` / `signup.*` keys to the Messages type and en/af/zu
  (af + zu **review-pending drafts**).
- Verified in preview: both pages render fully in English, Afrikaans and isiZulu,
  phone form included. tsc + build clean, **deployed** ✅ hosting.
- Remaining Phase 1: verification, safety, account.

### Translated — Verification page (Phase 1, page 3)
- Wired `useTranslation()` through the whole [verification page](workit/src/app/verification/page.tsx):
  worker credential form, employer identity form, and the signed-out overview —
  including every validation/error message, field label, hint, consent text and CTA.
- Added ~90 `ver.*` keys to the [Messages type](workit/src/i18n/locales.ts) + en/af/zu
  (af + zu **review-pending drafts**). Rich bullets flattened to single strings;
  inline links (Privacy Policy) preserved.
- Verified in preview: the guest overview renders fully in English, Afrikaans and
  isiZulu (the forms use the same proven `t()` mechanism; tsc + build clean).
  **Deployed** ✅ hosting.
- Remaining Phase 1: safety, account.

### Translated — Safety guide (Phase 1, page 4)
- Split [safety/page.tsx](workit/src/app/safety/page.tsx) into a thin server page
  (keeps SEO metadata) + new client [SafetyContent.tsx](workit/src/app/safety/SafetyContent.tsx)
  that flows all ~60 prose blocks through `t()`. Per-block keys; inline bold flattened,
  but the key links (verification, mailto report) and the SA emergency numbers
  (10111/10177/112/0800 428 428 as real `tel:` links) preserved.
- Added ~63 `safety.*` keys to the Messages type + en/af/zu (af + zu **review-pending drafts**).
- Verified in preview: full page renders in English, Afrikaans and isiZulu.
  tsc + build clean, **deployed** ✅ hosting.
- Remaining Phase 1: account (last one).

## 2026-10-13 (Firebase hardening — App Check + Performance Monitoring)

### Added — Firebase App Check (reCAPTCHA Enterprise), safe-by-default
- New [appCheck.ts](workit/src/lib/appCheck.ts): `initAppCheck(app)` — browser-only,
  idempotent, **no-ops until `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` is set**, so
  shipping it changes nothing for users until the key is configured + enforcement is
  flipped in the console. Auto-sets a **debug token on localhost** so dev isn't blocked.
- Wired into [firebase.ts](workit/src/lib/firebase.ts) `getApp()` so the attestation
  token attaches before any Firestore/Storage/Functions/Auth call.
- Rollout is monitor-only → check verified-request metrics → enforce per product.
  Console steps + checklist in `Documents/WorkitSA - Firebase Hardening Guide.md`.

### Added — Firebase Performance Monitoring (live on deploy)
- New [performance.ts](workit/src/lib/performance.ts): `initPerformance()`, `measure()`,
  `startTrace()` — consent-gated (POPIA), SSR-safe, never throws. Init called from
  [AuthContext.tsx](workit/src/contexts/AuthContext.tsx) mount (beside Sentry).
- Custom traces: **`post_job`** (createJob write, [jobs.ts](workit/src/lib/jobs.ts)),
  **`load_jobs_list`** (find-work first snapshot, [find-work/page.tsx](workit/src/app/find-work/page.tsx)),
  **`upload_verification_doc`** (new `traceName` prop on [PhotoUploader.tsx](workit/src/components/PhotoUploader.tsx),
  passed by all uploaders on [verification/page.tsx](workit/src/app/verification/page.tsx)).
- `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` added to `.env.local.example`.
- tsc + build clean, **deployed** ✅ hosting. Still to do (console, by founder): register
  the reCAPTCHA Enterprise key → send it to me → redeploy; SMS region allowlist (ZA);
  Firestore PITR + daily 7-day backups; then App Check enforcement after monitoring.

## 2026-10-13 (GA4 funnel instrumentation — traction metrics for funders/FNB judges)

### Added — product funnel events via the existing consent-gated `track()` helper
All new events go through [analytics.ts](workit/src/lib/analytics.ts) (Firebase
Analytics SDK, `logEvent`) — **no second tracking setup**, so no double-counting.
Each fires **after the Firestore write succeeds**, not on button click. POPIA: no
names, phones, emails, ID numbers, exact addresses, GPS or user IDs in any param.
- **`job_posted`** `{ job_category, job_budget, area, has_photos }` — `createJob` (retargeted from the old `{category,price,urgent}`).
- **`job_offer_sent`** `{ job_category, offer_type: accept|counter }` — `createOffer` (was `offer_made`); `offer_type` compares price to the job's asking price.
- **`job_accepted`** `{ job_category, is_crew_job }` — `acceptOffer` (was `offer_accepted`), moved after the job re-read.
- **`job_started`** `{ job_category }` — `markInProgress` (new).
- **`job_completed`** `{ job_category, value, currency:"ZAR" }` — `markCompletedByWorker` (added params for GA revenue).
- **`rating_submitted`** `{ rater_type: customer|worker, rating }` — `submitRating` (unified the old split events; `raterType` threaded from both rating forms in [jobs/page.tsx](workit/src/app/jobs/page.tsx)).
- **`worker_verification_submitted`** — worker submit path in [verification/page.tsx](workit/src/app/verification/page.tsx) (role-gated to workers).
- **`worker_verified`** `{ badge: standard|gold }` — admin approve in [UserDrawer.tsx](workit/src/app/admin/_components/UserDrawer.tsx); the **only** customer-funnel event an admin action fires, and only for workers.
- **`sos_triggered`** — `triggerEmergency`; bare count, no location/PII.
- **`sign_up`** — added `user_type: worker|customer` to all 3 auth paths (kept `method`+`role`; not renamed — it's a GA key event).
- **User property `user_type`** set after login in [AuthContext.tsx](workit/src/contexts/AuthContext.tsx) via `setUserProperties`.

### Added — test-safety + DebugView path in `track()`
- Analytics now **no-ops on localhost/127.0.0.1/\*.local/\*.test** so founder testing
  doesn't pollute the funnel. Exception: append **`?ga_debug=1`** to send events to
  **GA4 DebugView** (sets `debug_mode:true` + a sticky `workit_ga_debug` flag).
- tsc + build clean, **deployed** ✅ hosting. GA4 property G-NTS42MK3ZN. Mark
  `job_posted`, `job_accepted`, `job_completed`, `worker_verified` as key events in
  GA4 once they appear in the events list.

## 2026-09-30 (find-work UX — cold-start + verify/available surfacing)

### Improved — three changes to the worker job feed ([find-work/page.tsx](workit/src/app/find-work/page.tsx))
From a structure review of the page against the current (thin) marketplace.
- **Default radius → "Any distance"** (was 25 km). With few open jobs nationally, a
  25 km cap hid the ones that exist. `activeFilterCount` updated so a specific radius
  now reads as the "active" filter. Comment flags reverting to 25 km once a suburb has
  density.
- **"Verify to send offers" banner** for workers who aren't approved — status-aware:
  none/rejected → "Verify now" (→ /verification); changes_requested → "Update documents";
  pending → "under review" (no CTA). Sets expectations up front so an unverified worker
  isn't surprised when "Send offer" is blocked.
- **"Available now" toggle** on the feed for approved workers (reuses `AvailableNowCard`)
  — ties supply to demand and gives idle workers an action when the feed is thin.
- Verified all four states in an isolated lab page (deleted); tsc + build clean,
  **deployed** ✅ hosting. Also noted (not changed): the signed-out "just browsing"
  banner is dead code under `AccountGate requireSignIn` — candidate for removal or for
  actually allowing signed-out job preview (a growth lever).

## 2026-09-30 (admin approval queue — submitted applicants no longer hidden)

### Fixed — "awaiting docs" was swallowing everyone who actually applied
The approvals queue decided "submitted" purely by `verification.submittedAt`. In
production **zero** pending accounts have that field set, so **all 86 pending
applicants landed in "awaiting docs" and "ready to review" showed 0** — including
31 people who had genuinely submitted (15 awaiting our decision + 16 already
reviewed and asked to make changes). Their submission markers/payload predate the
current schema (they carry `reviewedAt` / `reviewerNote` / `idCheckVerdict` /
`consentAt` and a non-"none" `verificationStatus` instead), so the queue treated
real applicants as never-submitted. Surfaced by an audit of live Firestore data.
- [admin/page.tsx](workit/src/app/admin/page.tsx): new `hasSubmitted()` predicate
  = `submittedAt || reviewedAt || idCheckVerdict || consentAt || verificationStatus !== "none"`.
  `ready` and `awaiting_docs` (list + chip counts + funnel "submitted") now use it
  instead of `submittedAt` alone, and `isMissingDocs` (verification tab) too.
- New **"changes requested"** bucket on the Approvals tab — people we reviewed and
  asked to fix something (waiting on the user, not us) no longer hide in "ready"
  or "awaiting docs".
- Verified against live data: buckets went from ready 0 / awaiting 86 → **ready 15
  / changes-requested 16 / awaiting 55** (sum = 86, each counted once; 31 applicants
  rescued). tsc + build clean, **deployed** ✅ hosting.
- Investigated the submit flow (2026-09-30): **NOT broken.** `verification.submittedAt`
  (+ consentAt/consentVersion/idCheckVerdict) is written on every successful submission,
  verified continuously through the latest real submission (2026-09-24), with the ID/
  address files landing in Storage `verification/{uid}/` (53 users have files). The 31
  mislabelled applicants are a **legacy launch-week cohort (2026-07-09→07-11)** that
  predates the current verification schema: they carry only a status + admin reviewerNote,
  no modern markers, and — confirmed against Storage — **30 of 31 have NO document files
  at all** (only Desre Botha has docs, now reviewable). `migratePrivate` is clean (moves
  only 8 sensitive keys, never submittedAt) and the review action only adds reviewedAt/
  reviewerNote, so nothing wipes submittedAt. **Remaining action is data remediation**, not
  a code fix: the ~30 doc-less legacy applicants need to **re-submit** via the current flow.

## 2026-09-29 (sign-up source attribution — ?src=)

### Added — first-touch growth-channel attribution
So the founder can measure the Facebook-group channel (and any other).
- New [attribution.ts](workit/src/lib/attribution.ts): captures `?src=` (falls back to
  `utm_source`) from the URL on first touch, sanitises to a short slug, and stores it in
  `localStorage` (first-touch wins — the originating channel keeps the credit). The tag
  usually lands on the home page, so it's captured app-wide via a mount effect in
  `AuthProvider`, long before the person reaches /signup.
- Stamped onto the profile as `signupSource` at account creation across ALL three paths
  in [AuthContext.tsx](workit/src/contexts/AuthContext.tsx) (email, Google, phone), then
  cleared. New `signupSource?: string` on `UserProfile`. No Firestore-rules change needed
  (users create rule has no field whitelist).
- Surfaced in the **Admin → Users CSV** as a `signup_source` column for counting.
- FB post bank links updated to `https://workitsa.co.za/?src=fb`
  ([facebook-growth-posts.md](workit/marketing/outreach/facebook-growth-posts.md)) with a
  note on the tag + other-channel slugs (radio → `?src=radio`, WhatsApp → `?src=wa`).
- Verified in preview: `?src=fb` → stored `fb`; first-touch kept `fb` over a later
  `?src=radio`; `FB-Alberton!!` sanitised to `fb-alberton`. tsc + build clean,
  **deployed** ✅ hosting.

## 2026-09-29 (Live Pulse cockpit v2 — /admin/live)

### Improved — punchier heat, richer signals, suburb focus
Follow-up to the god-view below, all in [LivePulse.tsx](workit/src/app/admin/_components/LivePulse.tsx).
- **Heatmap intensity punched up:** zoom-scaled radius/blur (46→24 as you zoom in),
  higher per-point weights (available worker 0.95, open job 1.0, offer 0.8), a hotter
  gradient, `minOpacity` so sparse areas still register, and it now re-tunes on
  `zoomend` — no longer a faint wash at province zoom.
- **Richer live signals (not just jobs):** now also plots **offers** (cool-teal
  diamonds, live via a `collectionGroup("offers")` query, pending only, degrades
  quietly if rules forbid the group read) and **available-now** workers as a
  highlighted subset — fixed the bug where Live-mode workers were all hardcoded
  `available:true`; availability now reads real `availableNow`/`availableNowAt` via
  `isAvailableNow()`. New KPIs: **Available now** + **Offers**. Legend + feed updated.
- **Auto-zoom to the busiest suburb + a suburb filter:** on load it scores suburbs
  (open jobs ×2.2, offers ×1.6, available workers ×1.2) and flies to the hottest one;
  a suburb dropdown filters the map, heat and KPIs to one area (with an "All areas"
  reset + a focus chip). Simulate mode now clusters activity by suburb (Alberton
  beachhead weighted highest) so the filter/auto-zoom demo convincingly.
- Verified in isolation via a throwaway lab page (deleted): heat, offers, available-now,
  auto-zoom→Alberton, suburb filter→Benoni (Workers 70→4) and reset all confirmed,
  no console errors. tsc + build clean, **deployed** ✅ hosting.

## 2026-09-29 (live "Pulse" god-view — /admin/live)

### Added — full-screen real-time marketplace visualization
A mission-control screen: a dark map of Gauteng with workers as dots, jobs
plotted by status, an arc of light on every hire, expanding pulses on events, a
live KPI ticker (workers · jobs open · done today · earned today) and an event
feed. Inspired by the Shopify/Stripe BFCM globes, but at metro scale (a globe is
the wrong scale for a province-first launch).
- New route [admin/live/page.tsx](workit/src/app/admin/live/page.tsx) (admin-gated,
  dynamic ssr:false) + [LivePulse.tsx](workit/src/app/admin/_components/LivePulse.tsx):
  react-leaflet map + an animated `<canvas>` overlay synced to the map projection.
- **Two data sources:** Live (Firestore `onSnapshot` on workers' PUBLIC
  approxLat/Lng + jobs' pin/status — no personal data, no tracking) and
  **Simulate** (a scripted event loop so the screen looks alive while the
  marketplace is quiet; badged "Simulated"). Default Simulate for now.
- **Heatmap toggle** (reuses `leaflet.heat`), **sound-per-hire** (WebAudio,
  off by default), Live/Simulate switch, techy HUD (scanlines, corner brackets,
  glass panels, Georgia italic wordmark).
- Map tiles: OpenStreetMap inverted to a dark theme via CSS filter (CARTO dark
  now needs an API key). `MobileBottomNav` hides on `/admin/live` so the
  full-screen view has no app chrome. A "Live view" link added to the admin header.
- Verified in isolation via a throwaway lab page (deleted). tsc + build clean,
  **deployed** ✅ hosting. Reachable at workitsa.co.za/admin/live (admin only).

## 2026-09-23 (proof-of-work: camera-capture + time-stamped completion photos)

### Added — verifiable on-the-job proof photos
Prompted by an investor question ("it's really easy to post pics and say it's my
work"). Completion / "after" photos were uploadable straight from the gallery,
so they were unverifiable. Now they're captured live and stamped:
- [PhotoUploader.tsx](workit/src/components/PhotoUploader.tsx) gains two opt-in
  props: `capture` (`"environment"`/`"user"` → opens the device camera instead
  of the gallery) and `stamp` (burns a legible **"Workit · <date, time>"**
  watermark into the image via canvas before upload). Stamping always re-renders
  through the canvas, even for small files, and never discards the stamped pixels.
- The job-completion uploader ([jobs/page.tsx](workit/src/app/jobs/page.tsx))
  now uses `capture="environment"` + `stamp`, with copy explaining the photo is
  camera-taken and time-stamped as real proof of work. These flow to the public
  profile's proof-of-work gallery, so the trust signal is genuine.
- Employer "what needs doing" post photos and portfolio samples are unchanged
  (gallery still fine there — only on-the-job evidence is locked to the camera).
- tsc + build clean. Note: the stamp only renders on a real camera/file pick, so
  it wasn't driven headlessly — verify on a phone. **Deployed** ✅ hosting.

## 2026-08-24 (B2B lead batch — Bryanston/Sandton, Brakpan, Meyerton, Carletonville, Daveyton, Tembisa, Randburg rotation)

### Marketing — 18 new leads researched + personalised Email 1 drafts staged
Web-researched 18 new Gauteng SME leads across gardening, cleaning, security,
trades (electrical/plumbing/building), moving, courier/bakkie hire, property
management, gym, pest control, panel beaters, appliance repair, guesthouse
and car wash — deduped against `target-list.csv` and all prior `leads-*.json`
batches (zero overlap). Public business emails only, source URL recorded per
lead. ([leads-2026-08-24.json](workit/marketing/outreach/leads-2026-08-24.json),
appended to [target-list.csv](workit/marketing/outreach/target-list.csv)) —
also wrote a personalised Email 1 draft per lead for founder review
([drafts-2026-08-24.md](workit/marketing/outreach/drafts-2026-08-24.md)).
Nothing emailed or imported by this run — staged only; founder still needs to
run `import-leads.mjs` to queue them.

## 2026-08-10 (weekly B2B lead batch — East/West Rand townships + Vaal/Pretoria North rotation)

### Marketing — outreach queue restocked, 50 new leads
Autonomous weekly lead-research run. Rotated onto previously-thin coverage:
Katlehong, Vosloorus, Soshanguve, Soweto, Mamelodi, Wonderboom/Pretoria North,
Brakpan, and deeper Vereeniging/Vanderbijlpark (Vaal), plus fill-in suburbs in
Krugersdorp, Roodepoort, Boksburg, Benoni, Alberton, Kempton Park, and
Centurion — mixing security, cleaning, catering, car wash, appliance repair,
panel beaters, gyms, guesthouses, laundry, couriers, property management,
nurseries, and pest control. All 50 emails are publicly listed on the
business's own site, Facebook page, or a bona-fide SA directory (source URL
recorded per lead); checked against all 4 prior batch files — zero overlap.
([leads-2026-08-10.json](workit/marketing/outreach/leads-2026-08-10.json)) —
**50 queued, 0 skipped** via `import-leads.mjs`. Nothing emailed by this run;
leads only join the `marketingLeads` pending queue for the existing weekday
08:30/13:30 SAST sender.

## 2026-08-09 (weekly B2B lead batch — Pretoria/Vaal/West Rand rotation)

### Marketing — outreach queue restocked, 52 new leads
Autonomous weekly lead-research run. Rotated off the already-covered suburbs
(Alberton, Bedfordview, Benoni, Sandton, Randburg, etc.) onto Pretoria East/
Wonderboom/Montana/Silverton, deeper Soweto (Jabulani, Zola, Diepkloof,
Meadowlands, Evaton West), Heidelberg/Nigel, Randfontein, Rosebank/Melville/
Auckland Park, and Vaal/Northriding/Honeydew — mixing garden services,
cleaning, security, catering/events venues, nurseries, panel beaters, gyms,
car washes, laundry, appliance repair, and painters. All 52 emails are
publicly listed on the business's own site, Facebook page, or a bona-fide SA
directory (source URL recorded per lead); zero overlap with the 123 emails
from the three prior batches.
([leads-2026-08-09.json](workit/marketing/outreach/leads-2026-08-09.json)) —
**52 queued, 0 skipped** via `import-leads.mjs`. Nothing emailed by this run;
leads only join the `marketingLeads` pending queue for the existing weekday
08:30/13:30 SAST sender.

## 2026-07-14 (names, not phone numbers, in the admin queue)

### Fixed — new phone sign-ups now capture a real name
Admin cards were showing phone numbers where names should be. Root cause: the
combined **"Sign in or create account"** form (the sign-in page) never asks for
a name, so when a brand-new number went through it, `confirmPhoneCode` minted a
profile with `displayName = <phone number>`. (The dedicated **Sign up** page
always collected a name, so it was fine — this only hit people who used "Sign
in" to register.)
- `confirmPhoneCode` no longer creates a placeholder number-named profile for
  an unknown number. The user is left profile-less and routed to
  **/finish-signup** (via the sign-in page's `isNewUser` handoff, the same path
  Google new-users already use).
- **/finish-signup** now collects **Full name** + **Email** whenever the auth
  provider didn't supply them (phone gives neither; Google gives both, so those
  fields stay hidden for Google). The already-verified phone is pre-filled and
  locked. `completeGoogleSignUp` uses the form-supplied name/email, keeps the
  Firebase Auth `displayName` in sync, refuses to create a nameless profile, and
  attributes the signup method (`phone` vs `google`) correctly.
- Bonus: abandoned phone sign-ups no longer create a Firestore user doc at all,
  so they can't clog the approvals queue either.
- ⚠ **Existing** number-named accounts keep their old placeholder (their real
  name was never captured — can't be invented). They can edit it on /profile,
  or you can rename them; offer to bulk-list them if useful.
- tsc + build clean; /signin & /finish-signup render with no console errors.
  (The OTP flow itself needs a live SMS code, so it wasn't driven end-to-end.)
  **Deployed** ✅ hosting.

## 2026-07-14 (payment handshake + Work Record)

### Added — payment handshake: "I've paid" ⇄ "I've been paid"
Cash/EFT changes hands off-platform, so the platform couldn't tell "job done"
from "job done AND paid". Once the work is confirmed, each side now taps their
half (either order); the second tap completes the handshake, stamps the
job/slot with `paymentConfirmedAt`, and bumps two new server-authored trust
tallies — `paymentsConfirmedCount` (worker) + `employerPaymentsConfirmed`
(employer). No money moves through Workit — it stays a handshake, so no
payment-provider licensing exposure; it gives dispute evidence + payment
history for the Work Record below.
- New [payments.ts](workit/functions/src/payments.ts) `confirmPayment`
  callable — the ONLY writer of the stamps + tallies (same server-authored
  pattern as ratings; verifies caller from auth token, requires work
  confirmed, atomic transaction). Single jobs stamp the job doc; crew jobs
  stamp the caller's roster slot (same cosmetic-forgery residual as crew
  ratings — tallies only ever move server-side).
- Rules: `paymentPaidAt`/`paymentReceivedAt`/`paymentConfirmedAt` blacklisted
  on job updates for BOTH actors; the two tallies added to the forbidden
  self-keys on users. **+6 rules tests → 87/87** ✅.
- UI: new [PaymentHandshakeCard](workit/src/components/PaymentHandshakeCard.tsx)
  on the job page — single jobs (both sides, next to ratings), crew worker's
  own slot, and per-worker in the employer's crew roster (whose status label
  "Confirmed + paid" is now "Work confirmed" — payment has its own state).

### Added — Work Record: shareable, verifiable proof-of-work certificate
SA gig workers can't prove income — that locks them out of renting, loans and
formal applications. Workit already holds the evidence, so now it mints it:
- New [workRecord.ts](workit/functions/src/workRecord.ts) `generateWorkRecord`
  callable aggregates the caller's confirmed jobs (single + crew) SERVER-SIDE
  — totals, earnings (agreed prices), per-category breakdown, latest 40 job
  lines (title/area/date/price/stars/paid✓), rating, verification badges,
  payments-confirmed tally — into `workRecords/{token}`. The auto-id doc id is
  the bearer secret (publicShareToken model): rules allow public **get**,
  deny **list** + all client writes. Regenerating reuses the token (stable
  link); `rotate: true` mints a fresh one (kills old links). Employer
  names/uids deliberately excluded from the record.
- New public page [/record?t={token}](workit/src/app/record/page.tsx) renders
  the certificate ([WorkRecordView](workit/src/components/WorkRecordView.tsx)):
  brand band, identity + badges, stat tiles, category chips, job history, and
  a QR + verify-URL footer so a printed copy stays verifiable. Print-styled —
  owner's "Download PDF" is just window.print(); owner also gets Refresh +
  WhatsApp share. Invalid/reset tokens get a friendly not-found.
- Entry point: [WorkRecordCard](workit/src/components/WorkRecordCard.tsx) on
  /account (workers) — locked teaser until the first completed job.
- Verified all handshake states + both card states + the full certificate on
  a temp lab page (deleted before deploy). tsc + both builds clean,
  test:rules 87/87, **deployed** ✅ hosting + firestore:rules + functions
  (`confirmPayment`, `generateWorkRecord`).

## 2026-07-13 (approval queue no longer clogged by no-doc signups)

### Fixed — "why do pending no-doc accounts keep piling up?"
Root cause: `accountStatus: "pending"` is stamped at **signup** (AuthContext),
before any documents exist — so every abandoned signup (Docs: none) landed in
**Account approvals → Pending** with full Approve/Reject controls you can't
actually use. The earlier submittedAt fix cleaned the *verification* queue but
the *approvals* tab still lumped everyone together. Fundamentally you can't
stop someone creating an account and abandoning it — so the fix is to keep
those out of the real review queue.
- The approvals **Pending** chip is now split into two:
  **ready to review** (docs submitted → genuinely approvable, the default) and
  **awaiting docs** (signed up, nothing uploaded → nudge them with the WhatsApp
  / Email-docs-reminder / welcome buttons; nothing to approve yet).
- The "⏳ waiting Nd" ageing badge now only shows on **ready to review** (that's
  time waiting on *us*); awaiting-docs is waiting on *them*, so no false alarm.
- Approved / rejected / suspended tabs unchanged. Pure admin-side display
  logic — no change to the signup/auth/gate flow. tsc + build clean,
  **deployed** ✅ hosting.

## 2026-07-13 (welcome manual)

### Added — welcome email with a "how to use Workit" manual + social links
New users now get a proper onboarding email the moment they're approved,
instead of a one-line "you're verified". Role-aware: workers get a 5-step
*how to start earning* guide (go available → find work → send an offer → do
the job safely → get paid & rated), employers a *how to hire* guide (post →
review offers → hire → start code → pay on completion), each with a tip and a
CTA. Social links follow, and the founder gets a BCC copy.
- New [welcomeContent.ts](workit/functions/src/welcomeContent.ts) builds the
  role-aware email; [verificationAlerts.ts](workit/functions/src/verificationAlerts.ts)
  sends it automatically on approval (replacing the old short approval email).
- New `sendWelcomeEmail` callable + one-click **👋 Send welcome manual** button
  ([WelcomeEmailButton.tsx](workit/src/app/admin/_components/WelcomeEmailButton.tsx))
  on every admin user card — for re-sends and for users approved before this
  existed. UID-only (no open relay), admin-gated (`approvals.manage` /
  `verification.review`), BCC'd to founder, audit-logged as `welcome_email_sent`.
- **Social links are config-driven** — read from `marketing/config` keys
  `socialFacebook` / `socialInstagram` / `socialTiktok` / `socialWhatsapp`;
  only the ones set are shown. ⚠ **These are currently unset** — the email
  ships without a social row until the founder provides the real URLs (there
  were none anywhere in the codebase; none were invented).
- Rendered both role variants in isolation to verify layout. tsc + both builds
  clean, **deployed** ✅ functions (`onVerificationDecision`, `sendWelcomeEmail`)
  + hosting.

## 2026-07-13 (later still)

### Fixed — incomplete verifications no longer clog the admin review queue
Founder hit two cards showing blank ID/address/skills. Diagnosis (queried
prod): one worker was mid-submission (stale card — all data landed on final
Submit); another had uploaded a single proof-of-address PDF and abandoned,
yet still sat in the queue looking like a real submission. Root cause: the
per-field upload persist in [verification/page.tsx](workit/src/app/verification/page.tsx)
stamped `verification.submittedAt` on EVERY individual file upload, so a
worker who uploaded one file and quit (or was still typing) appeared as a
completed submission.
- Both `persistVerificationField` (worker) and `persistField` (employer) now
  still save each uploaded file to the private doc — so uploads survive a
  reload — **but no longer stamp `submittedAt`**. Only the final Submit
  stamps it, so an account counts as "submitted" (and enters the review
  queue / promotes to pending) only once the worker actually completes the
  form. Partial starts now correctly sit under the **missing-docs** filter.
- Forward-looking: existing partial cards already in the queue (e.g. the two
  above) keep their old stamp — action them normally (Request changes) once.
- tsc + build clean, **deployed** ✅ hosting.

## 2026-07-13 (later)

### Added — RBAC phase 2: granular roles are now ENFORCED (no-lockout hybrid)
The enforcement half of ADMIN_ROLES.md, with one deliberate deviation from a
naive flip: **claims are the sole authority once a person is role-tagged;
untagged legacy binary admins keep full power** — so nothing breaks before
the founders assign themselves roles, and the moment Simphiwe is tagged
"operations" (+ re-signs in), owner-only surfaces genuinely lock her out.
The bootstrap branch matches nobody once both founders are tagged.
- **Rules** ([firestore.rules](workit/firestore.rules)): new `permClaim()` /
  `can()` / `isStaff()` helpers; ~20 admin surfaces converted from binary
  `isAdmin()` to capabilities — users updates (approvals/verification/
  business/suspend), user delete (users.erase), **private ID docs
  (verification.review + 2FA)**, jobs/messages/offers admin paths
  (disputes.resolve / moderation.act), deletionRequests (approvals.manage),
  auditLog (audit.view read, isStaff create), moderation surfaces
  (moderation.act), stats/opsHealth (analytics.view), broadcasts
  (broadcast.send), support (support.respond), adminNotes (users.read),
  marketingLeads (broadcast.send ∨ approvals.manage).
- **Callables**: new [perms.ts](workit/functions/src/perms.ts)
  `requireCan(auth, ...perms)` (same hybrid semantics, variadic) wired into
  `eraseUserData` (users.erase), `sendBroadcast` (broadcast.send),
  `adminEmailUser` (approvals.manage ∨ verification.review),
  `getVerificationPayload` (verification.review, 2FA kept); `setAdminRole`
  bootstrap tightened to UNTAGGED legacy admins only.
- **UI**: AuthContext reads the token's `adminRole`/`perms` claims and
  exposes **`can(permission)`**; [AdminShell](workit/src/app/admin/_components/AdminShell.tsx)
  filters nav tabs by each tab's required capability; the admin page's
  access checks accept role-tagged staff (`adminRole`) so future
  non-binary-admin hires can enter the panel (their tabs/rules then scope
  them down).
- **Tests**: 5 new tagged-actor tests — tagged operations admin works queues
  but is DENIED broadcasts despite `role=="admin"`; analyst is read-only
  (stats yes, adminNotes/user-updates no); ID docs need verification.review
  + 2FA (support role denied even with 2FA); legacy untagged admins
  unaffected (all pre-existing tests). **test:rules 81/81** ✅.
- App tsc + build clean, functions build clean; **deployed** ✅ hosting +
  firestore:rules + 5 permission-gated callables.
- **Founder next steps:** in Manage admins (Users tab) assign Simphiwe →
  operations and have the *other* account assign you → owner (you can't
  self-assign); both re-sign-in. Phase 3 (ID-doc access logging + masking)
  remains in BACKLOG.

## 2026-07-13

### Added — RBAC phase 3: POPIA ID-document access logging
Completes the RBAC rollout ([ADMIN_ROLES.md](ADMIN_ROLES.md) §8.3 · §5 "PII
access logging"). Phase 1 (foundation) + phase 2 (perm enforcement) shipped
earlier; this is the crown-jewel protection for special personal information.
- **Every VIEW of a person's ID documents is now logged** —
  [docUrls.ts](workit/functions/src/docUrls.ts) `getVerificationPayload`
  writes an immutable `idDocAccessLog` entry (`adminUid`, `adminRole`,
  `targetUid`, `at`) whenever an admin opens someone *else's* verification
  payload. Awaited but non-blocking (a log failure is surfaced in Cloud
  Logging, never denies a legitimate review). Logs the access, not just the
  action — the POPIA expectation for special personal information; deters +
  detects misuse.
- **Rules:** new `idDocAccessLog` (read = `audit.view`; **all client writes
  denied** — Admin-SDK/server-only, tamper-proof) + a rules test. **test:rules
  77/77** ✅.
- **ID-number masking for lower roles = already structural, no code needed:**
  the private-doc read rule is `verification.review + 2FA`, so a support-role
  admin literally can't fetch the ID number in the first place (phase-2 rules).
- Deployed ✅ `functions:getVerificationPayload` + `firestore:rules`
  (deliberately **no hosting** — see note below).

> ⚠ **Two-account coordination note (2026-07-12):** this session had an
> in-progress "merge onboarding into one step" change on disk (AccountGate,
> signup, finish-signup, verification, profile) that the founder finished
> separately and deployed. Those local edits were
> **left un-deployed** (phase 3 shipped functions + rules only, no hosting) so
> they can't overwrite the live onboarding. **Before any frontend/hosting
> deploy from this machine, reconcile these files with the other account's
> shipped version** — otherwise a stale onboarding could regress production.

### Added — admin Tier 3: RBAC phase 1, system-health card, CSV exports
The final batch of the admin-panel assessment. (Scoping note: the fourth
Tier-3 item — the **stats counter document** — turned out already built and
accumulating since 2026-07-08 (`stats/totals` + `statsDaily/*`, stats.ts);
the dashboard deliberately keeps streaming until volume demands the switch.)
- **RBAC phase 1** (per [ADMIN_ROLES.md](ADMIN_ROLES.md) §8.1 — foundation
  only): new [roles.ts](workit/src/lib/roles.ts) permission matrix (owner /
  operations / verification / support / moderator / analyst ×13 permissions,
  mirrored in [adminRoles.ts](workit/functions/src/adminRoles.ts) — keep in
  lockstep); new **`setAdminRole` callable** (2FA-required; bootstrap: legacy
  binary admins may manage roles until phase 2 tightens to the claim; can
  never change OWN role) writes `users/{uid}.adminRole`, mirrors
  `{admin, adminRole, perms}` into custom claims, **revokes refresh tokens**
  (change lands on next sign-in), audit-logs (`role_changed`/`role_removed`
  labels added to audit.ts); new **Manage admins panel** on the Users tab
  (assign/change/remove with confirm dialogs). `adminRole` added to
  UserProfile. **Phase 2 (enforcement: rules/callables/tabs switch from
  binary admin to `perm(...)`) is the follow-up** — do before Simphiwe works
  the queues solo.
- **System-health card** (admin Overview): every scheduled function now
  writes a heartbeat at the top of each run (new
  [heartbeat.ts](workit/functions/src/heartbeat.ts) → `opsHealth/{name}`,
  fire-and-forget; wired into all **9 schedulers**: recurring jobs, deletion
  check, Jarvis digest, FB clip + image posts, 2× marketing outreach, weekly
  backup, monthly retention). New
  [SystemHealthCard](workit/src/app/admin/_components/SystemHealthCard.tsx)
  compares each beat against its expected cadence (weekday jobs get weekend
  slack) and shows ⚠ overdue in red — a silently dead scheduler surfaces
  here instead of days later. "never yet" rows fill in as each fires.
- **CSV exports** (Users tab): [AdminExportButtons](workit/src/app/admin/_components/AdminExportButtons.tsx)
  — Users CSV (contact/status/skills/ratings; NO ID numbers or documents) +
  Jobs CSV, fetched fresh at click, Excel-safe escaping + BOM.
- **Rules:** `opsHealth` (admin-read, client-write-deny) + test.
  **test:rules 76/76** ✅. App tsc + build clean, functions build clean;
  **deployed** ✅ hosting + firestore:rules + 10 functions (9 schedulers
  updated, `setAdminRole` created).

## 2026-07-12 (night)

### Added — admin Tier 2: 🚩 fraud badge in card headers + internal admin notes
- **🚩 header badge:** [VerificationDocs](workit/src/app/admin/_components/VerificationDocs.tsx)
  exports `countFraudAlerts()` and reports the count upward via a new
  `onFraud` callback (ref-held so inline parent callbacks don't re-trigger
  the fetch); the card header shows "🚩 N fraud signals" next to the name the
  moment the private payload loads — no more approving before scrolling into
  the documents section. Counted: duplicate ID, under-18 ID, ban-evasion
  match, duplicate file, OCR id-number-not-found (readable text only).
- **Internal admin notes:** new
  [AdminNoteField](workit/src/app/admin/_components/AdminNoteField.tsx) on
  every review card (below the note-to-user): "🔒 Internal note — admins
  only". Stored in a NEW top-level **`adminNotes/{uid}`** collection —
  deliberately not under users/{uid}, because owners can read their private
  subtree. Tracks who wrote it + when, for when Simphiwe shares the queues.
- **Rules:** `adminNotes` match block (admin-only read/write) +
  3 new tests (admin can write/read; **the subject user can NEVER read it**;
  strangers/guests denied). **`test:rules`: 75/75 passed** ✅.
- tsc + build clean; **deployed** ✅ hosting + firestore:rules.

### Added — admin triage batch: chip counts, ageing badges, sign-up funnel on Growth
Founder-approved "Tier 1 + funnel" from the admin-panel assessment. (Survey
first: the WhatsApp chase button and the Overview Attention list turned out
already shipped by parallel sessions — dropped from the batch.)
- **Live counts on every filter chip** (approvals + verification tabs):
  "pending (4) · missing docs (11)…" — whole queue state at a glance, and no
  more "did their submission disappear?" (you can see users move between
  chips). [admin/page.tsx](workit/src/app/admin/page.tsx) `load()` now does
  ONE full users fetch per tab serving both the filtered list and all counts;
  the verification tab's server-side `where()` queries were dropped in favour
  of shared client predicates (fine at current scale — revisit with the
  stats-doc backlog item).
- **⏳ "waiting Nd" ageing badge** on review cards (actionable filters only,
  from day 1): neutral <2d, amber 2–3d (the public 1–2-day promise), red ≥4d.
  Verification tab ages from `submittedAt`, approvals from `createdAt`.
- **Sign-up funnel on the Growth tab**
  ([GrowthDashboard](workit/src/app/admin/_components/GrowthDashboard.tsx)):
  Signed up → Submitted docs → Approved with per-step conversion %, plus a
  red "N signed up but never submitted docs" badge with a jump-link to the
  missing-docs chase list. Times the one-step-signup merge (below) so its
  effect on the submit rate is measurable.
- tsc + build clean, **deployed** ✅ hosting. (Admin-gated UI — verified by
  gates + code review, per convention.)

## 2026-07-12 (night — cross-session completion)

### Changed — signup steps 1+2 MERGED: straight to verification, one onboarding form
Founder: "when users sign up I'd like to merge step 1 and 2 into one thing —
I need people to submit and not be growing pending accounts." The two-hop
welcome flow (/profile → /verification) was leaking users between "made an
account" and "submitted docs". Built by the other account's session (which
hit its usage limit right before verifying); this session verified, built,
deployed and logged it.
- **All three signup paths** (email, phone, Google finish-signup) now route
  **straight to /verification?welcome=1**; [AccountGate](workit/src/components/AccountGate.tsx)
  enforces it — unapproved users without a submission are sent to the single
  merged step (no more profile-first hop).
- **[verification/page.tsx](workit/src/app/verification/page.tsx) absorbs the
  old profile step:** home-location pin (LocationPicker) folded in — exact
  coords to the PRIVATE doc, rounded approx coords public, same Phase-B split
  as before; submit now also sets **`profileCompletedAt`** (worker + employer
  forms) so the gate logic stays consistent. Welcome banners reworded from
  "Step 2 of 2" to a single-step frame.
- **/profile** is now post-approval polish (photo, bio, portfolio) — its
  welcome banner softened; it no longer claims to be a required step.
- Verified: tsc + build clean; /signup + /verification (guest overview)
  render clean in preview, no console errors; merged-form logic confirmed by
  code review (auth-gated). **Deployed** ✅ hosting.
- Ops note: the crashed session's orphaned dev server held port 3000 — freed
  via Stop-Process before preview.

## 2026-07-12 (later still)

### Fixed — blank rows in the Audit log
Founder's screenshot showed entries reading just "TJ" with no action.
Cause: server-written audit actions (e.g. `marketingRunNow` from the admin
panel's send/post-now button) weren't in the client's `describeAction` map,
which returned `undefined`. Added the mapping AND a fallback that renders any
unknown action as readable text ("did …") so no future server-side action can
ever produce a blank row ([audit.ts](workit/src/lib/audit.ts)). Deployed ✅.

## 2026-07-12 (later)

### Added — admin panel enhancement pack (5 upgrades, founder-approved list)
1. **Real-time submission alerts** — new
   [submissionAlerts.ts](workit/functions/src/submissionAlerts.ts) trigger:
   the moment anyone submits/re-submits verification docs, the founder gets an
   email (with a ✓/✗ breakdown of which docs are present, read from the
   private doc via Admin SDK) and every admin gets a push. Review-speed = a
   trust feature; the morning digest alone left an hours-long gap.
2. **Preset note chips** on review cards — one tap fills the note box with the
   four most common review messages (blurry ID / selfie speeds approval /
   stale address proof / ID number mismatch).
3. **💬 WhatsApp button** on review cards — wa.me deep link with a friendly
   prefilled greeting; founder sends from his own WhatsApp (no automation).
4. **Funnel strip** on Account approvals — signed up · submitted docs ·
   approved · median approval time, computed from the tab's existing full
   scan. The acquisition machine's health at a glance.
5. **New "Outreach" tab** — the marketingLeads pipeline made visible: status
   counts (pending/sent/replied/signed-up/opted-out/bounced), search, and
   one-tap **Replied / Signed up ✓ / Skip** status updates so email
   conversion is finally measurable. Backed by a rules addition
   (`marketingLeads`: admin read+update only, create/delete stay server-only)
   — **rules test suite run: all green**.
- tsc + functions + app builds clean; rules + function + hosting deployed ✅.
- Fixed in passing: funnel strip initially broke JSX nesting (fragment), and
  the new AdminSection needed sectionMeta coverage — both caught by tsc.

## 2026-07-12

### Added — free fraud-signal layer on verification (no paid providers)
Founder asked how to enhance ID/doc checking at zero cost, then approved the
full list (random selfie phrase dropped — the script stays "name + joining
Workit", now stated as a hard requirement in the upload hints). New
[fraudSignals.ts](workit/functions/src/fraudSignals.ts), three functions
deployed ✅ (africa-south1):
- **Duplicate-ID detection** (`onVerificationFraudSignals`): every submitted
  SA ID number goes into a one-way-hashed index (`idIndex/{sha256}` — raw
  numbers never stored); the same number on 2+ accounts flags every account
  involved. Also decodes **age from the ID number** server-side (under-18
  flag) and runs the **OCR cross-check**: Vision text-detection on the ID
  photo — does the typed ID number (and account name tokens) appear in the
  uploaded document? Catches wrong/random uploads. PDFs skipped; Vision free
  tier covers current volume (~cents past 1,000 docs/month). Self-trigger
  guarded via an inputs fingerprint.
- **Ban-evasion registry** (`onUserBanRegistry`): suspending an account
  registers sha256 hashes of its email/phone in `bannedIndex`; new sign-ups
  matching one are flagged; reinstatement clears the hashes.
- **Duplicate-file detection** (`onVerificationFileDuplicate`): Storage's own
  md5 of every `verification/` upload indexed in `fileIndex`; byte-identical
  documents across accounts flagged.
- All signals land on the PRIVATE doc (`verification.fraud`, typed in
  types.ts), ride through `getVerificationPayload`, and render as a red
  **🚩 Fraud signals** panel + OCR line on the admin review card
  ([VerificationDocs](workit/src/app/admin/_components/VerificationDocs.tsx)).
  Index collections have no client rules (default-deny, hashes only).
- **Client hard gate:** verification submit now blocks IDs whose encoded
  birth date is under 18 (worker + employer forms), regardless of typed DOB.
- App tsc + build clean, functions build clean; **deployed** ✅ hosting +
  3 new functions.

### Changed — selfie video is now OPTIONAL at verification (ID stays compulsory)
Founder call: the selfie was too much friction (data-heavy, awkward on
low-end phones). Changes:
- Worker + employer submit no longer block on `selfieVideoURL`
  ([verification/page.tsx](workit/src/app/verification/page.tsx)); ID photo,
  ID number, address (+ skills for workers) remain hard-required.
- All "required" claims softened to "optional — speeds up approval": both
  form labels, employer hero, VerifyIdPrompt, /account section, signup +
  finish-signup prep lists, how-it-works step, safety page, and the
  en/af/zu dashboard trust strings (claims now honest about optionality).
- VerificationProgress: selfie step labelled optional + `weight: 0` so
  workers without one aren't stuck at "almost done" forever.
- Safety net unchanged: admins can still **↩ Request changes** to demand a
  selfie when an ID looks doubtful — reviewer discretion instead of a
  blanket gate. Copy verified in the static export; tsc + build clean,
  deployed ✅.

## 2026-07-10

### Fixed — phone-OTP verify misreported real failures as "wrong code" + mobile pass
- **VerifyPhonePrompt confirm step** now maps the actual Firebase errors
  instead of calling everything a wrong code: `code-expired` → "send a fresh
  one"; `credential-already-in-use` → number belongs to another account;
  `requires-recent-login` → sign out/in then retry (likely what the founder
  hit — long-lived session + credential linking); `provider-already-linked`
  → treated as success; unknown errors surface their `auth/...` code for
  diagnosis. Founder to retest — the shown message now says what's actually
  wrong.
- **Mobile design sweep** (375px: landing, signup, how-it-works, safety):
  no horizontal overflow anywhere (an apparent 4px overflow on how-it-works
  was preview-scrollbar accounting, verified scrollWidth == innerWidth).
  One real clutter fix: **signup asked "get work done or do work?" twice**
  (page subtitle + inside the phone form) — in-form copy removed, verified
  single occurrence. Landing/bottom-nav confirmed clean. tsc + build clean,
  deployed ✅.

All notable changes to Workit (app, Cloud Functions, and the investor/system deck).
Dates are when the work was done. Newest first.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com).
Categories: **Added** (new features), **Changed** (behaviour/UX), **Fixed** (bugs),
**Design** (visual/design-system), **Ops** (infra/deploy/monitoring), **Docs**.

---

## 2026-07-11

### Docs — Facebook group recruitment post; phone-OTP "bug" diagnosed as working-as-designed
- New [facebook-group-post.md](workit/marketing/outreach/facebook-group-post.md):
  motivational worker-recruitment post (+ short variant) with the /signup
  link, for the founder to post in Gauteng job-seeker Facebook groups
  (admin-first etiquette still applies).
- **VerifyPhonePrompt OTP investigation:** founder reported correct codes
  failing on the tester account. Auth export showed the test number
  (+27816512256) is already a phone credential on the founder's main Google
  account — Firebase allows a number on ONE account only, so the link is
  correctly refused after the code check (the card's
  "already linked to a different account" message is accurate). Not a bug;
  test with a never-used SIM or unlink the number from the main account
  first. (Export deleted after diagnosis — PII.)

## 2026-07-10

### Changed — every sign-up now requires BOTH email and phone (founder decision)
All three signup paths now capture both contact channels — the account
prompts (VerifyPhonePrompt / AddPasswordPrompt) remain as the *verification*
layer, but capture itself is compulsory at the door:
- **Phone signup** ([PhoneAuthForm](workit/src/components/PhoneAuthForm.tsx)):
  new required email field (regex-validated pre-OTP) → `PhoneSignUpInfo.email`
  → stored on the profile doc by `confirmPhoneCode`
  ([AuthContext](workit/src/contexts/AuthContext.tsx)). Unverified until they
  add a password — it's the contact record, not a credential.
- **Google signup** ([finish-signup](workit/src/app/finish-signup/page.tsx)):
  phone was optional → now required + `normaliseSaPhone` E.164 validation
  (mobile-only, matches the SMS-verify flow it feeds).
- **Email signup** ([signup](workit/src/app/signup/page.tsx)): phone was
  required but unvalidated free text → now normalised/validated to E.164
  before account creation.
- Verified in preview on /signup: phone-mode email field present + required,
  invalid email blocked pre-OTP with clear message; email-mode landline (011)
  rejected, mobile required. (Note: the email form surfaces errors under the
  password field — pre-existing pattern.) Google path shares the same
  validation code; tsc covers it. Build clean, **deployed** ✅ hosting.
- Scope note: existing accounts with one channel missing are untouched —
  the non-dismissible account prompts keep chasing those.

### Added — new-sign-up visibility: glow + newest-first + founder email alert
Founder asks, all three shipped:
- **Admin list sorts newest-first** (approvals + verification tabs) —
  [admin/page.tsx](workit/src/app/admin/page.tsx) sorts by `createdAt` desc.
- **Fresh sign-ups glow**: accounts created in the last 24h get an ochre
  glowing card border + a pulsing "● NEW" badge next to the name.
- **Email on every sign-up**: new
  [signupAlerts.ts](workit/functions/src/signupAlerts.ts)
  (`onUserCreatedNotifyFounder`, fires on users/{uid} create; skips admins)
  emails **tshepowayne@workitsa.co.za** with name/role/email/phone/area and a
  **docs-submitted line** (✅ submitted / ⏳ not yet — at signup it's almost
  always "not yet"; the missing-docs filter picks them up), **BCC
  tshepowayne2@gmail.com**, CTA → /admin. Exported in index.ts.
- Ops note: functions deploy hit "Cannot determine backend specification.
  Timeout after 10000" — transient discovery timeout; retry with
  `FUNCTIONS_DISCOVERY_TIMEOUT=60` worked.
- tsc + app build clean, **deployed** ✅ hosting; functions build clean,
  **deployed** ✅ `onUserCreatedNotifyFounder` (created, africa-south1).

### Docs + Ops — Zapier AI agents run as a SECOND outreach lane (founder decision)
New [zapier-agent-prompts.md](workit/marketing/outreach/zapier-agent-prompts.md):
two ready-to-paste prompts — **A: lead-researcher** (15 new Gauteng
businesses/weekday into a Google Sheet, public business emails only/POPIA) and
**B: sender** (10/day from the founder's own mailbox, one-email-ever,
unsubscribe handling, bounce circuit-breaker). Founder chose to run BOTH the
Firebase lane AND the Zapier lane in parallel; the collision guard is the
shared "Workit leads" Google Sheet with a **Firebase lane** tab both agents
must check — new [export-leads.mjs](workit/functions/scripts/export-leads.mjs)
exports `marketingLeads` to
[firebase-lane-leads.csv](workit/marketing/outreach/firebase-lane-leads.csv)
(**73 leads exported today**; founder pastes into the tab).
⚠ **Standing rule for the business-lead session:** after every
`import-leads.mjs` batch, re-run `export-leads.mjs` and tell the founder to
re-paste — that's what keeps the two lanes from emailing the same company.
Zapier Queue rows must NEVER be imported into the Firebase queue.

### Fixed — SA ID uploaded as PDF vanished from the admin review card
Founder's tester account: selfie video + proof-of-address showed on the
review card, but the submitted ID didn't. Root cause in
[VerificationDocs.tsx](workit/src/app/admin/_components/VerificationDocs.tsx):
docs are classified by extension (image → thumbnail, video → inline player,
other → link chip), but only Proof-of-address and Police-clearance had a
file-chip fallback — an **SA ID uploaded as a PDF** (the uploader accepts
PDFs) classified as "file" and rendered nowhere. Rebuilt the placement so
**every** doc lands somewhere: one `place()` helper routes each of SA ID /
address proof / police clearance / past-work photos / selfie video to
thumbnail, player, or 📄 link chip by its actual type — nothing can silently
drop again (also covers e.g. a selfie in an odd video format). The document
itself was always safely stored — this was display-only. tsc + build clean,
**deployed** ✅ hosting.

### Changed — approval emails: role-aware copy + founder BCC
Founder asked whether users get an email on account approval. **They already
did** — [verificationAlerts.ts](workit/functions/src/verificationAlerts.ts)
sends push + email on every verificationStatus decision, and both approve
paths unify account+verification status, so every approval triggers it.
Two gaps fixed:
- **Founder copy:** approval emails now **BCC tshepowayne@workitsa.co.za**
  (his ask) — a running inbox record of everyone let onto the platform.
  `send()` in [mailer.ts](workit/functions/src/mailer.ts) gained an optional
  `bcc` (auto-skipped when it duplicates `to`). Reject/changes emails stay
  founder-copy-free.
- **Role-aware approval copy:** employers/businesses (who also verify since
  2026-07-08) were getting "You're now a verified Workit **worker**… accept
  jobs". Non-workers now get "Your Workit account is approved — post jobs
  and hire", CTA → /post-a-job (workers keep Find-work copy).
- Functions build clean, **deployed** ✅ `onVerificationDecision`.

### Changed — worker verification: address proof + categories/skills now compulsory
Founder: ID, address and skills must be required. Audit first — **the
submit→admin pipeline is confirmed working end to end**: per-field uploads
persist to the private doc immediately + stamp `verification.submittedAt`;
`onUserVerificationSubmitted` promotes to verification-pending (prod logs
show two real promotions this morning, 02:27 + 07:04); the admin queue's
submitted/pending/resubmitted/missing-docs filters cover every state.
What was NOT yet enforced at submit: proof-of-address upload and the
category/skills picker. [verification/page.tsx](workit/src/app/verification/page.tsx)
worker form now blocks submit without: valid SA ID number + ID photo +
selfie video (already enforced), **address line, proof-of-address upload,
skills summary, ≥1 category and ≥1 specific skill** — with clear per-field
error messages and * markers. (Employer form unchanged: its scope is the
identity core — ID number + photo + selfie, all already required.) Note the
deliberate leak that remains: a worker who uploads one doc and abandons
still appears in the admin queue with partial docs (per-field persist is by
design so admins see uploads live) — the admin's Request-changes flow covers
those. tsc + build clean, **deployed** ✅ hosting.

### Ops — recovered the failed deploy; DMARC reports read; Sentry noise filtered
- **Failed deploy recovered.** The other session's morning hosting deploy
  failed; diagnosis: every exported Cloud Function is already live (code ↔
  prod parity confirmed via `functions:list`), tsc clean — and the first
  build retry here failed with `next/font: Failed to fetch Fraunces/Manrope`,
  a transient Google-Fonts network error at build time. Retried → build +
  **hosting deploy ✅** (this morning's admin-panel change is now live).
  Lesson for future sessions: a failed build mentioning Google Fonts is
  network flake — just retry.
- **DMARC aggregate reports reviewed** (founder's Microsoft + Google
  attachments, 7–9 Jul, for workitsa.co.za — policy p=quarantine): **all
  ~40 messages passed DMARC, zero spoofing, nothing quarantined.** All
  SendGrid sends (149.72.x / 159.183.x, em3461 envelope, s1 DKIM) pass
  SPF+DKIM — domain authentication is set up correctly. The few SPF-fail
  rows are classic **forwarding breakage** (recipients' servers relaying,
  e.g. xneelo hosts) rescued by DKIM → still DMARC pass. No action needed;
  optional future hardening: p=quarantine → p=reject once volume grows.
- **Sentry: Facebook in-app browser noise silenced**
  ([sentry.ts](workit/src/lib/sentry.ts)): the JAVASCRIPT-8/-9 alerts
  ("Java object is gone" / "Java exception was raised during method
  invocation" from `navigation_performance_logger_android`) are thrown by
  **Facebook's own script** injected into its Android WebView — every
  visitor arriving via the FB posts fires them. Added `ignoreErrors` +
  `denyUrls` so real errors page the founder, not Facebook's logger.
  Silver lining: those events are proof the Facebook marketing is driving
  real visitors (Huawei/Honor Androids) to the site. tsc + build clean,
  **deployed ✅** hosting.

## 2026-07-09

### Fixed — "Approve + Gold badge" left the account stuck on pending
Founder report: approving docs on the verification tab didn't unlock the
account. Root cause: the 2026-07-08 unification ("the doc review IS the
account review") was one-directional — `setAccountStatus` mirrored account
approval onto `verificationStatus`, but `reviewVerification` (the handler
behind **Approve docs** / **Approve + Gold badge** / **Reject docs**) never
touched `accountStatus`, so doc-approved users stayed pending and locked out.
[admin/page.tsx](workit/src/app/admin/page.tsx) `reviewVerification` now
unifies the reverse direction: doc approval → `accountStatus: "approved"`
(+ `accountReviewedAt`); doc rejection → rejects a still-**pending** account.
A **suspended** account is never silently changed from the docs buttons —
suspension stays a separate moderation state. tsc + build clean,
**deployed** ✅ hosting.

### Changed — admin emails now BCC the founder (the "empty Sent folder" mystery)
Founder reported the docs-reminder emails missing from Outlook's Sent box.
**Not a bug** — function logs confirmed the send succeeded (SendGrid accepted
it); adminEmailUser delivers via **SendGrid**, which never touches the Outlook
mailbox, so Sent can't show them. The real sent-record is SendGrid's Activity
Feed + the Firestore audit log. To give the founder a copy in his own mailbox
anyway:
- [adminEmail.ts](workit/functions/src/adminEmail.ts) now **BCCs
  tshepowayne@workitsa.co.za** on every send — each reminder lands in the
  founder's *Inbox* as a filable record (skipped if the recipient IS the
  founder — SendGrid rejects a bcc duplicating the to-address).
- [EmailUserButton](workit/src/app/admin/_components/EmailUserButton.tsx)
  compose hint now explains where copies land (Inbox via BCC, not Sent) so
  this doesn't confuse the next admin.
- Functions build clean, **deployed** ✅ `adminEmailUser`; app tsc + build
  clean, **deployed** ✅ hosting.

## 2026-07-08

### Added — admin "Email docs reminder" + FIXED the verification-tab blind spot
- **Bug (self-inflicted this morning):** the verification tab had no filter for
  the new `changes_requested` status — anyone the founder hit "↩ Request
  changes" on vanished from every view. Added **"changes requested"** filter
  chip; those users are visible again.
- **New "missing docs" filter** — accounts still pending with no verification
  submitted: exactly who to chase.
- **✉ Email docs reminder** button on review cards (shows when the user has an
  email + no docs): opens an editable pre-typed template, sends via new
  admin-gated [adminEmailUser](workit/functions/src/adminEmail.ts) callable
  **from tshepowayne@workitsa.co.za** (replies return there). Recipient is
  looked up by UID server-side (can't be used as an open relay); every send is
  audit-logged. Deployed ✅ (hosting + function).

### Changed — employers now verify ID too + signup asks "hiring as a business?"
Founder: "I need work done" must require ID like the worker path.
- **Welcome flow routes EVERY role through /verification** after profile
  ([profile/page.tsx](workit/src/app/profile/page.tsx)) — employers/businesses
  get the identity-core form (ID number + photo + selfie, already enforced at
  submit). Accounts were already created `pending` for all roles; the doc
  review is now part of approval. Employer form + /account copy flipped from
  "optional / never required" to **required**; PendingScreen's "Submit
  verification" button now shows for all roles.
- **Signup simplified to two intents** ("I need work done" / "I want to work")
  on BOTH email + phone forms; picking "need work done" asks **"Are you hiring
  as a business?"** (No, just me → employer · Yes → business, with the
  public-profile explainer). Old third "I'm a business" card removed.
- Admin approvals: approving/rejecting an account now unifies
  `verificationStatus` for employers/businesses with submitted docs (was
  worker-only).
- Verified in preview on /signup: both intents render, business question
  toggles roles correctly, old card gone. tsc + build clean, deployed ✅.
- ⚠ Trade-off flagged: this adds friction to the demand side (employers used
  to reach posting faster). Watch signup-completion in GA4; revert is small.

### Added — ID card joins the /account prompt stack (workers)
Founder: "I want the ID part here too." New
[VerifyIdPrompt](workit/src/components/VerifyIdPrompt.tsx) sits with the
email/phone cards — status-aware: none → "required before you can take jobs" +
Get verified; changes_requested/rejected → the admin's note + Fix and
resubmit; pending → quiet "in review" reassurance; approved → hidden.
Workers-only (employers keep their optional section). tsc + build clean,
deployed ✅.

### Added — contact completeness: phone users add email, email users verify phone
Founder audit of the first sign-ups: phone sign-ups were never asked for an
email (decision emails couldn't reach them!), and email sign-ups' typed phone
number was never verified.
- **New [VerifyPhonePrompt](workit/src/components/VerifyPhonePrompt.tsx)** on
  /account for email/Google users: OTP-links their number via
  `linkWithPhoneNumber` (new `startPhoneLink`/`confirmPhoneLink` in
  AuthContext, shared reCAPTCHA helper) → sets `phone` (E164) +
  **`phoneVerified: true`** (new UserProfile field) and the number becomes a
  sign-in method. Friendly errors for number-already-linked / rate limits.
- **AddPasswordPrompt is no longer dismissible** (was: "Not now" hid it
  forever) — reworded around "we send your verification result by email";
  card persists until an email is linked. Signup email-form phone field now
  `required` with honest hint copy ("you'll confirm with an SMS code").
- Note: each phone verification costs one OTP SMS (Identity Platform billing).
  Founder (email account) can self-test: /account → "Verify your phone number".
- **Also answered founder's question:** ID documents ARE enforced — not on the
  signup form but as step 2 (/verification); accounts stay pending without them.
- tsc + build clean, deployed ✅.

### Added — "Request changes" review action + decision notifications
Founder (reviewing his first real sign-ups) wanted to send feedback before
approving — e.g. "re-upload your ID". Gaps found: reject was the only feedback
action (harsh/final), and NO notification existed on any review decision — a
user only saw the outcome by reopening the app.
- **New status `changes_requested`** (types + audit action). Admin panel:
  **"↩ Request changes"** button on both the Account-approvals and
  Verification tabs — requires the "Note to user" text (it IS the message),
  writes reviewerNote + accountReviewerNote, audit-logged.
- **New `onVerificationDecision` trigger**
  ([verificationAlerts.ts](workit/functions/src/verificationAlerts.ts)): on any
  verificationStatus transition to approved / rejected / changes_requested →
  **push + branded email** to the user with the admin's note and a deep-link
  CTA (fix → /verification, approved → /find-work).
- **Worker UI:** prominent "One quick fix needed" banner on /verification
  showing the note; /account card handles the new state ("Fix and resubmit").
  Resubmission from changes_requested returns to **pending** automatically
  (verification.ts branch extended) and re-enters the admin queue.
- Gates clean; hosting + functions deployed via background retry (network to
  googleapis.com flapping again).

### Changed — worker verification: ID photo + selfie video now COMPULSORY
First real sign-ups arrived; founder wants verification docs enforced. Found a
gap: the submit handler only checked consent + SA ID number — the **ID photo
and selfie video uploads slipped through as null**. Now the worker verification
submit blocks with a clear message until both are uploaded, and both fields
carry a required `*` marker ([verification/page.tsx](workit/src/app/verification/page.tsx)).
tsc + build clean, deployed ✅.
- **Deliberately NOT done — qualifications/certifications/training compulsory:**
  flagged to founder as a supply-side risk (most gardeners/cleaners/movers have
  no formal certs; blanket-requiring them would block legitimate workers and
  contradict Workit's "honest work" ethos). Recommended category-specific
  requirements instead. Awaiting founder decision.

### Design — find-work filters are now progressive (results lead the page)
Founder felt the page was top-heavy at launch — the big filter panel (12
category chips + distance + sort) dominated while 1 job sat below.
- **Search stays always-visible; category/distance/sort collapse behind a
  "Filters" toggle** ([find-work/page.tsx](workit/src/app/find-work/page.tsx)).
  Collapsed by default so results lead. Collapsed state shows a summary
  ("All · 25 km · Best for you") + an **ochre count badge** of non-default
  filters active; expanded restores the full chip set unchanged.
- New i18n key `findWork.filtersBtn` (en/af/zu). Verified both states via
  headless capture of a temp lab (find-work is sign-in gated); lab deleted.
  tsc + build clean, **deployed** ✅.
- Deeper fix for the sparse feed is liquidity, not layout — this page fills
  out naturally as jobs grow.
- **Follow-up shipped same day:** the recently-viewed strip now only renders
  when the live feed has **≥ 3 results**, so it can't out-number a thin feed
  (was: could show ~5 recently-viewed cards above 1 real result). Deployed ✅.

### Design — decluttered the desktop header (7 nav links → 4 + two dropdowns)
Founder felt the top bar was busy. Root cause: the nav mixed 4 core action
links with 3 info pages, plus a 5-item right cluster.
- Primary nav trimmed to **Find work · Post a job · Workers · Businesses**;
  How it works / Safety / FAQ moved into a new **"More" dropdown**
  ([NavMore.tsx](workit/src/components/NavMore.tsx)).
- Right cluster folded: My jobs, Account and the standalone Sign out button
  now live in a single **avatar dropdown**
  ([AccountMenu.tsx](workit/src/components/AccountMenu.tsx)). Right side 5 → 3.
- Both dropdowns follow the LanguageSwitcher pattern + Escape-to-close; new
  i18n keys `nav.more/account/myJobs` (en/af/zu). Mobile bottom-nav untouched.
  Verified via temp lab (headless capture shown to founder); lab deleted.
  tsc + build clean, **deployed** ✅.
- **Auth-aware follow-up shipped (same day):** logged-out visitors now see
  How it works / Safety / FAQ **inline** (trust-builders on the marketing
  pages); signed-in users keep the tidy 4-links + "More". Keys off `user` from
  useAuth; during auth-loading it shows the tidy version to avoid a flash of
  the full set. `MORE_LINKS` exported from NavMore as the single source.
  Verified logged-out DOM (7 links inline); tsc + build clean, **deployed** ✅.

### Docs — worker-recruitment outreach in flight: Harambee contacted, emails finalised, handoff note
(Worker/supply side — complements the business-lead outreach below.)
- **First worker-side outreach sent:** founder WhatsApp'd the SA Youth/Harambee
  talent line (+27 64 869 8829) with the staged opportunity-holder ask.
  Tracked in [target-list.csv](workit/marketing/outreach/target-list.csv)
  (awaiting reply; follow up once after ~5 working days).
- **CIPC company issue resolved** (founder confirmed) — government recipients
  (Nasi iSpani, NYDA) unblocked in the tracker.
- **Two paste-ready emails finalised** in
  [partner-letter.md](workit/marketing/outreach/partner-letter.md) ("FINALISED
  EMAILS"): Nasi iSpani (Ouma Sipoya, gauteng.gov.za) and Afrika Tikkun (FAO
  Nompikazi Mokgatle). Attach the worker one-pager PDF to both.
- Contact verification: Telegram mostly tiny (Jobs27 / SA Gov Vacancies
  dropped; JobCareAfrica 2,483 subs kept); SA Youth talent WhatsApp line,
  Nasi iSpani, NYDA and Afrika Tikkun contacts captured in the tracker.

### Added — email outreach TWICE daily (08:30 + 13:30, 30/day total)
- New **`scheduledMarketingOutreachAfternoon`** (weekdays 13:30 SAST). Both
  runs share the `sentTodayCount()` budget: new `batchCap` (15/run) +
  `dailyCap` raised to 30 in `marketing/config` — two batches a day, and no
  combination of scheduler runs + admin-button presses can exceed 30/day.
  Panel shows "Weekdays 08:30 & 13:30 · X/30 sent today".
  Deployed ✅; both scheduler jobs verified ENABLED.
- ⚠ Runway math at 30/day: ~44 pending leads last **~1.5 days** — the queue
  runs dry Thursday afternoon. Batch #3 research (and likely a standing weekly
  lead-refresh) is now the constraint, flagged to founder.
- Also staged **fb-clips2** production: marketer agent producing 5 animated
  brand clips (10–15 s, 1080² MP4) for the 08:00 slot; today's 08:00 clip
  (`ad vid 1.mp4`) confirmed queued with the scheduler job ENABLED.

### Added — Facebook posts TWICE daily: 08:00 video clip + 17:30 image
- Founder asked for a morning clip slot. New **`scheduledFacebookPostMorning`**
  (08:00 SAST) posts only **video** queue entries via Graph `/videos`
  (signed-URL `file_url` + description); the 17:30 run now posts only
  images/text. `runFacebookPost(slot)` filters by `mediaType`; the admin
  button still takes the oldest of any kind. Per-slot empty-queue nudges.
- [import-posts.mjs](workit/functions/scripts/import-posts.mjs): `"videoPath"`
  entries upload as `video/mp4` → 08:00 slot. Panel shows **clips · images**
  queue split + "Clips 08:00 · images 17:30".
- **Staged the two existing ad clips** (`ad vid 1.mp4`, `ad vid 2.mp4`, made
  2026-06-19) as the first morning posts — 2 mornings of runway; a proper clip
  batch is the next content task. ⚠ If the first 08:00 video errors with a
  permission message, the Page token needs the `publish_video` permission
  added in Graph Explorer (regenerate + `functions:secrets:set` + redeploy) —
  failure alert email will say so.
- Functions + hosting deployed ✅; builds clean.

## 2026-07-07

### Ops — lead batch #2 (41) + Facebook week-2 content (7 posts) staged & imported
- **Leads:** marketer agent researched 41 new Gauteng businesses (Vaal 10, West
  Rand 8, deeper East Rand 12, JHB South, Soweto, Tembisa; new categories:
  security, venues, painters, laundromats, nurseries, gyms, pest control,
  panel beaters) — zero overlap with batch 1, all emails publicly displayed
  with source URLs recorded
  ([leads-2026-07-07-batch2.json](workit/marketing/outreach/leads-2026-07-07-batch2.json)).
  Reviewed — no prunes needed. **~43 pending ≈ 3 weeks of weekday sending.**
- **Content:** 7 on-brand graphics + captions
  (`workit/marketing/content/week2-*.png`, queue
  [fb-week2.json](workit/marketing/queue/fb-week2.json)) — how-it-works, trust,
  weekend-jobs, safety, workers-earn, two-minutes, businesses. All 7 visually
  reviewed; **queue reordered so the weekend post publishes Friday 17:30.**
- **Import resilience:** founder's network to googleapis.com flapped all
  evening (browser fine, CLI timing out) — imports ran in a background retry
  loop and completed across three connectivity windows.
  [import-posts.mjs](workit/functions/scripts/import-posts.mjs) gained a
  dedupe pass (by image basename/caption) so retried imports can never
  double-queue; import-leads already deduped by email (verified working —
  20 correct skips on the final attempt).

### Changed — dailyCap is now a TRUE daily cap (button + scheduler share one budget)
- Founder pressed "Send now" twice on day one → 30 emails (cap was per-run).
  Now `runOutreachBatch` counts today's `sentAt` stamps (SAST day; range-only
  query, no composite index) and sends only `dailyCap − sentToday` — pressing
  the button repeatedly can never exceed the day's budget (sender-reputation
  protection). Panel shows **"X/15 sent today"**, disables the button at cap
  with a "resumes next weekday 08:30" hint, and the confirm dialog states the
  remaining budget. Verified via lab SSR (disabled attr at 15/15, enabled at
  4/15 — preview browser bridge was hung, checked the rendered HTML directly);
  lab deleted. Functions + hosting deployed ✅.

### Changed — every outreach email BCCs the founder's Gmail
- Each sent outreach email now carries `bcc: tshepowayne2@gmail.com` (follows
  `marketing/config.replyTo`) so a copy lands in the founder's Gmail — **BCC
  not CC** by design: recipients must not see the personal address. Skipped if
  the recipient IS the reply-to address. Deployed ✅ (took 6 auto-retries — the
  founder's Firebase CLI token had expired during a connectivity wobble).
  Founder tip: Gmail filter `from:tshepo@workitsa.co.za` → label + archive
  keeps the 15/day copies tidy; the daily summary remains the overview.

### Changed — outreach sender is now tshepo@workitsa.co.za
- New `marketing/config.fromEmail` (set to `tshepo@workitsa.co.za`) — outreach
  emails + daily summaries use it; transactional mail keeps `noreply@` (shared
  `SENDGRID_FROM_EMAIL` untouched). If SendGrid rejects the address as an
  unverified sender the batch **auto-falls back to noreply@ mid-run** and the
  founder's summary email carries a red warning — a bad config value can never
  cost a day's sending. Deployed ✅. ⚠ Founder: if `tshepo@` isn't a real
  mailbox/alias yet, create one — Reply-To already routes replies to Gmail, but
  fresh mail composed to the visible address would bounce.

### Added — Marketing panel in /admin (run-now buttons + queue status)
- **Admin → Growth tab** now opens with a **Marketing automation** card
  ([MarketingPanel.tsx](workit/src/app/admin/_components/MarketingPanel.tsx)):
  per-channel ON/PAUSED pills, live queue counts (leads pending/sent/opted-out,
  posts queued/posted), and **"Send next batch now" / "Post next queued now"**
  buttons so the founder never needs Cloud Scheduler's Force run.
- Backend: `runOutreachBatch()` / `runFacebookPost()` extracted from the
  schedulers (shared code path — every guardrail applies to manual runs), plus
  new callables in [marketingAdmin.ts](workit/functions/src/marketingAdmin.ts):
  `marketingStatus` (admin; aggregate counts) and `marketingRunNow` (admin +
  **2FA**, same bar as broadcast/erasure; audit-logged). Collections stay
  server-only — counts come via the callable, no rules changes.
- Confirm dialogs state the blast radius before sending ("up to 15 pending
  leads… can't be unsent"). Verified in preview via temp lab (both states +
  dialog; lab deleted). tsc + build clean; functions + hosting deployed ✅.

### Ops — marketing automation SWITCHED ON (both channels live)
- **Facebook:** founder approved ("post it") → `fb-week1.json` imported; first
  post (categories graphic + caption) publishes **today 17:30 SAST** to the
  Workitsa Page.
- **Email outreach:** workit-marketer agent researched the first real lead
  batch (33 found, all with publicly-displayed business emails + source URLs;
  agent flagged 3 low-confidence). **ZXT Landscapes pruned** pre-import (gmail
  from a third-party listicle — weakest POPIA provenance). **32 leads imported**
  to `marketingLeads` (research record:
  [leads-2026-07-07.json](workit/marketing/outreach/leads-2026-07-07.json));
  founder set `marketing/config.enabled=true` himself in the console. First
  batch of 15 sends **Wed 2026-07-08 08:30 SAST**, then 15 Thu, 2 Fri.
  Weekday-only cadence kept deliberately (weekend cold email hurts reply
  rates); founder offered a 7-day switch if wanted.

### Added — automated daily Facebook posting (deployed + live-verified)
- **`scheduledFacebookPost`** (europe-west1, daily 17:30 SAST) —
  [facebookPoster.ts](workit/functions/src/facebookPoster.ts). Publishes the
  oldest **queued** `marketingPosts` doc to the **Workitsa** Facebook Page
  (`2159653247693475`) via Graph API v25: photo posts from Storage
  `marketing/posts/` via 6-h signed URL (+ caption), text posts to /feed.
  Founder-created **`META_PAGE_TOKEN`/`META_PAGE_ID`** secrets (separate
  "Workitsa Publisher" Meta app — the WhatsApp/Jarvis app untouched). Token
  health-check before every run; failure + one-time queue-empty alerts email
  the founder; kill switch `marketing/config.fbEnabled=false` (defaults ON —
  staging a post is the approval). `retryCount: 0` so a retry can never
  double-post.
- **Staging** (= human approval, same pattern as outreach):
  [import-posts.mjs](workit/functions/scripts/import-posts.mjs) uploads images
  to Storage + queues docs, file order = posting order. First batch prepared at
  `workit/marketing/queue/fb-week1.json` (categories graphic) — **not imported;
  founder runs the import to go live.** Marketer agent brief + OPS_QUICKREF §5c
  updated.
- **Live verification (no post made):** forced a scheduler run — logs show
  `Facebook token OK — Page: Workitsa (2159653247693475)` then
  `queue empty — nothing to post`. Functions build clean; deployed ✅.

## 2026-07-06

### Added — automated B2B outreach pipeline (deployed, ships OFF) + security notes
- **`scheduledMarketingOutreach`** (europe-west1, weekdays 08:30 SAST) +
  **`marketingOptOut`** (africa-south1) — [marketingOutreach.ts](workit/functions/src/marketingOutreach.ts).
  Emails up to `dailyCap` (default 15) pending `marketingLeads` via SendGrid
  **from workitsa.co.za with Reply-To = founder's Gmail** (chosen over raw Gmail
  sending: deliverability + Gmail bulk-policy risk), POPIA §69-conscious footer
  (identification, honest source line, one-click HMAC opt-out + List-Unsubscribe
  headers), opt-outs suppressed across duplicate lead docs forever, per-run
  founder summary email. **Master switch `marketing/config.enabled` — deployed
  disabled;** weekdays only; no rules changes (collections are server-only under
  the catch-all deny). Runbook: OPS_QUICKREF §5b.
- **Lead import = the human approval step:**
  [import-leads.mjs](workit/functions/scripts/import-leads.mjs) (gcloud-token +
  Firestore REST, no service-account file) queues marketer-staged JSON batches;
  never re-queues an email already in history or opted out.
- **workit-marketer agent brief updated** with the delivery-pipeline contract
  (stage `leads-YYYY-MM-DD.json`, propose template copy; the agent itself still
  never sends).
- **Facebook auto-posting NOT live yet** — needs founder-created Meta Page +
  developer app + Page token in Secret Manager (checklist given to founder);
  poster function is the next build once the token exists.
- **Security open items noted** (founder asked to return to them):
  SECURITY_AUDIT.md § "OPEN ITEMS — re-verified 2026-07-06" + BACKLOG pointer.
  Top of list: App Check + `requestPasswordReset` rate limit before marketing
  pushes draw attention.
- Functions build clean; both functions deployed ✅ (`workit-6a927`).

### Docs — worker-recruitment outreach assets (3 drafts, ready for review)
The three assets the research doc called for, under `workit/marketing/outreach/`:
- [workit-worker-onepager.html](workit/marketing/outreach/workit-worker-onepager.html) —
  worker-facing flyer on the **canonical palette** (the business one-pager
  still carries the older `#C2632E` variant): "Get paid for the skills you
  already have", a prominent never-pay-to-apply callout (scam-wary audience),
  4 join steps including pick-your-skills, category list, live QR to
  workitsa.co.za/signup. Print-ready.
- [admin-outreach-message.md](workit/marketing/outreach/admin-outreach-message.md) —
  WhatsApp/Telegram/FB group-admin scripts: first message, single follow-up,
  a ready-to-post group message, Telegram variant, optional referral-code
  sweetener (rides the existing ?ref= system), etiquette rules
  (admin-first, one follow-up max), tracking via target-list.csv.
- [partner-letter.md](workit/marketing/outreach/partner-letter.md) — formal
  one-page letter (base + openings for SA Youth/Harambee, Nasi iSpani,
  NYDA/labour centres, NGOs) with a send checklist. Flags the **CIPC
  "FUTHERSKY" spelling + deregistration issue** as a hard blocker before any
  government recipient runs due diligence.
- All draft-and-review; nothing sent. No app changes, no deploy.

### Docs — worker-recruitment outreach research (supply-side growth)
New [worker-recruitment-communities.md](workit/marketing/outreach/worker-recruitment-communities.md):
web-researched, tiered list of SA groups/communities that help unemployed
people find work, as outreach targets to recruit Workit workers. Tier 1
institutional (SA Youth/Harambee — register as opportunity holder; **Nasi
iSpani** — its 45k Gauteng trainees learn exactly Workit's trade categories;
NYDA; labour centres), Tier 2 Gauteng NGOs (Afrika Tikkun, Khulisa, SOS),
Tier 3 Facebook groups (incl. the Jobs South Africa 6-page/12-group network),
Tier 4 WhatsApp/Telegram job groups (~850 nationally, admin-first approach),
Tier 5 CareerTok creators. Includes ground rules (admin-first, POPIA, lead
with anti-scam trust), a priority order, and the 3 assets to draft before
sending (worker one-pager, admin message, partner letter). Draft-and-review —
nothing sent.

### Changed — Workers tab in the mobile bottom nav
Follow-up to the discoverability entry below: the bottom tab bar (the primary
mobile navigation) now has a **Workers** tab — Home / Find work / Workers /
Post / Me ([MobileBottomNav.tsx](workit/src/components/MobileBottomNav.tsx)).
- Grid widened 4→5 columns; new two-person icon; active on /workers and /u
  (profiles opened from the directory keep the tab lit).
- Hardened the admin variant: the Post→Admin swap was `splice(2, …)` by
  hard-coded index, which the new tab silently shifted — now looked up by
  href.
- Labels stay hardcoded English like the rest of the bar (its i18n rides with
  the /workers i18n backlog item).
- Verified at 375px in preview: 5 equal columns on one row, labels fit, tab
  navigates (guest → signin?next=/workers/ gate flow intact). tsc + build
  clean. **Deployed** ✅ to `workit-6a927` (hosting).

### Changed — worker directory is now discoverable (header nav + employer dashboard)
The founder asked "where do I search for employees" — the only route to
/workers was a small footer link. Now:
- **Header nav** gains a **Workers** link (between Post a job and Businesses)
  with proper i18n: new `nav.workers` key — en "Workers" / af "Werkers" /
  zu "Abasebenzi" (terms consistent with the footer's existing
  `footer.browseWorkers`). [Header.tsx](workit/src/components/Header.tsx) +
  locales/en/af/zu.
- **Employer dashboard** (/account "Your jobs" header): a **Browse workers**
  outline button now sits next to "+ Post a job".
- Verified in preview: nav link renders + all three locale labels resolve via
  the language switcher. tsc + build clean. **Deployed** ✅ to `workit-6a927`
  (hosting).

### Added + Fixed — skill-nudge banner for existing workers; "Set yourself as available" toggle
Follow-up to the skill search below (same day).
- **Skill-nudge banner** (new
  [SkillNudgeBanner.tsx](workit/src/components/SkillNudgeBanner.tsx), rendered
  on /account above the AvailableNowCard for workers): every pre-existing
  worker has an empty `skills` list, and an empty list never matches a
  skill-filtered search — so workers with no skills picked see "employers can
  now search by specific skill → Add my skills" (links to /profile).
  Disappears on its own once they pick skills; "Not now" dismisses per device
  (localStorage). Closes the BACKLOG skill-nudge item.
- **Fixed: the "Set yourself as available" toggle was dead for returning
  workers.** [AvailableNowCard](workit/src/components/AvailableNowCard.tsx)'s
  8h-expiry effect read `availableNowAt` from the profile prop — a fetch-time
  snapshot (AuthContext uses getDoc, not a live subscription). A worker who
  had last toggled >8h ago would tap the switch on and the effect would see
  the *stale* old timestamp, decide the window had already expired, and flip
  the switch straight back off in the same render. Now the window start is
  tracked in local state (set at toggle time), the write failure path reverts
  to the profile's real state, and `refreshProfile()` runs best-effort after a
  successful write so the app-wide snapshot stays in step.
- Verified via a temp lab (banner shows only for skill-less workers, "Not
  now" persists; with a mocked 30h-stale profile the switch now stays ON
  after tapping — a MutationObserver showed the only flip-back at ~1s, the
  lab's expected unauthenticated write rejection, vs the old same-render
  ~10ms snap-off; lab deleted). tsc + build clean. **Deployed** ✅ to
  `workit-6a927` (hosting).

### Added — skill-level worker search ("find me a hair stylist") across all categories
Employers could only browse workers by the 11 broad categories; the
`SUBCATEGORIES` skill taxonomy (Hair, Barber, Plumbing, Bakkie hire…) existed
but only jobs used it — workers had no way to say *specifically* what they do.
Now the full search loop works: declare → search → see the work → reach out.
- **Workers declare specific skills.** New `skills?: string[]` on `UserProfile`
  (subcategory ids; unique across the taxonomy, resolved by the new
  `skillLabel()` in [types.ts](workit/src/lib/types.ts)). Picked via the new
  shared [CategorySkillsPicker](workit/src/components/CategorySkillsPicker.tsx)
  (category chips → per-category skill chips; dropping a category drops its
  skills) — wired into **/profile** (new worker-only "Work categories & skills"
  fieldset, so existing verified workers can add skills without resubmitting
  verification) and **/verification** (replaces the old category-only chips;
  submit now saves `skills` too). No rules change needed — `skills` isn't a
  protected field.
- **/workers directory upgrades** ([workers/page.tsx](workit/src/app/workers/page.tsx)):
  picking a category reveals its **skill chips** (e.g. Beauty & wellness →
  Hair / Nails / Barber); new **🟢 Available now** filter; keyword search is now
  token-based over name + bio + tagline + suburb + **category labels + skill
  labels + qualification titles**, so "hair stylist" surfaces everyone with the
  Hair skill. Available-now workers float to the top of every sort — the
  visibility the AvailableNowCard toggle always promised.
- **Worker cards show the work** (extracted to
  [WorkerCard.tsx](workit/src/components/WorkerCard.tsx)): up to 3 showcase
  photos, up to 3 skill chips (+N more), and a pulsing **Available now** badge
  (respects the 8h expiry — constant now shared via `AVAILABLE_NOW_EXPIRE_MS` /
  `isAvailableNow()` so the toggle and directory can't drift). Also fixed a
  pre-existing dup: "✓ Verified" rendered twice per card (explicit badge +
  computeBadges).
- **Public profile** ([u/page.tsx](workit/src/app/u/page.tsx)): "Works in" now
  lists specific skills under the category badges, and a live "Available for
  work right now" pill shows under the name. Reach-out was already built —
  the card links to /u where "Invite to a job" pre-fills post-a-job.
- Scope notes: /workers page strings remain English-only (same as before —
  find-work-style i18n tranche is the follow-up); job↔worker skill matching
  (boost workers whose `skills` include a job's `subcategory` in matching.ts)
  deferred to BACKLOG.
- Verified via a temp lab page (picker toggling, skills dropped with their
  category, 1h-old availability shows the badge / 10h-old doesn't, photo strip,
  +N overflow; lab deleted). tsc + build clean. **Deployed** ✅ to
  `workit-6a927` (hosting).

## 2026-07-02

### Design — elevation pass: find-work i18n depth, brand unification, skeletons, a11y
Four polish workstreams to close the gap between "works" and "feels premium".
- **i18n depth — find-work is now fully en/af/zu.** The worker's core surface no
  longer "switches back to English" after the landing page: **+54 keys ×3
  languages** ([locales.ts](workit/src/i18n/locales.ts) + en/af/zu message files)
  covering the header, category chips, search, distance/sort filters, saved
  searches, results header (with `{count}`/`{radius}` interpolation), list/map
  toggle, map notices, and both empty states. Includes new **shared
  `category.{id}` keys** for all 11 CATEGORIES (reusable by workers/post-a-job),
  consistent with the landing's established af/zu terms. Verified at runtime via
  a temp lab (en/af/zu all render, interpolation works, `<html lang>` tracks;
  lab deleted). Same zu caveat as before: wants a first-language review.
  **Next tranche:** the jobs detail page + /account (each ≈ find-work in size).
- **Brand unification.** The app already loads Fraunces+Manrope (next/font) — the
  drift was the palettes. The **site palette is now declared canonical**
  (`#d97742`/`#1f1612`/`#5d7a47`/`#faf4ec`): the workit-marketer agent kit and
  [brand/README](brand/README.md) were corrected from the older `#C2632E` growth-
  HTML variant, and today's marketing sample was regenerated on-palette.
- **Loading-state consistency.** No more blank-then-pop on slow connections: new
  `JobDetailSkeleton`, `ProfileSkeleton`, `PageSkeleton`
  ([Skeleton.tsx](workit/src/components/Skeleton.tsx)) replace bare "Loading…"
  lines on the job detail, public profile (/u), /account, /profile and
  /businesses. (Admin pages intentionally left as-is.)
- **Accessibility sweep.** Audited non-admin surfaces: images all carry alt ✓,
  glyph-only buttons all labelled ✓, global focus-visible ring ✓, and the muted-
  text contrast computes to **AA in both themes** (4.8:1 light / 5.4:1 dark).
  Fixed the real gaps: aria-labels on 9 placeholder-only inputs (find-work +
  workers + businesses searches, profile qualification fields, post-a-job
  duration/due-date/time).
- tsc + build clean. **Deployed** ✅ to `workit-6a927` (hosting).

### Added — POPIA deletion-request aging reminder (safety-net for the 30-day promise)
The erasure feature (the `eraseUserData` callable + the admin `DeletionRequestsPanel`)
was already built, wired, and deployed — but erasure is deliberately MANUAL (see
erasure.ts: "never a side effect"), so the privacy policy's "deleted within 30
days" depends on an admin actioning each request in time. New
**`scheduledDeletionRequestCheck`** ([deletionAlerts.ts](workit/functions/src/deletionAlerts.ts))
runs daily 06:00 SAST: if any pending deletion request is ≥3 days old it emails
the founder + pushes admins with the list and each one's age, escalating to ⚠
URGENT at ≥25 days (near the 30-day limit). Silent when nothing's pending or every
request is still fresh (the real-time panel covers those). Reuses the jarvisAlerts
founder-email + notify push pattern.
- Functions build clean. **Deployed** ✅ — `scheduledDeletionRequestCheck`
  (created, europe-west1 scheduler) to `workit-6a927`.
- Verified this session (backlog items were stale): the **password-reset** flow is
  code-complete + deployed — `requestPasswordReset` is live, `/forgot-password`
  wires through `resetPassword`, and `workitsa.co.za/__/auth/action` serves 200,
  so the branded reset link works. Only a real-inbox end-to-end test remains
  (founder). The **erasure** callable + admin panel are live too (admin + 2-step
  verification required to erase).

## 2026-06-25

### Added — i18n: `t()` interpolation + the deferred post-a-job dynamic strings (en/af/zu)
Closes the follow-up the 2026-06-24 post-a-job i18n entry left open: the ~5 dynamic
hint sentences (and a few other live-value strings) that had stayed English-only
because `t()` couldn't interpolate.
- **Interpolation API.** `t(key, vars?)` now replaces `{name}`-style placeholders in
  the message string ([LocaleContext.tsx](workit/src/contexts/LocaleContext.tsx)).
  No-vars calls are unchanged, so every existing call site keeps working; unknown
  placeholders are left literal. New `TranslateVars` / `TranslateFn` types exported
  and the context type updated.
- **New `postJob.*` keys** (price/crew hint with the R total, workers-needed crew
  hint, estimated-duration day/week hint, due-by hints, `PriceGuide` low/high/fair/
  range + "Use {typical}", the save/delete-template confirm dialogs, and the
  preferred-worker note) added to [locales.ts](workit/src/i18n/locales.ts) and the
  [en](workit/src/i18n/messages/en.ts) / [af](workit/src/i18n/messages/af.ts) /
  [zu](workit/src/i18n/messages/zu.ts) dictionaries.
- **Wired** [post-a-job/page.tsx](workit/src/app/post-a-job/page.tsx): hints flow
  through `t(key, vars)`; the two inline-`<b>` strings (PriceGuide's bold typical
  price, the "preference" note) follow the existing `notice.*` split convention
  (pre + `<b>…</b>` + post) so word order stays translatable. Renamed the
  `onDeleteTemplate` param `t`→`tpl` to stop it shadowing the translate fn.
- Scope note: the invite banner ("Inviting …" / "… will get a direct notification")
  is still English — out of this task's scope, flagged for a future pass.
- Verified all 3 locales resolve + every placeholder fills via a temp lab page
  (deleted before deploy); no console errors. tsc + build clean. **Deployed** ✅ to
  `workit-6a927` (hosting).

## 2026-06-24

### Changed — i18n: post-a-job flow now translated (en/af/zu)
First run of the **agent pipeline** (Scout → Architect → Builder → Reviewer) end to
end. Scout flagged the post-a-job page as the biggest i18n gap; the rest of the line
planned, built and shipped it.
- New `postJob.*` namespace (~55 keys) in [locales.ts](workit/src/i18n/locales.ts) +
  en/af/zu dictionaries ([en](workit/src/i18n/messages/en.ts) /
  [af](workit/src/i18n/messages/af.ts) / [zu](workit/src/i18n/messages/zu.ts)).
- Wired [post-a-job/page.tsx](workit/src/app/post-a-job/page.tsx) and
  [PostJobShell.tsx](workit/src/components/PostJobShell.tsx): page title/intro, the
  safety "Heads up" notice, every field label + placeholder, the "Job details"
  section, location/photos/urgent blocks, action buttons and error messages all flow
  through `t()`.
- Scope note: the ~5 dynamic hint sentences carrying live R-amounts/counts (price/crew/
  duration/due-date hints, `PriceGuide`) keep the English fallback — the current `t()`
  API is static. A future interpolation upgrade is the clean follow-up (BACKLOG).
- Verified all 3 locales resolve via a temp lab page (deleted before deploy); no
  console errors. tsc + build clean. **Deployed** ✅ to `workit-6a927` (hosting).

### Added — Admin Growth dashboard (steer toward the 20,000-user target)
A dedicated **Growth** tab in the admin panel (`g r` shortcut) that turns the raw
users/jobs streams into the three numbers the marketplace lives or dies on, plus
pace against the launch target. New
[GrowthDashboard.tsx](workit/src/app/admin/_components/GrowthDashboard.tsx),
wired into [admin/page.tsx](workit/src/app/admin/page.tsx) and the
[AdminShell](workit/src/app/admin/_components/AdminShell.tsx) nav.
- **Worker : employer ratio** — live count + a 70/30 balance bar with a target
  marker, and a plain-English recommendation ("recruit ~N more employers / workers").
  Admins are excluded from the marketplace mix.
- **Fill-rate** — % of jobs that actually got a worker. Headline uses a *mature*
  denominator (jobs 48h+ old, excluding employer-cancelled-before-hire) so it
  reflects matching, not jobs that haven't had a fair chance yet. Plus a fill
  funnel (Posted → Filled → Completed) and "N open, no hire" / "N stale (3d+)" flags.
- **Time-to-fill** (post → first hire) — median / average / fastest + a distribution
  histogram (<1h, 1–6h, 6–24h, 1–3d, 3d+). Reframed the founder's "time-to-first-job"
  as time-to-fill because assignment time wasn't stored; see below.
- **Progress to 20,000** — progress bars for total / workers (14k) / employers (6k),
  mirroring [growth/workit-growth-20k.html](workit/growth/workit-growth-20k.html).
- **Weekly fill-rate** (last 8 weeks) and an auto-generated **"What to do next"** list.
- Supporting change: added `assignedAt?: number` to the Job type and set it once on
  first hire in `acceptOffer` ([jobs.ts](workit/src/lib/jobs.ts)) — assignment time
  wasn't previously recorded, so the time-to-fill sample grows from now forward
  (historical jobs aren't counted; the UI says so).
- Verified in isolation via a temp lab page (deleted before commit). tsc + build clean.
  **Deployed** ✅ to `workit-6a927` (hosting).

### Docs — Marketing kit (first run of the workit-marketer agent)
Initial launch marketing assets under `workit/marketing/` (draft-and-review; nothing
auto-sent/posted).
- `content/poster-find-work.html` + `content/poster-list-your-business.html` — on-brand
  launch posters (Fraunces/Manrope, ochre/sage/ink) with live scannable QR codes to
  workitsa.co.za.
- `content/captions.md` — FB/WhatsApp/IG/TikTok captions by audience; `content/posting-calendar.md`
  — 2-week supply/demand-balanced calendar.
- `outreach/strategy.md` — ICP, offer, 3-touch sequence, sourcing, POPIA send rules;
  `outreach/email-drafts.md` — intro + 2 follow-ups + 3 worked examples;
  `outreach/target-list.csv` — fillable tracker; `outreach/workit-business-onepager.html`
  — branded email attachment (print to PDF).
- `marketing/README.md` — index + send rules. Email-send guidance: SendGrid (domain-auth)
  preferred over personal Gmail/Outlook; no credentials shared; small reviewed batches only.

### Docs — Market-research survey (Google Form generator)
Pre-launch survey to learn what people need from Workit on both sides + capture
early-access leads. One branching Google Form for workers / employers / businesses.
- [growth/workit-survey.gs](workit/growth/workit-survey.gs) — Apps Script that
  builds the whole form (sections, all questions, answer-based branching) in the
  founder's own Google account; run it at script.google.com, no credentials shared.
- [growth/SURVEY.md](workit/growth/SURVEY.md) — design rationale, full question
  list (manual-build fallback), and how to read results.
- Validates the trust/verification + fair-price + low-data bets, calibrates pricing
  (half-day pay question → price bands), and is POPIA-safe (anonymous by default,
  optional consent-gated contact). Not app code — nothing to deploy.

## 2026-06-22

### Changed — founder contact email → business address (tshepowayne@workitsa.co.za)
Replaced the personal Gmail (`tshepowayne2@gmail.com`) with the new business email
everywhere it's shown or used:
- **App/site (hosting):** footer byline, FAQ "email me directly", legal pages
  (terms / privacy / acceptable-use / POPIA contact in [popia.ts](workit/src/lib/popia.ts)),
  help, safety, setup, account/security, not-found, ReportButton, AccountGate.
- **Functions:** the shared mailer `SUPPORT_EMAIL` ([mailer.ts](workit/functions/src/mailer.ts))
  — i.e. the Reply-To + unsubscribe on **every** notification/auth email — plus the
  founder-facing recipients for Jarvis digest/alerts/WhatsApp and reports, so ops
  alerts now land in the business inbox.
- Docs: STORE_LISTING.md, ADMIN_GUIDE.md (CHANGELOG history left as-was).
- tsc + app build clean. **Deployed** ✅ to `workit-6a927` (hosting + all functions,
  via `FUNCTIONS_DISCOVERY_TIMEOUT=180`).
- ⚠️ **Two things outside the code, for it to fully work:** (1) make sure
  `tshepowayne@workitsa.co.za` can **receive** mail — the Jarvis alerts/digests/
  reports and all reply-to now go there; (2) the actual **send-from** address is the
  `SENDGRID_FROM_EMAIL` secret (not code) — to send *from* the Workit domain and
  keep deliverability, authenticate `workitsa.co.za` in SendGrid (SPF/DKIM) and
  point that secret at a `@workitsa.co.za` sender.

### Added — Monetization mechanics (free during launch): boosted listings + Business Pro
First revenue rails. Founder decision: build **both** models but keep them **FREE
through the Gauteng launch** — so they validate demand and lay the plumbing without
breaking the "free during launch" promise. A paywall wraps the two write paths later.
- **Featured / boosted listings.** Employers can boost an open job to the top of
  the find-work feed with a "✦ Boosted" badge. `boostedUntil` on Job +
  `boostJob()` / `isBoosted()` ([jobs.ts](workit/src/lib/jobs.ts) /
  [types.ts](workit/src/lib/types.ts)); the feed now sorts **boosted → urgent →
  chosen sort** ([find-work](workit/src/app/find-work/page.tsx)); "✦ Boosted" badge
  on [JobCard](workit/src/components/JobCard.tsx); an employer **BoostCard** on the
  open job ([jobs/page.tsx](workit/src/app/jobs/page.tsx)) — "Boost — free", shows
  days left, "Extend +7 days". 7-day window; re-boosting stacks.
- **Business Pro tier.** Business accounts switch on "✦ Workit Pro" from /account
  (`BusinessProCard` in [account/page.tsx](workit/src/app/account/page.tsx)) —
  `businessPro` / `businessProSince` on the profile. Pro businesses rank **first**
  in the directory with a "✦ Pro" badge ([businesses](workit/src/app/businesses/page.tsx)),
  and the Pro badge shows on their profile ([business](workit/src/app/business/page.tsx)).
- **No Firestore-rules change** — `businessPro` isn't in the user self-write
  blacklist, and an owner may already write any non-`workerRating` field on their
  own job (verified against firestore.rules). Every CTA carries "Free during launch".
- tsc + build clean. New surfaces are auth/role-gated (employer's open job, business
  account, signed-in directory), so verification was typecheck + build + the rules
  check; the dev preview was unreliable this session (timeouts) so no screenshot —
  the badges reuse the existing Badge pattern. **Deployed** ✅ to `workit-6a927` (hosting).
- ⚠️ **Founder, for when you charge:** move the two write paths (`boostJob`, the Pro
  toggle) server-side behind a payment provider (Paystack/Yoco/Ozow/PayFast) — the
  UI + data model are already in place, so it's a billing-gate swap, not a rebuild.
- Deferred: payment provider; Pro perks beyond badge + placement (analytics, job
  limits); boost analytics for the employer.

### Added — Proof-of-work photos: structured before/after + a real portfolio
Formalizes the completion photos workers already upload into structured before/
after evidence, and surfaces them as social proof that helps workers get hired.
- **Before → After on the job** ([jobs/page.tsx](workit/src/app/jobs/page.tsx)):
  once a worker adds completion photos, the job's photos render as a labelled
  **Before → After ✓** "Proof of work" block (the employer's posted photos are
  "Before", the worker's completion photos "After"); the worker's upload step is
  reframed as *"after photos — proof of work"* and notes it builds their portfolio.
- **"Recent work" portfolio on the public profile** ([u/page.tsx](workit/src/app/u/page.tsx)):
  a new gallery built from the worker's **confirmed jobs' completion photos** —
  real evidence, not self-curated — shown above the verification "Past work".
  New `listWorkerProofOfWork` ([jobs.ts](workit/src/lib/jobs.ts)) fetches it
  (equality-only query → **no new composite index**; single-assigned confirmed
  jobs; capped at 12 photos).
- No schema/rules/functions change — reuses the existing `completionPhotoURLs`
  field, and jobs are already world-readable. tsc + build clean; `/u` renders
  cleanly for a guest in the preview (gallery + before/after need a confirmed job
  with photos, so live confirmation comes with real data). **Deployed** ✅ to
  `workit-6a927` (hosting) — first attempt hit a transient CLI error; retry succeeded.
- Deferred: include **crew-job** completion photos (shared array, attribution is
  fuzzier); let workers caption / curate which proof shots appear.

### Added — "Best for you" personalized find-work feed (Smart matching · slice 3)
The worker-facing half of Smart matching. The find-work feed now defaults to a
**"Best for you"** sort that surfaces jobs matching the worker's own skills first,
then nearest + freshest — instead of plain nearest/newest.
- New `scoreJobForWorker` ([matching.ts](workit/src/lib/matching.ts)):
  category-in-your-skills +100, distance +0–50 (closer better), recency +0–20 over
  a rolling 7-day window. Pure, **no extra reads** (uses the worker's profile
  categories + the distance the feed already computes).
- Wired into [find-work/page.tsx](workit/src/app/find-work/page.tsx): new "Best for
  you" sort chip, now the **default**; urgent jobs still float to the top; all
  existing sorts (Nearest / Newest / Price) kept; memo re-runs when the worker's
  categories change.
- tsc + build clean. The feed is auth-gated, so verification is typecheck + build +
  the pure-function logic; a signed-in worker profile will confirm it live.
  **Deployed** ✅ to `workit-6a927` (hosting).
- Completes the **Smart matching + pricing** trio: fair-price guidance (post),
  best-match offers (employer), best-for-you feed (worker). Deferred: data-driven
  price bands from real confirmed prices.

### Added — dedicated "My jobs" page for employers + workers
A focused, discoverable home for each side's jobs — promoted out of the long
account hub where the lists were buried.
- New role-aware `/my-jobs` ([my-jobs/page.tsx](workit/src/app/my-jobs/page.tsx)):
  employers see **"Jobs you've posted"** (Current / Completed / Cancelled),
  workers see **"Jobs you're working"** (Current / Completed / Saved), each with a
  primary CTA (+ Post a job / Browse open jobs).
- Extracted the tabbed list into a shared `JobTabs`
  ([component](workit/src/components/JobTabs.tsx)) — the account page now imports it
  (single source of truth, no duplication); removed its local copy and the
  now-unused `JobCard`/`EmptyState` imports.
- Discoverable: a **"My jobs"** link in the signed-in header
  ([Header.tsx](workit/src/components/Header.tsx)), and the home-dashboard
  "My jobs" / "My assigned jobs" / "All your jobs →" / "See all →" links now point
  to `/my-jobs` (were `/account`) ([HomeDashboard.tsx](workit/src/components/HomeDashboard.tsx)).
- AccountGate-protected. tsc + build clean (route exports; 29 prerendered
  payloads). Verified in the preview that the route compiles and gates correctly
  (guest → `/signin`); the signed-in lists reuse the account page's proven
  `JobTabs` + subscriptions. **Deployed** ✅ to `workit-6a927` (hosting).

### Added — Best-match offer ranking (Smart matching · slice 2)
When an employer compares offers on a job, they're now ordered **best-match first**
instead of newest-first, with a "★ Best match" badge on the leader and a "Sorted
by best match" hint. Helps employers pick the strongest worker faster.
- New `scoreOffer` / `rankOffers` ([matching.ts](workit/src/lib/matching.ts)) — a
  pure heuristic over the fields already denormalised on each offer, so ranking
  costs **zero extra Firestore reads**: verified +25, background/gold +20, rating
  (avg × review-confidence) +20, completed jobs +15, at/under your price +10 /
  big counter-offers −up to 15. Stable for ties (keeps newest-first).
- Wired into the employer's offer list ([jobs/page.tsx](workit/src/app/jobs/page.tsx)
  `EmployerControls`); composes with the existing Verified/Gold trust filter; the
  badge only appears when there are ≥2 offers to compare.
- `npx tsc --noEmit` clean. Ranking order confirmed by computed scores (gold
  veteran tops, unrated newcomer sinks, a 70%-over counter-offer gets dinged); the
  preview lab route was flaky on a fresh dev server this session, so verification
  was typecheck + score computation rather than a screenshot. **Deployed** ✅ to
  `workit-6a927` (hosting).
- Next in this upgrade (deferred): rank the **find-work feed** for workers
  (distance + category + recency), and data-driven price bands from real
  confirmed prices.

### Fixed — Sentry was emailing the founder about local-dev (HMR) errors
A Sentry alert fired for "An unknown Component is an async Client Component" — but
it was `environment: development`, `localhost:3000`, `browser: Electron` (the
preview browser): a Next Fast-Refresh/HMR transient thrown while a temp route
recompiled, **not a real bug**. Confirmed by grep that no statically-`async`
Client Component exists anywhere in `src` (every `async` is an event handler or a
plain utility), so production is unaffected.
- Root noise cause: `initSentry` ([sentry.ts](workit/src/lib/sentry.ts)) initialised
  on localhost (tagging events `development`) and **still shipped them**, so local
  dev errors paged the founder. Now it **skips `localhost`/`127.0.0.1` entirely** —
  Sentry reports only from the deployed site (production behaviour unchanged).
  Verify Sentry via `/sentry-test` on the live URL, not localhost.
- tsc + build clean. The dev-noise fix takes effect from source on the next dev
  run; deploying wasn't required to stop the emails (production was already
  correct), but shipped anyway for bundle consistency — **Deployed** ✅ to
  `workit-6a927` (hosting).
- Optional belt-and-braces in the Sentry.io dashboard: set the alert rule to fire
  only for `environment:production`, so any stray dev event never emails.

### Added — Fair-price guidance when posting (Smart matching + pricing · slice 1)
First slice of the Smart-matching/pricing upgrade — aimed squarely at the sparse-
launch problem: under-priced posts sit unfilled, and "what do I even pay?" is the
#1 posting friction.
- Under the price field on the post form, a `PriceGuide`
  ([post-a-job/page.tsx](workit/src/app/post-a-job/page.tsx)) shows the typical
  band for the chosen category, a one-tap **"Use R[typical]"** when the field is
  empty, an **amber nudge** when the price is below what usually fills ("low offers
  take longer to fill — many post around R[typical]"), and a green confirmation
  when it's in/above range.
- Bands live in [priceGuide.ts](workit/src/lib/priceGuide.ts): static per-category
  ZAR ranges (zero Firestore reads, always available at launch volume), structured
  so they can later be refined from real `agreedPrice` data per category/area
  without any UI change. `assessPrice()` allows a 15% grace below `low` before nudging.
- No backend/rules/functions change. tsc + build clean; all four verdict states
  (empty / low / fair / high) across categories verified in the preview via a temp
  lab page (deleted). **Deployed** ✅ to `workit-6a927` (hosting).
- Next in this upgrade (deferred): **worker ranking/matching** — order offers + the
  find-work feed by skill/distance/rating; and data-driven price bands from real
  confirmed prices once there's volume.

### Added — worker + employer density layers on the admin heat map
The heat map now answers "where is our supply, demand, and work?" — not just jobs.
- `HeatmapTab` ([HeatmapTab.tsx](workit/src/app/admin/_components/HeatmapTab.tsx))
  gains a **Jobs / Workers / Employers** layer toggle. Workers + employers plot
  from their **public ~1 km-rounded** home location (`approxLat/approxLng`) — the
  same privacy-safe field the directory uses — with adapting KPIs (total / on the
  map / no-location-yet / suburbs covered) and a suburb breakdown per layer.
  `allUsers` now also streams on the heatmap tab ([admin/page.tsx](workit/src/app/admin/page.tsx)).
- **Privacy by design (deliberately NOT live tracking):** admin-only; people show
  only at their ~1 km-rounded home area (never exact), never to other users, and
  nothing new is collected — it's a density view over data already on file. Admins
  are excluded; the people layers show counts only (no individual PII listed).
- Founder had asked for *all* profiles to continuously share live location for the
  map + safety. Flagged that always-on tracking-for-everyone is a POPIA/consent +
  battery/data problem AND — if exposed to users — a stalking vector that would
  undo the women's-safety toolkit. This density approach delivers the map goal
  safely; on-job safety is already covered (per-job live location, SOS GPS,
  trusted-contact share). See the conversation + BACKLOG.
- tsc + build clean; all three layers verified in the preview (correct counts,
  admin excluded, Leaflet renders) via a temp lab (deleted). **Deployed** ✅ to
  `workit-6a927` (hosting).

### Design — "don't feel dead" empty states for the sparse launch (GTM)
First go-to-market product lever: keep the first workers + employers from opening
the app, seeing a blank screen, and bouncing while the wedge is still filling up.
- **find-work (worker), no jobs nearby** ([find-work/page.tsx](workit/src/app/find-work/page.tsx)):
  was a dead "Check back soon"; now reassures (we'll notify you when a job lands —
  the worker push already exists) + profile-aware CTAs — unverified → **Get
  verified**; verified → **Turn on alerts & go available** + **Polish your
  profile**; plus **Invite people to Workit**.
- **/workers (employer), thin bench** ([workers/page.tsx](workit/src/app/workers/page.tsx)):
  now distinguishes a genuinely empty bench from an over-narrow filter — the empty
  case encourages **+ Post a job** ("you don't have to find someone here — post and
  verified workers nearby send offers, often within the hour") instead of a flat
  "no workers match" line.
- The `/account` job lists already had good empty CTAs (Post a job / Browse open
  jobs) — left as-is. tsc + build clean; all states verified in the preview (both
  find-work variants + the /workers bench, light + dark) via a temp lab (deleted).
- Note: the GTM outreach copy + the referral/invite-share lever were already
  built (GO_TO_MARKET.md Soweto pack + ReferralCard), so this empty-state pass is
  the genuinely-missing piece. **Deployed** ✅ to `workit-6a927` (hosting).

### Added — admin backfill for employer hire counts (+ a deploy gotcha recorded)
- New admin-only `backfillEmployerHires` callable ([backfillHires.ts](workit/functions/src/backfillHires.ts))
  + an Audit-tab button ([BackfillHiresButton.tsx](workit/src/app/admin/_components/BackfillHiresButton.tsx)):
  recomputes each employer's lifetime confirmed-hire total and sets
  `employerJobsHired` (idempotent — absolute set, never double-counts). Makes the
  "Who you'd be working for" trust panel truthful for employers who hired before
  the counter trigger shipped (06-19). Deployed ✅ (function + hosting).
  ⚠️ **Founder: run it once** — /admin → Audit → "Run backfill".
- **Ops gotcha (recorded in OPS_QUICKREF):** `firebase deploy --only functions…`
  began failing with "Cannot determine backend specification. Timeout after 10000"
  — the compiled bundle now cold-loads in ~28s locally (heavy native deps +
  Windows FS scanning; GCP runtime is unaffected), over the CLI's 10s discovery
  budget. Fix: prefix the deploy with `FUNCTIONS_DISCOVERY_TIMEOUT=180`.

## 2026-06-20

### Added — Optional employer ID verification · women's-safety toolkit #3 (phase 2)
Phase 1 surfaced employer accountability; phase 2 lets employers/businesses
*prove their identity* the same way workers do, earning the ✓ ID-verified badge
the trust panel already renders. Optional (never gates posting) so it adds no
friction to the demand side — motivated employers opt in to attract workers.
- **Employer form** ([verification/page.tsx](workit/src/app/verification/page.tsx)):
  a streamlined `EmployerVerificationForm` (SA ID number + ID photo + selfie +
  consent — no skills/categories/address) for `employer`/`business` roles, reusing
  the worker pipeline: same private verification doc, the Layer-1 SA-ID check with
  live ✓/⚠ feedback, and `getVerificationPayload` previews.
- **Entry point** ([account/page.tsx](workit/src/app/account/page.tsx)): a "Verify
  your identity (optional)" card for employers/businesses showing status
  (none/pending/approved/rejected + reviewer note) with a Verify/Resubmit action.
- **Trigger** ([verification.ts](workit/functions/src/verification.ts)):
  `onUserVerificationSubmitted` now promotes employer/business submissions to
  pending too (was worker-only).
- **Admin review** ([admin/page.tsx](workit/src/app/admin/page.tsx)): the
  verification queue now includes opted-in employers/businesses (query no longer
  worker-filtered; admins excluded client-side), the per-user doc details + ID
  verdict + status render for them (Categories stays worker-only), and the
  Overview "New verifications" attention count + card copy went role-neutral.
  Approve/reject (`reviewVerification`) was already role-agnostic.
- No Firestore-rules change: employers already self-write their `verification`
  map; `verificationStatus` stays server-authored (trigger/admin). tsc (app+
  functions) + build clean; rules tests unaffected (still **72**). Employer form
  (live ID feedback) + all account-card states verified in the preview via a temp
  lab page (deleted).
- **Deployed** ✅ to `workit-6a927`: `onUserVerificationSubmitted` (updated,
  africa-south1) + hosting.
- Note: the admin queue path (admin-gated + needs data) couldn't be exercised
  locally — worth a quick smoke test after deploy (employer submits → appears in
  the verification queue → Approve docs → ✓ ID-verified badge shows on their jobs).

## 2026-06-19

### Added — "Who you'd be working for" employer trust panel · women's-safety toolkit #3
Closes the asymmetry where workers are ID-verified but employers were opaque to
the person walking into their home. Before a worker offers/accepts, a job now
shows an at-a-glance accountability panel about the employer.
- New `EmployerTrust` ([component](workit/src/components/EmployerTrust.tsx)) on the
  job detail for any signed-in non-employer viewer ([jobs/page.tsx](workit/src/app/jobs/page.tsx)):
  rating (avg + count), **workers hired**, "on Workit since", and ✓ Registered-
  business / ✓ ID-verified badges — plus a 🛟 **new-account caution** (no track
  record yet → share with a trusted contact, meet safely) for accounts <21 days
  with zero hires/ratings.
- New server-authored **`employerJobsHired`** counter ([types.ts](workit/src/lib/types.ts)):
  `onJobConfirmedCountWork` ([ratings.ts](workit/functions/src/ratings.ts)) now also
  credits the employer one "hire" per worker slot confirmed (single + per crew
  member). Rules-protected like the worker tallies (clients can't self-set it).
- **Rules:** +1 test (now **72**) — `employerJobsHired` is in the self-write
  forbidden list. `test:rules` green; tsc (app+functions) + build clean; both
  panel states (established + new-account) verified in the preview via a temp lab
  page (deleted).
- Phase 1 of "employer verification" — makes *existing* accountability legible to
  every employer at no friction/cost. Phase 2 (deferred): optional employer **ID
  verification** reusing the worker pipeline (page gate + trigger + admin queue),
  which would light up the ✓ ID-verified badge for employers who opt in.
- **Deployed** ✅ to `workit-6a927`: `onJobConfirmedCountWork` (updated,
  africa-south1) + `firestore:rules` + hosting.

### Added — Auto-arm "tell a trusted contact" on the way out · women's-safety toolkit #2
Second from the women's-safety brainstorm: make *being seen* the default rather
than a button people forget. The moment a worker taps "I'm on my way", a prominent
prompt offers a one-tap WhatsApp safety check-in to a saved trusted contact.
- New `TrustedContactArm` ([TrustedContactArm.tsx](workit/src/components/TrustedContactArm.tsx))
  rendered in the worker's en-route state ([jobs/page.tsx](workit/src/app/jobs/page.tsx)):
  with a saved contact → one tap pre-fills a WhatsApp to them (job, where, who
  with, map pin, link); without → an inline name + number form captures one, then sends.
- **Privacy by design.** The contact lives ONLY in localStorage on the worker's
  device ([trusted-contact.ts](workit/src/lib/trusted-contact.ts)) — a third
  party's number is their personal info, so it's never stored server-side (no
  POPIA processing of it) and only ever goes into the WhatsApp message the worker
  themselves sends. SA numbers normalise to wa.me format (082… → 2782…).
- Refactored `ShareWithContact` to share the same `buildSafetyMessage`, so the
  manual share + the auto-arm say exactly the same thing. New GA4 events
  `trusted_contact_saved` / `trusted_contact_armed`.
- No backend / rules / functions change. tsc + build clean; verified in the
  preview (no-contact form, saved-contact one-tap send with correct wa.me number
  + embedded job/map/employer, change-contact round-trip) via a temp lab page (deleted).
- **Deployed** ✅ to `workit-6a927` (hosting).

### Added — Job start code (doorstep handshake) · women's-safety toolkit #1
First build from the women's-safety brainstorm: a 4-digit start code the worker
must enter — read out by the employer at the door — before a job can start.
Repurposes Uber's rider-PIN idea for home services: confirms the right, verified
person is physically at the right place, and stamps a trustworthy arrival time.
- **Employer** sees the code on the assigned/in-progress job (`StartCodeCard` in
  [jobs/page.tsx](workit/src/app/jobs/page.tsx)) with an arrival-verified
  indicator and a "Don't require a code" toggle for jobs where they won't be
  present. The **worker's** "Start" routes through code entry; a correct code
  flips the job to in_progress server-side and records `startVerifiedAt`.
- **Security — the code never touches the world-readable job doc.** Job docs are
  public (`allow read: if true`) and a 4-digit code is trivially brute-forced
  even hashed, so it lives in a **fully locked** `jobs/{id}/secure/start`
  subcollection (`allow read, write: if false`). The employer fetches it via the
  **`getJobStartPin`** callable (employer-only, lazily generates); the worker's
  entry is checked by **`verifyJobStartPin`** (Admin SDK) — rate-limited to 5
  wrong tries, then locked until the employer re-opens the job to refresh
  ([startPin.ts](workit/functions/src/startPin.ts)).
- Works for single + crew jobs (each member enters the same code to start their
  slot; per-member `startVerifiedAt`). New `requireStartPin` + `startVerifiedAt`
  types ([types.ts](workit/src/lib/types.ts)); client calls + `setRequireStartPin`
  in [jobs.ts](workit/src/lib/jobs.ts). GA4: `start_pin_enabled/disabled/verified`.
- **Default ON** for new assignments (`acceptOffer` sets `requireStartPin: true`);
  in-flight pre-deploy jobs (field absent) are unaffected. ⚠️ **Founder call:**
  this means errand/delivery jobs (no doorstep) also start gated until the
  employer toggles it off — one-tap off, clearly prompted; say if you'd rather
  default OFF.
- **Rules:** +2 tests (now **71**) — nobody (employer/worker/admin/stranger/anon)
  can read or write the secure PIN doc. `test:rules` green; tsc (app+functions) +
  build clean; UI verified in the preview (employer card + worker entry, Verify
  enables only at 4 digits) via a temp lab page (deleted).
- **Deployed** ✅ to `workit-6a927`: `getJobStartPin` + `verifyJobStartPin`
  (created, africa-south1) + `firestore:rules` + hosting. Default-ON shipped as-is.
- Honest limit: rules can't fully *enforce* the PIN for crews (members rewrite the
  roster array), so the code is a strong verified-arrival *signal* + UX gate, not
  a hard block — skipping it just leaves `startVerifiedAt` unset (visibly
  unverified to employer/admin). Documented in startPin.ts.

### Ops — removed the leftover `/logo-lab` dev page from the public site
The logo design lab was still shipping as a public route in the static export
(reachable on the live site). Deleted `src/app/logo-lab/`, and dropped its now-dead
references from `public/robots.txt` and the `sitemap.ts` comment. `/setup` and
`/sentry-test` remain (the latter is intentionally kept — see BACKLOG). Build now
exports 32 pages (was 33). Deployed with the hosting release below.

### Added — Rebooking phase 2: recurring auto-schedule + a real "invited back" push
Phase 1 (below) gave employers one-tap "Book again". Phase 2 turns that into a
true standing schedule and gives the re-invited worker their own notification.
- **Recurring auto-schedule.** On a **confirmed** job the employer can now turn
  on a **weekly / fortnightly / monthly** repeat — `RebookCard`
  ([jobs/page.tsx](workit/src/app/jobs/page.tsx)) gains a frequency picker plus,
  once live, an active-schedule status line ("🔁 Repeats every week · next on …")
  with **Stop auto-repeat**. It writes a `recurrence` map to the job
  (`setJobRecurrence`/`cancelJobRecurrence` in [jobs.ts](workit/src/lib/jobs.ts);
  `JobRecurrence` type + `nextRecurrenceAt` helper in [types.ts](workit/src/lib/types.ts)).
- **New scheduled function `scheduledRecurringJobs`** ([recurring.ts](workit/functions/src/recurring.ts))
  runs daily **05:00 SAST** and mints a fresh **open** copy of each due template
  job — same reusable fields + price (`agreedPrice`) as the phase-1 rebook,
  re-invites the worker/crew, then advances `nextRunAt` by one interval
  *relative to the prior due time* (a schedule that fell behind catches up one
  copy/day, never a flood). The schedule lives on the **original** confirmed job;
  minted copies carry `recurrenceParent`/`rebookedFrom` but never `recurrence`,
  so they don't recur themselves. Self-deactivates if the employer's account is
  gone/suspended.
- **Dedicated "you've been invited back" push.** Previously an invited worker only
  got the generic "New job near you" alert — and only if inside the 25 km radius.
  `onJobVisibleAlertWorkers` ([jobAlerts.ts](workit/functions/src/jobAlerts.ts))
  is now invitation-aware: invited workers are **always** notified (bypassing the
  category + radius filters) with dedicated copy — *"You've been invited back 🎉"*
  for a rebooking (`rebookedFrom` set), *"You're invited to a job"* for a
  first-time profile invite — and are dropped from the generic nearby pool so
  they're never double-notified. This also upgrades phase-1's manual "Book again
  with invite" and the original profile-invite flow.
- No Firestore-rules change needed: the employer already may write any
  non-`workerRating` field on their own job, and the minting function uses the
  Admin SDK (bypasses rules). New GA4 events: `job_recurrence_set`,
  `job_recurrence_cancelled`.
- `npx tsc --noEmit` (app + functions) + `npm run build` all clean. New recurrence
  UI verified in the preview (light + dark, both setup + active states) via a temp
  lab page, since the real card is gated behind a confirmed job (lab page deleted).
- **Deployed** ✅ to `workit-6a927`: `scheduledRecurringJobs` (created,
  europe-west1 scheduler) + `onJobVisibleAlertWorkers` (updated, africa-south1)
  + hosting. The first auto-mint will land the morning a schedule first falls due.
- **Deferred (phase 3 ideas):** a dedicated "Repeating jobs" management view
  (today a schedule is managed from its source confirmed job — discoverability is
  the main gap); let the employer choose the first run date / skip a run; pause
  (vs stop) a schedule.

### Added — Rebooking: one-tap "Book again" to re-hire a worker (retention loop)
First slice of the Rebooking upgrade — turning one-off jobs (cleaning, gardening,
trades) into repeat bookings, the biggest LTV lever for a services marketplace.
- On a **confirmed** job the employer now sees a "Need this done again?" card with
  **Book [worker] again** + **Post a fresh copy** ([jobs/page.tsx](workit/src/app/jobs/page.tsx) `RebookCard`).
- New `rebookJob(source, employer, {inviteSameWorker})` in [jobs.ts](workit/src/lib/jobs.ts):
  re-posts through the existing `createJob` (stays rules-compliant + re-fires the
  worker alert), priced at what was actually paid (`agreedPrice`), copying the
  reusable details (title, description, category, suburb/city/province, coords,
  photos, tools/transport/training/experience, estimate, payment method, crew
  size, worker preference) and inviting the same worker/crew via `invitedWorkerIds`.
  Date-specific fields (`urgent`, `dueAt`) are intentionally NOT carried over.
- Works for single + crew jobs. New `job_rebooked` GA4 event.
- Typecheck + build clean. ⚠️ Not deployed yet.
- **Next (phase 2, deferred):** true **recurring auto-schedule** (weekly/fortnightly/
  monthly) — needs a `recurrence` field + a scheduled Cloud Function to mint the
  next instance; plus a dedicated "you've been invited back" push to the invited
  worker (today they get the standard nearby-job alert + the invited badge).

## 2026-06-18

### Fixed — two-step verification setup showed a blind "Couldn't start setup"
Admin (Simphiwe) couldn't turn on TOTP — `Set up authenticator` failed with a
generic "Couldn't start setup. Please try again." The page was collapsing every
non-`requires-recent-login` error from `generateSecret()` into that one string,
hiding the actual Firebase reason ([account/security/page.tsx](workit/src/app/account/security/page.tsx)).
- Now maps the real error codes to clear, actionable messages: `unverified-email`
  (+ a one-tap **Resend verification email** button), `operation-not-allowed` /
  `admin-restricted-operation` ("TOTP isn't enabled for the project — enable it in
  Firebase → Authentication → Sign-in method"), `unsupported-first-factor`, and
  `too-many-requests`. Anything unexpected now shows the raw code so support can act.
- Diagnostic value: the next attempt will name the exact cause instead of a blind
  retry. Simphiwe's account is Google (email auto-verified), so this is most likely
  the project-level **TOTP toggle being off** — founder is checking the console.
- ⚠️ Founder action: confirm Authenticator-app (TOTP) MFA is enabled in Firebase
  Console → Authentication → Sign-in method → Advanced/Multi-factor. Code can't flip
  that switch.

### Design — mobile rhythm retouch on the landing page
After fixing the dropdown overlap, audited the whole landing page on a 375px
viewport (both light + dark themes) — no horizontal overflow, clean single-column
stacking, bottom-nav clearance intact, footer fully visible. The one thing that
read sparse on a phone was the vertical rhythm: every section used `py-20` (80px)
and the footer `mt-24` (96px), which is airy on desktop but stretched the page to
~8950px on mobile. Tightened for small screens only, desktop untouched:
- Landing sections `py-20` → `py-16 sm:py-20` (how-it-works, categories, safety,
  for-workers, testimonials, FAQ); footer `mt-24` → `mt-16 sm:mt-24`. Page is
  ~220px shorter on mobile and the section transitions sit tighter without feeling
  cramped. Verified by screenshot at each section boundary; no overflow introduced.
- Note: `find-work`/`post-a-job` are auth-gated (redirect guests to home), so they
  weren't part of this guest-visible pass — a signed-in mobile review is a separate
  follow-up if wanted.

### Fixed — language dropdown untappable + overlapping (and the sticky header was silently broken)
On mobile (and desktop) the language menu opened but **taps fell through to the
page behind it**, and it looked like it overlapped the content. Root cause was a
single global CSS rule in `globals.css`:
`main, header, footer, section { position: relative; z-index: 1; }`. It's
*unlayered*, so it out-ranks Tailwind utility classes — meaning it clobbered the
header's own `sticky` + `z-30` and pinned `<header>` to `position: relative;
z-index: 1`, the **same layer as every `<section>`**. The hero `<section>` comes
later in the DOM, so it painted on top of the header — and on top of the header's
dropdown — swallowing every click (`elementFromPoint` on each menu option
returned the hero, not the option).
- **Fix:** removed `header` from that rule (one line). The header now keeps its
  intended `sticky top-0 z-30` from its utility class, which sits above the page
  sections (z-1) *and* the noise texture (z-0). The dropdown (z-50 inside the
  header's context) now renders above page content and is tappable.
- **Bonus:** this also silently un-broke the **sticky translucent header** — it
  had been `position: relative` (not sticky) on every page due to the same rule.
- Verified in the preview at **mobile (375px) and desktop**: real (event-based)
  taps on the menu now hit the options (`tapReachesOption: true` for all three),
  switching applies, and the menu closes. Header computes `position: sticky;
  z-index: 30`. Confirmed all full-screen overlays (confirm dialog z-[60], toasts
  z-50, banners z-50, lightbox z-[9999], emergency/dispute z-40–50) still sit
  above the header, so nothing gets hidden behind the now-sticky bar.

### Fixed — language switcher "did nothing": thin i18n coverage on the landing page
The af/zu language buttons *worked* mechanically (locale + `<html lang>` +
localStorage all flipped, verified in the preview) — but only the header nav,
hero, and footer were wrapped in `t()`. Switching left ~90% of the homepage in
English (the "Three steps", categories, safety, testimonials and FAQ sections
were all hardcoded), so it read as broken. Fixed by wiring the **entire landing
page** through translation keys:
- Added ~70 new `Messages` keys (locales.ts) with **en / af / zu** dictionaries
  for every landing section: how-it-works steps, category cards, the trust &
  safety grid, the "for workers" band, the testimonials, and all 7 FAQ entries.
- `page.tsx` data arrays (`categories`/`steps`/`safetyPoints`) now hold message
  keys and render via `t()`; `Testimonials.tsx` and `Faq.tsx` became client
  components consuming `useTranslation()`.
- Illustrative content left in English on purpose: demo job cards in the hero
  (desktop-only mock listings) and the testimonial names/areas (proper nouns).
- SEO unaffected — static export still renders the **English** default copy into
  the HTML (DEFAULT_LOCALE = en), so crawlers get the same landing text as before.
- Verified in the preview: switching to **isiZulu** and **Afrikaans** now
  translates every section heading, FAQ question, and testimonial quote;
  `npx tsc --noEmit` clean; production build clean.
- ⚠️ The af/zu copy is solid but the **zu** strings still want a first-language
  review before relying on them publicly (same caveat already noted in `zu.ts`);
  any unreviewed/missing key falls back to English automatically.
- Note: deeper app pages (find-work, post-a-job, how-it-works, safety, account,
  legal) are still English-only — wrapping them is the next i18n phase. **Do not
  machine-translate Terms/Privacy** — those need a human/legal pass.

### Fixed — SEO: pages weren't being indexed (wrong canonicals + redirecting sitemap)
Search Console showed only 2/9 pages indexed. Two real bugs, both fixed:
- **Every page declared the homepage as its canonical.** The root `layout.tsx`
  set `alternates: { canonical: "/" }`, which App Router *inherits* to every
  child page — so `/how-it-works/`, `/safety/`, `/privacy/` … all emitted
  `<link rel="canonical" href="https://workitsa.co.za/">`. Google read that as
  "these are duplicates of the homepage" and refused to index them. Removed the
  layout-level canonical; the homepage now self-canonicalises, and each of the 7
  public content pages sets its own **self-referencing, trailing-slash** canonical.
- **The sitemap pointed at redirecting URLs.** `next.config` + Firebase both use
  `trailingSlash: true` (real page = `/how-it-works/`), but `sitemap.ts`
  hand-built non-slash URLs (`/how-it-works`) which 301 → "Page with redirect" →
  not indexed. Sitemap now emits trailing-slash URLs matching the 200-served pages.
- Verified on the **live** site: content pages self-canonicalise with trailing
  slash, sitemap URLs are trailing-slash, non-slash URLs 301 as expected.
- ⚠️ **Founder action (Search Console):** Indexing → Sitemaps, resubmit
  `sitemap.xml`; on the "Page with redirect" / duplicate-canonical reports hit
  **Validate Fix**; optionally URL-inspect the key pages and **Request indexing**.
  Re-crawl takes days–weeks; the not-indexed count should fall.

### Fixed — push notifications reached "0 devices" (broadcast/SOS/alerts had nowhere to go)
Broadcasts reported **"Sent to 0 of 0 devices across 15 people"** — the segment
was right, but the whole system had **zero registered FCM tokens**. Root cause:
the device token was only written when a user manually tapped "Enable push" on a
prompt **buried on `/account`**, and there was **no silent re-registration** — so
tokens (which rotate) were never refreshed and almost nobody ever opted in. This
also silently disabled the new SOS admin-push and the job-alert pushes.
- **Silent re-register on every authenticated load** — new
  `registerPushTokenIfGranted()` (no prompt; no-ops unless permission is already
  granted) is called from `NotificationsProvider`, so any user who has allowed
  notifications always has a fresh token stored. Refactored the token-save into a
  shared `fetchAndSaveToken` helper (used by enable + silent paths).
- **Prompt surfaced on the home dashboard** (not just `/account`) so people
  actually turn push on — it self-hides once granted/dismissed.
- ⚠️ **Founder action:** enable push once on your own device (the prompt now
  shows on the home dashboard) so SOS alerts + broadcasts reach you. New opt-ins
  accrue device tokens from here on.

### Added — Safety toolkit: "share my job with a trusted contact"
- New `ShareWithContact` on every active job (worker *and* employer, hidden once
  disputed): one tap composes a safety message — what the job is, where (+ a
  Google Maps pin when the job has coords), who with, and a link to the job —
  and fires it via the **native share sheet**, **WhatsApp**, or **copy**. No
  backend; "staying safe is staying seen." (`safety_share` GA4 event.)
- Remaining v2 safety ideas (safe-arrival/done check-ins, per-crew live location,
  token-gated public tracking page) stay tracked in BACKLOG.

### Added — Safety toolkit v1: the SOS button now actually reaches the safety team
The sweep found the SOS button was hollow — it dialled 10111 and wrote two
fields to the job, but captured **no location** and **no alert reached anyone**.
Turned it into a real safety system:
- **SOS now captures GPS** at the moment of the alert (best-effort, hard-capped
  so the call to SAPS is never held up — usually instant since location's been
  used during the job) and writes a structured `emergency` record
  (who/role/time/coords/`status`) to the job. Confirm dialog reworked: it tells
  the user it's paging the safety team with their location.
- **Real-time page-out** — new **`onJobEmergencyAlert`** Cloud Function fires on
  a fresh alert and (1) **pushes every admin** (FCM, on their phone) and
  (2) **emails the founder** (reliable channel, mirrors the dispute alert) with
  who, the job, where, a **Google Maps pin** from the captured GPS, and the SAPS
  reminder. Resolving an alert doesn't re-fire it.
- **Admin active-SOS queue** — new `EmergencyAlertsPanel` pins a loud brick
  banner to the top of **every** admin tab whenever an alert is live (renders
  nothing when calm): who/where/time, a map link, a direct *Call 10111*, and a
  one-tap **Mark handled** (`resolveEmergency`, kept in the safety log). Wired in
  via a new `alertSlot` on `AdminShell`, fed by a live
  `subscribeActiveEmergencies` query.
- Works for both the **worker and the employer** on an active job (either can be
  the one at risk). No rules change needed — `emergency` is participant-writable,
  resolve is admin-only; +1 rules test (now **69**) locks the SOS path
  (participant can raise, stranger can't).
- Deployed: `onJobEmergencyAlert` (created) + hosting. Next steps (deferred):
  per-crew live location, and a "share my job with a trusted contact" loop.

## 2026-06-17

### Security — trust-signal integrity: ratings, badges, prices made server-authored (full-system sweep)
A sweep of the rules + functions surfaced one high-severity class of bug —
**fabricating reputation** — in a trust-first marketplace. Fixed at the root:
- **Rating self-authorship (🔴 closed).** The job-update rule let the assigned
  worker write *any* field on their job, and `onJobRatingWritten` was a
  background trigger with **no auth context** — it credited whoever wrote
  `employerRating`. So a worker could write their own 5-star review and the
  trigger banked it. Replaced the trigger with a **`submitRating` callable**:
  it's now the *only* writer of ratings + the only thing that moves
  `ratingAvg`/`ratingCount`. It verifies the caller's role from their auth
  token (employer ⇄ worker), checks the work is confirmed, and writes the
  rating + aggregate atomically in one transaction. Covers single *and* crew
  jobs. The old trigger is deleted, so a stray rating field on a job doc can
  never affect anyone's real reputation again.
- **Badge / worker-level farming (🔴 closed).** `referralsCount`,
  `jobsCompleted`, `jobsCancelled` weren't in the forbidden-self-keys list, so a
  user could set `jobsCompleted: 500` / `referralsCount: 50` to fake experience
  levels + Connector/Ambassador badges. All three are now self-write-blocked
  (joining `ratingAvg`/`ratingCount`/verification flags), and the referral +1
  branch now requires a **different** target (no self-bump farming).
- **Price / status tampering (🔴 closed).** The assigned worker can no longer
  change `agreedPrice`, `suggestedPrice`, `employerId/Name`, `assignedWorkerId`
  or author `employerRating`; the employer can no longer author `workerRating`.
- **Offer self-accept (🟠 closed).** A worker could set their own offer's
  `status: "accepted"`; now they may only **withdraw** it — accept/reject stays
  the employer's call.
- **Dormant worker-level feature (🟠 activated).** `jobsCompleted` was *never*
  incremented, so `/workers` sorting, "jobs done", levels and experience badges
  were all stuck at 0. New **`onJobConfirmedCountWork`** trigger increments each
  worker's lifetime tally as their slot is confirmed (single + per-crew-member)
  — now truthful *and* tamper-proof.
- **Rules tests:** +10 (now **68**, all green) — worker can't self-5-star or
  change price, employer can't author the worker's rating, legit lifecycle +
  own-side ratings still pass, no self-referral bump, offer withdraw-only.
- Deployed: `submitRating` + `onJobConfirmedCountWork` (created),
  `onJobRatingWritten` (deleted), `firestore:rules`, hosting.

### Added — automated SA ID validation (KYC Layer 1, free + instant)
- New **`src/lib/saId.ts`** — a pure, dependency-free South African ID-number
  validator that runs the moment a worker submits verification, at no cost:
  - **Luhn checksum** over the 13 digits — catches typos and random/fabricated
    numbers (a single wrong digit fails the check).
  - **Extracts** date of birth (with century resolved against the DOB they gave
    at signup), gender (seq digit), and citizenship (citizen / permanent
    resident) straight from the number.
  - **Cross-checks** the ID's encoded DOB + gender against what the applicant
    actually entered — a mismatch is the strongest "this isn't their ID" signal
    a structural check can produce.
  - Verdict helper → **pass** (clean) / **warn** (well-formed but DOB or gender
    mismatch) / **fail** (bad checksum or malformed).
- **Verification page**: ID input is now digit-only (`inputMode="numeric"`),
  shows a **live inline hint** as they type (green "✓ Valid SA ID · born …",
  amber DOB-mismatch, red invalid), **blocks submit** on a structurally invalid
  number, and persists the full check to the private profile doc + a
  PII-free `idCheckVerdict` on the public doc.
- **Admin**: verification review shows a colour-coded **ID Check panel**
  (check-digit, DOB-on-ID, DOB/gender match, citizenship, flags) and the
  verification-queue card carries an at-a-glance **ID ✓/⚠/✗ badge** — so an
  admin sees the fraud signal before opening anyone's documents.
- `getVerificationPayload` callable now returns the `idCheck` summary (plain
  data, no signed URLs) alongside the document links.
- **Tests:** new `tests/unit/saId.test.ts` — 17 pure-logic cases (valid/invalid
  numbers, century resolution, female/male/PR, DOB & gender mismatches,
  fail-over-warn precedence). All green.
- Layer 1 is the free first pass; **Layer 2** (Smile ID — real Home Affairs
  validation + biometric selfie match) is scoped and waits on a founder Smile
  ID account. Deployed: hosting + `getVerificationPayload`.

## 2026-06-16

### Added — admin broadcast sender (push campaigns)
- New **Broadcast** admin tab (`g c`): compose a push notification, pick an
  audience (Everyone / Workers / Employers & businesses / Available-now
  workers), optional in-app link, live notification preview, confirm gate,
  and a recent-sends history.
- Backed by **`sendBroadcast`** callable (`functions/src/broadcast.ts`):
  admin-only + **two-step-verified session required** (same bar as erasure),
  **daily cap of 5** to prevent notification fatigue/abuse, server-side
  validation. Fans out to the segment's device tokens (collectionGroup over
  `fcmTokens`) via FCM multicast in 500-token chunks, prunes dead tokens, and
  records every send to `broadcasts` + the audit log (`broadcast_sent`).
- Rules: `broadcasts` is admin-read / server-write-only (+2 rules tests →
  **58** total). Scale path noted in-code (FCM topics) for when the per-user
  fan-out gets expensive.

## 2026-06-13

### Added — referral rewards (growth loop, no manual marketing)
- Referrals now earn **real public reputation badges**: **Connector** (3+
  people brought to Workit) and **Workit Ambassador** (10+). Free to give,
  and in a trust marketplace they make a worker look more established →
  more hires. Wired into `computeBadges` (auto-awarded from `referralsCount`,
  shows the highest tier), so they appear on the public profile + offers with
  no extra plumbing.
- **`ReferralCard` reworked** into a growth surface: progress bar toward the
  next reward ("5 more → Workit Ambassador badge"), the earned badge chip,
  and three share paths — native share sheet (Web Share API, opens WhatsApp/
  SMS/etc. on mobile), direct WhatsApp, and copy-link — each logging a
  `referral_share` GA4 event. Warmer, role-aware invite message.
- `REFERRAL_MILESTONES` + `referralProgress()` helper in types.ts.
- Verified all three states in-browser (0 → 50% → 100% bars, badge chips,
  buttons); tsc clean, temp lab page removed before deploy.

### Security — admin two-step verification now enforced (not just nudged) + review fixes
- Self-review of the session's work surfaced one real gap: admin MFA was a UI
  gate only. Closed it at the data layer:
  - **Rules:** reading another user's private PII doc (`users/{uid}/private` —
    ID number, home GPS) now requires `isAdmin() && usedSecondFactor()` (new
    helper checks `request.auth.token.firebase.sign_in_second_factor`). Zero
    client blast radius — owners read their own; admins review via the
    admin-SDK callable. Rules suite +1 (now **56**, incl. admin-without-2FA
    denied / admin-with-2FA allowed).
  - **Callables:** `getVerificationPayload` (view ID docs) and `eraseUserData`
    (permanent erasure) now reject admins whose session didn't pass a second
    factor, with a clear "set up 2FA and sign in again" message.
  - **Admin gate:** now requires a 2FA *session*, not just enrollment — a new
    "sign in again with your code" state catches the enrolled-mid-session case
    so admins never hit a confusing denial. New `sessionUsedMfa()` helper.
- Quick wins from the same review: `SupportPanel` caps its live feed at 500
  messages; product analytics no longer logs `/admin` page views (internal
  ops, not user behaviour).
- Deferred (documented): `onJobVisibleAlertWorkers` reads the whole workers
  collection per newly-visible job — fine at launch volume, revisit with
  geo/category-bucketed queries at scale.

### Added — jobs map view on find-work
- New **List / Map toggle** on the find-work feed. Map view (`JobsMap.tsx`,
  Leaflet/OSM, loaded via `dynamic(..., {ssr:false})`) plots open jobs as
  brand-toned **price markers** (urgent jobs go brick-red with 🔥), the
  worker's pinned home as a sage "you" dot, auto-fits bounds to show
  everything, and each marker's popup shows title / suburb / distance /
  price with a **View job →** link. Respects all active filters (it maps
  whatever `visibleJobs` already computed).
- Jobs without a pinned location can't be mapped — a note tells the worker
  how many are hidden and to switch to List; if none are mappable, an
  inline empty state explains why. Verified in-browser (tiles, markers,
  popup link, fit-bounds); tsc + build clean.

### Added — multilingual UI activated (Afrikaans + isiZulu)
- The i18n scaffolding (`LocaleContext`, `t()`) was wired up for real:
  expanded the `Messages` catalog (nav, auth, hero, footer, common), filled
  `en.ts`, and added full **`af.ts` (Afrikaans)** and **`zu.ts` (isiZulu)**
  dictionaries. Registered both in `LocaleContext`; only languages with a
  real dictionary are offered (`READY_LOCALES`), so the switcher shows
  English / Afrikaans / isiZulu, not all 11 placeholders.
- New **`LanguageSwitcher`** (globe + native labels) in the header, desktop
  and mobile. Choice persists (localStorage) and sets `<html lang>`.
- Threaded `t()` through the highest-traffic first-impression surfaces:
  global nav, auth buttons, the landing hero (title/subtitle/CTAs/trust
  chips) and the footer (Footer is now a client component). Deeper pages
  fall back to English automatically, key-by-key.
- Verified live: switching to zu/af swaps hero + nav + footer + `<html lang>`,
  menu lists only ready locales, zero console errors; tsc + production build
  clean.
- ⚠ **isiZulu needs a first-language review** before heavy public reliance —
  translations are careful but unreviewed; a native editor just edits
  `src/i18n/messages/zu.ts`. Afrikaans is solid. (Both noted in-file.)

### Security/Ops — POPIA retention enforcement (5-year job/message purge)
- New `scheduledRetentionCleanup` (`functions/src/retention.ts`): monthly
  scheduled function (1st @ 03:00 SAST, europe-west1 scheduler) that purges
  terminal jobs (confirmed/cancelled) + their messages/offers subcollections
  via `recursiveDelete` once they've had no activity for 5 years — matching
  the privacy policy's stated retention. **Never** deletes active, completed-
  awaiting-confirm, or disputed jobs, or anything with an unknown timestamp.
- Decision extracted into a pure `isPurgeableJob()` predicate, unit-tested
  14/14 (old-terminal → delete; active/disputed/recent/missing → keep).
- No-op until records age past 5 years (platform is months old) — this is
  enforcement infrastructure that activates as data ages. Closes
  LAUNCH_READINESS P2 #8 (retention was stated but not enforced).

### Docs — funding pack (business plan + 12-month cash flow)
- **`Workit - Business Plan.docx`** (6pp, branded): exec summary, problem,
  solution, traction (live numbers — 16 jobs, 8 completed, R8,482 GMV, 15
  members), market, model, GTM, competition, tech/ops, trust & safety, team,
  social impact, use-of-funds, R250k ask, risks. For NYDA / Youth Challenge
  Fund / Pitch & Polish.
- **`Workit - 12-Month Cash Flow.xlsx`** (Assumptions / Cash Flow / Summary):
  R250k grant + conservative revenue ramp (from M8) vs SA cost lines;
  cash-positive every month, ~R32.4k year-end reserve. Formula-driven, zero
  errors (verified via Excel recalc), industry-standard colour coding.
- ⚠ Reconcile before submitting: CIPC registers the company as **"FUTHERSKY
  SOLUTIONS"** (no first 'r'); the docs use the intended **"Furthersky"**.
  Funders verify against CIPC — fix the CIPC name or match the registered
  spelling on applications. Stipend/marketing figures are editable inputs.

### Added — Play Store prep (manifest shortcuts + listing pack)
- **App shortcuts** in `manifest.webmanifest` (long-press the installed icon →
  Find work / Post a job / My account), plus store-quality fields: richer
  `name`/`description`, `id`, `lang` en-ZA, `dir`, `categories`.
- **`STORE_LISTING.md`** — copy-ready Google Play + Apple App Store text
  (names, descriptions, keywords, what's-new), an asset checklist (icons ✅;
  feature graphic + screenshots still to generate), the Android-first
  submission steps (PWABuilder → .aab → assetlinks.json), and an
  `assetlinks.json` template awaiting the signing-key fingerprint.
- Still needs the founder: the US$25 Play account (org = Furthersky skips the
  closed-test gate) and US$99/yr Apple account; I can generate the graphics +
  screenshots and deploy assetlinks.json once the fingerprint exists.

### Added — admin WhatsApp support inbox (two-way replies)
- New **Support** tab in the admin panel (`SupportPanel.tsx`): WhatsApp
  messages from the public, grouped into per-number threads with a chat view,
  unread badges (sidebar + thread list), `g s` shortcut, "open in WhatsApp"
  link, and a reply box. Completes the support front door shipped earlier —
  messages were captured + forwarded but had no in-app read/reply surface.
- New callables (`functions/src/support.ts`): **`replyToSupport`** (admin-only;
  sends via the WhatsApp Cloud API, logs an outbound `supportMessages` doc,
  marks the thread's inbound messages handled) and **`resolveSupportThread`**
  (clear unread without replying). Both verify `role==admin` server-side.
- **24-hour window handled honestly:** WhatsApp only delivers a free reply
  within 24h of the customer's last message. The callable detects Meta error
  131047/131051 and the UI disables the reply box + shows "email them instead"
  past the window, with a "~Nh left" hint as it closes.
- Unread badge uses a single-field `handled==false` query (outbound is always
  written handled=true, so unhandled == unread inbound — no composite index
  for the badge). Added a `supportMessages (waNumber, direction, handled)`
  composite index for the server-side mark-handled sweep (non-fatal if still
  building). Rules unchanged (`supportMessages` already admin-read /
  server-write). App tsc + functions build + lint clean.

### Fixed — two stacking-context bugs (footer over modals, band over name)
- **Report modal hidden behind the footer.** The modal is `fixed z-[9999]`,
  but the global rule `main, footer { position: relative; z-index: 1 }` (lifts
  content above the noise texture) makes `<main>` a stacking context, trapping
  the modal's z-index inside it — so the footer, a later sibling at the same
  z-1, painted on top. Fix: `ReportButton` now portals the modal to
  `document.body` (mounted-guarded, matching the proven `ImageLightbox`
  pattern) so it escapes the trap. Reproduced + fix verified in-browser.
- **Profile cover band painting over the worker's name.** On `/u`, the gradient
  cover band is `position: relative` while the identity card grid below is
  static — and a positioned element paints above static siblings regardless of
  DOM order, so the band covered the name/avatar that overlap up into it. Fix:
  `relative z-10` on the content grid. Reproduced + fix verified in-browser.
- Note: any future inline modal that must cover the footer should portal to
  body for the same reason.

### Added — WhatsApp support front door (one number, two paths)
- **"Chat to support on WhatsApp"** button on the Help page + a link in the
  footer (`WhatsAppSupport.tsx`), opening a chat with the Workit Business
  number (`27626176512`) pre-filled "Hi Workit support, I need help with…".
  Number comes from `NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER`; component renders
  nothing if unset, so a missing config never ships a dead button. Logs a
  `support_whatsapp_click` GA4 event.
- **`jarvisWhatsApp.ts` now serves two senders on one Cloud API number.**
  Owner → Jarvis agent, byte-for-byte as before (owner-lock still gates the
  agent — strangers can NEVER reach Jarvis's commands, memory, or data).
  Everyone else → new `handleSupportMessage`: stores the message in
  `supportMessages`, sends a throttled (6h) auto-acknowledge to the sender
  (free-form, inside WhatsApp's 24h service window), and best-effort forwards
  a heads-up to the owner (try/catch — a forward outside the owner's 24h
  window would need a template; the stored record is the source of truth).
- Rules: `supportMessages` + `supportState` are server-write-only, admin-read
  (+2 rules tests → 55 green). Typecheck + functions build clean. Button
  verified in preview (correct number/prefill; fixed an ochre-tint bug where
  the Help page's `prose [&_a]` rule overrode the white label → `!text-white`).
- **v1 limits (noted for follow-up):** replies happen via email/Business Suite
  (the Cloud API number isn't a phone inbox) — a two-way admin reply inbox is
  the natural next step; first-message-as-photo (no text) isn't captured yet.

## 2026-06-12

### Added — server-side stats pipeline (admin scale prep)
- New `functions/src/stats.ts`: triggers maintain **`stats/totals`** (lifetime
  counters, O(1) read) and **`statsDaily/{yyyy-mm-dd}`** (per-day, SAST):
  signups (+role split), jobsPosted, jobsConfirmed, gmv, disputesRaised,
  accountsDeleted. Admin-only read in rules, writes server-only (+2 rules
  tests → 53 green). Admin UI still streams collections directly — right at
  launch volume; these accumulate from day one so the dashboard can switch
  with full history when volume demands (per BACKLOG "performance & scale").
- **Backfill run 2026-06-12** via `functions/backfill-stats.mjs` (Firestore
  REST + gcloud token; run BEFORE the triggers deployed to avoid double
  counts): 17 users / 16 jobs scanned → 15 signups (8 workers, 6 employers,
  1 business), 8 confirmed jobs, **R 8,482 GMV**, 3 disputes, 10 daily docs.
- Known simplifications noted in the file: role-upgrade doesn't move splits;
  erasure tombstones don't decrement (hard deletes tracked separately).
- Deferred: password-reset e2e test (see BACKLOG, needs an inbox).

### Design — reveal choreography extended to interior pages
- **how-it-works**: step lists stagger in (both employer + worker journeys),
  "things to know" card grid + FAQ items reveal; **categories**: category
  card grid staggers; **PageHero** got a built-in entrance — every page that
  opens with it (workers, businesses, categories, how-it-works, legal pages)
  now greets with the same soft rise; **signin** (promise + form card,
  offset beats), **signup** (header + role toggle), **post-a-job** (title
  block). Live data grids (worker/business directories, job feeds)
  deliberately left out — they'd reveal on skeletons; safety/help prose
  pages left calm on purpose.
- **Motion-system fix found by testing:** fast flicks / anchor jumps can
  teleport more than a viewport per frame, leaving skipped elements
  invisible above the user. The IntersectionObserver top margin is now
  6000px, so anything scrolled PAST counts as revealed. Verified: brutal
  interrupted-smooth-scroll pass now reveals 9/9 on how-it-works (was 6/9),
  signup's display:none role toggle correctly defers, zero console errors.

### Ops — Firestore security-rules test suite (51 tests)
- New `workit/tests/rules/firestore.rules.test.ts` + `vitest.config.ts` +
  `npm run test:rules` (wraps `firebase emulators:exec --only firestore`;
  emulator config added to firebase.json, UI off, port 8080). Needs Java;
  never touches production. **Run before any firestore.rules change.**
- Coverage: users (anonymous blocked, protected-field lockdown per field,
  self-register-as-admin blocked, employer→business upgrade allowed /
  worker→business + →admin blocked, referral +1-only bump), private PII
  subcollection (owner/admin only), fcmTokens, jobs (public read, pending
  accounts can't post, counter +1 cap, no smuggled edits, open-only delete),
  offers (approved-only, open-job-only, name spoofing blocked, read/update
  matrix), messages (participants only, length/empty caps), deletion
  requests, auditLog immutability, server-only moderation writes, reports
  validation, and the catch-all deny (even for admins). All 51 green.
- Fallout fixed: the install bumped TypeScript, which broke
  `Parameters<typeof getCountFromServer>[0]` inference in `adminStats.ts` —
  now explicitly `Query<DocumentData>`. Emulator debug logs gitignored.

## 2026-06-11

### Added — "New job near you" worker push alerts
- New Cloud Function `onJobVisibleAlertWorkers` (`functions/src/jobAlerts.ts`):
  when a job becomes publicly visible, matching workers get a push. Fires on
  the invisible→visible transition, which covers both clean creates (after a
  45s settle so the text-screen / first-post / rate-limit holds can land —
  re-reads the doc before sending) and admin-released held jobs (the normal
  path for a new account's first post). Tag `newjob-{jobId}` dedupes the two.
- Targeting: approved workers only, employer + two-way blocks excluded,
  category must match the worker's chosen categories (none chosen = open to
  all), within 25 km when both sides have coordinates, else same city, else
  same province for workers with no location on file. Nearest first, capped
  at 50 recipients. In-memory matching over the workers list — fine at launch
  volume, move to the planned stats/index approach at scale.

### Added — Firebase Analytics (GA4) funnel events, consent-gated
- `src/lib/analytics.ts`: `track()` helper — fire-and-forget, never throws,
  no-ops on SSR/unsupported browsers/missing measurementId, and **only runs
  after cookie-banner consent** (`workit_cookie_consent_v1 === "accepted"`),
  making the banner a real POPIA runtime gate for the first time.
- Events: `sign_up` (all four auth paths: password / google / phone×2, with
  role), `profile_completed` (first save), `job_posted` (category, price,
  urgent), `offer_made`, `offer_accepted`, `job_completed`, `job_confirmed`,
  plus SPA `page_view` on route changes (`AnalyticsPageViews` in the root
  layout, pathname only — no query strings / ids).
- Config: `measurementId` (`G-NTS42MK3ZN`, already linked on the Firebase
  project) added to `firebase.ts` + `.env.local`(+example); new
  `getFirebaseApp()` export.
- Copy updated honestly: cookie banner now mentions consent-gated anonymous
  usage stats; privacy policy "Cookies" section describes GA4 + the decline
  path. (Privacy already declared "basic analytics" under Technical data.)

### Security — two-step verification (TOTP), required for admins
- **Project:** upgraded Firebase Auth to **Identity Platform** and enabled
  TOTP MFA (`mfa.providerConfigs[totp]`, adjacentIntervals 2) via the admin
  API. Billing note: phone-OTP sign-in SMSes now bill per message from the
  first one (no free pool) — cents at current volume. TOTP itself is free.
- **New `/account/security` page:** enroll an authenticator app (QR rendered
  locally with `qrcode` — the secret never leaves the device — plus a manual
  setup key that doubles as the user's backup), verify a 6-digit code,
  remove (non-admins only). Handles `auth/requires-recent-login` inline with
  password or Google re-authentication. Linked from /account ("Security").
- **Sign-in challenge:** `TotpChallenge` component; the email form on
  /signin and GoogleButton both catch `auth/multi-factor-auth-required` and
  swap to the 6-digit prompt (`lib/mfa.ts` wraps the SDK).
- **Admin gate:** `/admin` refuses to render for an admin with no TOTP
  factor — full-screen prompt links to the setup page. ADMIN_GUIDE.md
  updated (requirement + lost-device recovery via the other admin in the
  Firebase console).
- Gotcha for the record: new routes 404'd in dev until `.next` was cleared —
  Turbopack's persistent filesystem cache held a stale route manifest.

### Design — motion & micro-interaction pass (whole app)
- **Motion system** in `globals.css`: easing tokens (`--ease-out-soft`,
  `--ease-spring`), scroll-reveal pre/post states driven by `data-reveal` /
  `data-reveal-group` (staggered children, 80ms beats, capped at 8), CTA links
  with draw-in underline + arrow nudge (`.link-cta`), desktop nav underline
  (`.nav-link`), and an opacity-only route fade (`.page-enter`).
  Transform/opacity only (low-end Android budget); everything dies under
  `prefers-reduced-motion` (which now also kills smooth-scroll).
- **`ScrollReveal.tsx`** (root layout): IntersectionObserver adds
  `.is-revealed`; progressive enhancement via `html.js-reveal` so content can
  never be stuck invisible without JS; MutationObserver (rAF-throttled) covers
  SPA navigations and client-fetched lists.
- **`template.tsx`**: every route change gets the soft page fade. Opacity-only
  on purpose — a transform would re-anchor fixed children (SOS button) while
  animating.
- **Buttons** press down (`active:scale-[0.98]`) app-wide; **mobile bottom
  nav** active tab gets a spring-scaled pill glow behind the icon + tap-shrink
  feedback; **desktop header nav** links underline-draw on hover.
- **Landing / Testimonials / FAQ** sections choreographed with reveals
  (steps, categories, safety, stories, workers CTA). HomeDashboard untouched —
  it already has its own staggered entrance.
- Verified in the live preview at mobile + desktop widths, light + dark:
  11/11 reveal targets fire on scroll, hidden pre-state confirmed, active-tab
  pill opacity checked, zero console errors.

### Changed — cookie consent re-asked under analytics-aware wording
- Consent storage key bumped `workit_cookie_consent_v1` → `_v2` (banner +
  analytics gate): everyone answers the banner once more, since v1 consent
  was given under "no tracking cookies" copy that predates GA4. Strictest
  POPIA reading; decliners stay untracked exactly as before.

### Docs — ADMIN_GUIDE.md (admin onboarding handbook)
- New `ADMIN_GUIDE.md` for onboarding admins (written for Simphiwe): golden
  rules (audit log, notes, erasure is forever), tab map + keyboard
  shortcuts, a 15-minute daily routine (attention cards → approvals →
  verification with document checks → disputes with resolution semantics →
  moderation), Jarvis usage, and a "never do" list (Gold badge only with
  police clearance, no PII screenshots, no curiosity lookups).
- Note: rebooking ("Hire again") was assessed as a gap but already exists —
  confirmed-job Rebook buttons (single + per-crew-worker) pre-fill
  /post-a-job and re-invite the worker. No change needed.

### Added — Admin Overview is now a live smart dashboard
- **Live data:** the all-users feed on Overview/Analytics switched from a
  one-shot fetch to a Firestore `onSnapshot` stream (jobs already streamed), a
  pulsing LIVE indicator + SAST clock sits above the KPIs, and a 30-second tick
  keeps relative times and day-window numbers fresh without a reload.
- **Emergency banner:** any job whose in-app emergency button was pressed in
  the last 24h shows a top-priority red banner with direct links.
- **Happening now panel:** jobs currently in motion (en-route vs working, crew
  size, live-tracking chip when the worker shares location), urgent-open and
  awaiting-confirmation chips, and the workers currently flagged
  "available now" (respects the 8h auto-expiry, approved accounts only).
- **Week-on-week deltas** (▲/▼ chips) on the signup, job-post and GMV KPIs.
- **Smart insights:** rule-based plain-English observations — signup/post
  trends, open jobs with no offers for 3+ days, supply-vs-demand imbalance,
  30-day offer-coverage and completion rates, busiest category + suburb this
  week, verification-queue ageing (with jump link), and the 30-day dispute
  rate. Caps at 7, hides anything below its significance threshold.
- **Job funnel:** posted → got offers → assigned → confirmed-done bars over
  the last 30 days with % of posted.
- Existing trends, attention, activity-feed and newest-accounts sections kept
  as-is below the new panels.

## 2026-06-10

### Added — Admin power-ups: global search, user command-center, shortcuts
- **Global search** in the admin top bar (`AdminSearch`): find any user by name
  prefix / exact email / uid, or any job by title prefix / id — from any tab.
- **UserDrawer** — per-user command center that opens from a search hit or the
  new **Manage** button on Users rows: live profile + badges, contact links,
  stats, inline **approve / reject / suspend / reinstate** + worker-verification
  **approve / +Gold / reject** (with note, audit-logged, same semantics as the
  queues), their recent jobs, and the user's full admin history.
- **Keyboard shortcuts:** `/` focuses search; `g`+key switches tabs (g u users,
  g o overview, g j jarvis, g v verification, g b business, g d disputes,
  g m moderation, g n analytics, g h heatmap, g l audit). Hint in the sidebar.
- Fixed deploy-state gap: `getVerificationPayload` (signed-URL callable) had
  silently failed to deploy twice (expired CLI auth, then a network flake with
  the exit code masked by a pipe) — now live alongside rules + indexes +
  hosting; production fully converged on the security pass.

### Security — erasure, signed URLs, rule tightening, Sentry scrub
- **POPIA erasure shipped** (`eraseUserData` callable + red "Deletion requests"
  panel on the admin Users tab): wipes Storage folders + private doc +
  subcollections, anonymises the profile to a tombstone, deletes the Auth
  account, closes the request, audit-logs (`account_erased`). Refuses admins /
  self. Previously requests were written but invisible — no admin surface
  existed. Procedure documented in `DELETION_RUNBOOK.md`.
- **Signed URLs for verification docs** (audit 🟠 #3): new uploads store Storage
  paths; `getVerificationPayload` (owner/admin) mints ~15-min signed URLs for
  review + previews. Forever-token links are no longer persisted.
- **Job counter rules tightened** (audit 🟡): approved accounts only, +1 max per
  write, photo stack capped at 8.
- **Sentry PII scrub**: breadcrumb URLs lose query strings (Storage tokens);
  email addresses scrubbed from error text.
- New index: `deletionRequests (status, requestedAt)`.

### Security — Phase B: home GPS + date of birth off the public profile
- Exact `homeLat/Lng` (+accuracy/pinnedAt) and `dateOfBirth` moved to
  `users/{uid}/private/profile` (owner+admin only). Public doc now carries only
  **derived** values: `approxLat/approxLng` (~1 km rounding — workers-directory
  distance still works, exact homes can't be harvested) and `birthYear` (public
  age display still works). Owner reads merge from private via AuthContext;
  all signup paths + the profile home-pin save write the split correctly;
  POPIA export includes the private fields.
- Migration extended (same admin **Run migration** button) — moves existing
  users' home + DOB and writes the derived fields. **Re-run it once.**
- `email`/`phone` deliberately left public for now (admin list + contact UX
  depend on them) — recorded in SECURITY_AUDIT.md to revisit before scale.

### Security — business-lead spam hardening (audit 🟠 #2)
- `onBusinessLeadCreated` now deletes leads aimed at non-business targets and
  dedupes per worker→business pair — the email-spam amplification path is closed.

### Ops — Cloud Monitoring self-watch (workit-6a927)
- **Uptime check** on workitsa.co.za (5-min, multi-region) + **"site down" email
  alert**; **"functions failing" alert** (any gen-2 function 5xx burst → email) —
  the Gemini outage / billing freeze class of problem now pings the founder in
  minutes. Policies: `4801121724102974123` (uptime), `10234227246364793269` (5xx).
- **Essential Contacts** registered (ALL categories → tshepowayne2@gmail.com) so
  Google's own security/billing/suspension notices reach a monitored inbox.
- Uptime checks + contacts are free; alert *conditions* may bill ~$1.50/mo each
  under Google's newer alerting pricing — the $2 budget alert is the tripwire;
  delete commands recorded in the session notes if a charge ever appears.
- Gemini key project (`gen-lang-client-0516156972`) reviewed: minimal + healthy,
  nothing to enable.

### Design — Testimonials, FAQ + job cards
- Testimonial cards: hover lift + ochre tint, and a 5-star row above each quote.
- FAQ: questions tint ochre on hover/open, the + chip warms, answers slide in.
- JobCard (find-work + dashboards): stronger hover lift, ochre border tint, and
  the job photo gently zooms on hover.

### Design — signed-in dashboard polish (HomeDashboard)
- Greeting gets the PageHero glow treatment + entrance animation.
- Role CTA panels (employer ochre / worker sage) upgraded to gradients with
  light pooling + the beadwork-dot motif; inner pill links lift on hover.
- Stat cards + the active-job card are now tactile (hover lift, ochre border
  tint); stats grid staggers in; About card opens with the beadwork rule.
- (Also: all three landing hero cards now float — the middle one had been
  held back.)

### Design — landing + site-wide polish pass
- **Atmosphere:** new `bg-hero-wash` (sun-glow + sage radial wash, token-driven so
  dark mode adapts); PageHero gains a sage companion glow on every inner page.
- **Hero:** staggered entrance animation (badge → headline → intro → CTAs), green
  ✓ trust ticks; all three job cards now drift gently (`float-soft` animates the
  standalone `translate` property so it composes with rotate; honors
  prefers-reduced-motion).
- **Buttons:** primary gets a clay-like top-to-bottom gradient; primary /
  secondary / danger lift on hover; outline tints ochre.
- **How-it-works:** circled step numbers + hairline that tints ochre on hover;
  cards lift.
- **Categories:** icons sit in tiles that scale + tilt on hover; ochre border tint.
- **Safety band:** warm ember + sage glows so the dark section isn't flat; cards
  brighten on hover.
- **Worker CTA:** light pooling in the corner + beadwork-dot motif.

## 2026-06-08

### Security — Sensitive PII moved off the world-readable user doc (HIGH fix)
- **Finding:** `users/{uid}` docs were readable by any signed-in user, exposing
  another person's SA **ID number** and the **document URLs** for their ID photo,
  selfie, address proof + police clearance — and those `getDownloadURL` tokens
  bypass Storage rules, so a stranger could open the files. POPIA breach + launch
  blocker. (See `SECURITY_AUDIT.md`.)
- **Fix (Phase A):** the verification payload (ID number, doc URLs, address,
  skills) now lives in `users/{uid}/private/profile` — owner + admin only (new
  rule). `AuthContext` merges it back for the owner; the verification page writes
  there; admin review (`VerificationDocs`) fetches it by uid; existing data is
  moved by the new admin-only `migrateVerificationToPrivate` callable
  (run once from Admin → Audit → "Run migration").
- **Phase B (scheduled):** move `homeLat/Lng`, `dateOfBirth`, `email`, `phone`
  too (need a public derived age/value first so matching + age display don't break).

### Security — Phase A: sensitive verification data moved to a private subcollection
- 🔴 HIGH fix (see SECURITY_AUDIT.md): user profiles were world-readable to any
  signed-in user, exposing **ID numbers + verification document URLs** (whose
  tokens bypass Storage rules → strangers could open ID/selfie/clearance files).
- Now the verification payload (ID number, doc URLs, address, skills) lives in
  `users/{uid}/private/profile` — **owner + admin only** (rules enforced).
  AuthContext merges it back for the owner; admin review fetches it by uid; a
  `migrateVerificationToPrivate` admin callable moved existing data.
- **Doc viewer robustness:** the admin review now degrades gracefully — an image
  that fails to load shows a "📄 View document ↗" link instead of a broken
  thumbnail.
- **Upload robustness:** after a Storage upload, the image is verified to actually
  load (via `Image()`, no CORS dependency) before its URL is stored — so a flaky
  upload can never leave a dead link. (`lib/storage.ts`.)
- Phase B (home GPS, DOB, email/phone → private) still pending; needs public
  "derived" values first so matching/age don't break.

### Reverted — Fast-track signup (back to manual approval for everyone)
- Per founder request, **every** new account (employer, business, worker) again
  waits for admin approval (`accountStatus: "pending"`). The fast-track below was
  live briefly; the human gate is restored for the demand side too.

### Changed — Fast-track employer + business signup (acquisition friction)
- New **employer** and **business** accounts are now auto-approved
  (`accountStatus: "approved"`) at signup so the demand side can post jobs
  immediately. **Workers still go through manual verification** (the human check
  that matters for people entering homes). Job content is still moderated
  server-side (text screen + first-post review), so the safety net stays.
- Trade-off to remember: employers/businesses no longer hit the manual approval
  queue. Revert in `AuthContext.tsx` (the `accountStatus` ternaries) if you want
  the human gate back.
- (One-tap WhatsApp share already existed via `ReferralCard` on /account.)

### Added — Business accounts: "express interest" (Phase 3, hireable)
- Workers viewing a business profile can tap **"I'm interested"** (with an
  optional note) → creates a lead at `users/{businessUid}/leads/{leadId}`.
- The business sees an **"Interested workers"** inbox on `/account` (live), each
  linking to the worker's profile to view + invite to a job.
- New Cloud Function **`onBusinessLeadCreated`** emails + pushes the business
  when a lead arrives (reuses the SendGrid mailer + FCM dispatch).
- **Rules:** a worker may create a lead about themselves and read only their own;
  the business reads/updates its own leads. Completes the directory loop (option
  c: discover → contact).

### Added — Employer → business upgrade
- Employers can now self-upgrade to a business account from `/account` ("Run a
  business?" card → confirm → role flips to `business` → straight to
  `/business/edit`). They keep all jobs + history.
- **Security:** a tightly-scoped rule allows a self role change **only**
  employer→business (never to worker/admin), and only when the write changes
  nothing but `role`.

### Added — Business accounts: directory + verification (Phase 2)
- **Directory** (`/businesses`): browsable, searchable (name/area) and
  category-filterable list of businesses, sorted verified-first then by rating.
  Linked from the header nav.
- **Registration-verified tier:** businesses submit a CIPC number + proof doc
  from `/business/edit`; a new **Business verify** admin tab (with live count
  badge) reviews and awards the "✓ Verified business" badge. Approvals/rejections
  are audit-logged (`business_verify_approve` / `business_verify_reject`).
- **Security:** rules now let a business *submit* its verification (status
  `pending`) but **never self-approve** — only an admin can set
  `approved`/`rejected`. CIPC proof docs upload to the private `verification/`
  path (owner + admin only).
- Phase 3 (later): the "hireable" directory contact/invite mechanic.

### Added — Business accounts + profiles (Phase 1)
- New **`business` role** — an "employer-plus" that posts jobs like an employer
  AND has a public profile workers can see. Added role helpers (`isEmployerSide`,
  `canPostJobs`, `isBusiness`) so business behaves like employer across signup,
  account gate, dashboard, notifications, and dispute attribution without
  scattering role checks. Firestore rules allow business account creation.
- **Signup** offers a third "I'm a business" option.
- **Business profile editor** (`/business/edit`): logo, name, tagline, about,
  categories, areas served, contact (website/phone/email), work photos.
- **Public business profile** (`/business?id=`): logo, verified/Business badge,
  rating, categories, contact, about, work photos, and their open jobs — visible
  to signed-in workers.
- **Job surfacing**: businesses post under their trading name + logo, and job
  pages link "Posted by [business]" → the business profile (`employerIsBusiness`
  flag on jobs).
- **Phase 2 (next):** browsable directory + registration-verified badge (CIPC
  docs, admin review). NOTE: lock `businessVerification.status` to admin-only in
  rules before shipping the verified badge.

### Fixed — Jarvis outage (Gemini billing + retired model)
- Jarvis stopped replying: the Gemini key's project was on **prepay billing with
  a depleted balance**, which disables the free tier (`limit: 0`) → every call
  429'd. Fixed by switching the project to **postpay (pay-as-you-go)** billing.
- Separately, Google **retired `gemini-2.0-flash`** (404). Model switched back to
  **`gemini-2.5-flash`** in `jarvisCore.ts` (no daily cap on postpay). Confirmed
  working on dashboard + WhatsApp.

## 2026-06-06

### Added — Launch-readiness: POPIA consent capture
- **Verification consent (P0):** workers must now tick an explicit consent box
  before submitting ID + selfie (special personal information under POPIA);
  `verification.consentAt` + `consentVersion` recorded. (`verification/page.tsx`.)
- **Signup consent recorded (P0):** the Terms/Privacy acceptance was enforced but
  not stored — now every account-creation path writes `termsAcceptedAt` +
  `termsVersion` as proof of consent. (`AuthContext.tsx`, `CONSENT_VERSION` in
  `lib/popia.ts`.)
- Added `LAUNCH_READINESS.md` — full pre-launch audit + prioritized gap checklist
  (legal/operational items flagged for an attorney; code fixes tracked).

### Fixed — build scripts misplaced under public/
- `scripts/` had been relocated into `public/scripts/`, breaking `npm run build`
  (prebuild couldn't find `gen-firebase-messaging-sw.mjs`) and exposing build
  scripts as static assets. Moved all four `.mjs` back to `workit/scripts/`.

### Added — Jarvis Phase 2: actions (with a hard confirmation gate)
- Jarvis can now *do* things, not just report — from both the dashboard and
  WhatsApp: approve / reject / suspend / reinstate an account, approve (incl.
  Gold badge) or reject a worker's verification, and resolve a disputed job.
- **Safety design (`functions/src/jarvisActions.ts`):**
  - The model can only **stage** an action (`propose_*` tools validate + summarise,
    never write). Execution happens only via `executeAction()` after explicit
    human confirmation, which **re-reads live state and re-validates** first.
  - **Dashboard:** `jarvisChat` returns the staged action; the panel shows a
    Confirm/Cancel card; Confirm calls the new `jarvisConfirmAction` callable.
  - **WhatsApp:** Jarvis replies "…confirm?", you reply "yes"/"no" — handled
    deterministically in code (not the model), with a 10-min staleness window.
  - Every execution mirrors the exact `/admin` writes and logs to `auditLog`
    tagged `via:"jarvis"`. No deletes; admins won't be touched; Gold badge
    refused without a police clearance on file.
- `runJarvis` now takes `allowActions` and returns `{ reply, pendingAction }`.
  Chat + WhatsApp enable actions; the morning digest stays read-only.
- New function: `jarvisConfirmAction` (admin-gated). No new secrets.

## 2026-06-05

### Added — Jarvis: morning digest, instant alerts, and WhatsApp
- **Shared brain:** extracted the agent (read-only tools + Gemini loop) into
  `functions/src/jarvisCore.ts` (`runJarvis`) so every surface uses one codebase.
  `jarvis.ts` (dashboard chat) is now a thin admin-gated wrapper.
- **Morning digest** (`jarvisDigest.ts`): `jarvisMorningDigest` runs 07:00 SAST
  (scheduled in europe-west1 — Cloud Scheduler has no africa-south1), asks Jarvis
  to write a short founder brief from live data, and emails it via SendGrid. Plus
  `jarvisDigestNow` (admin-only onCall) to fire one on demand for testing.
- **Instant dispute alert** (`jarvisAlerts.ts`): `onJobDisputedAlert` emails the
  founder the moment a job flips to `disputed`. (Reports already alert via
  `onReportCreated`, incl. the CSAM hard path.)
- **WhatsApp** (`jarvisWhatsApp.ts`): `jarvisWhatsApp` onRequest webhook for the
  Meta WhatsApp Cloud API. Hardened: (1) HMAC `X-Hub-Signature-256` verification
  against `WHATSAPP_APP_SECRET`, (2) owner-lock — only `JARVIS_OWNER_WA` is served,
  strangers are silently ignored and replies only go to your own number, (3) the
  agent is read-only. Keeps last ~20 turns of memory in `jarvisSessions/whatsapp`.
- New secrets needed for WhatsApp only: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
  `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `JARVIS_OWNER_WA`. Digest + alerts
  need nothing new (reuse `GEMINI_API_KEY` + the SendGrid secrets).

### Added — Jarvis, the admin-only ops assistant (phase 1, read-only)
- A private "Jarvis" chat panel in `/admin` (new sidebar section, between Overview
  and Analytics) that the founder can ask about the live state of the marketplace.
- Backed by `jarvisChat` Cloud Function (`functions/src/jarvis.ts`): a Gemini
  agent (`gemini-2.5-flash`, manual function-calling loop) with **read-only**
  Firestore tools — `get_metrics`, `list_pending_approvals`,
  `list_pending_verifications`, `list_open_disputes`, `list_open_reports`,
  `recent_signups`, `recent_jobs`, `search_users`, `get_user`.
- **Why Gemini:** runs on the free tier (AI Studio key) to keep MVP cost at zero;
  one-line `JARVIS_MODEL` swap to a paid model later. POPIA caveat noted in the
  file — the free tier may train on inputs, and these tools return user PII, so
  it's acceptable while testing with a small user base, revisit before scale.
- **Security:** `onCall` (Firebase verifies the auth token) + a server-side
  `role === "admin"` re-check before any model call; the Gemini API key lives
  only as the `GEMINI_API_KEY` Secret-Manager secret — never shipped to the
  browser. Phase 1 cannot approve/reject/suspend/message/delete anything.
- Results trimmed to compact records to keep token use (and latency) down.
- Added `reports` (`status` + `createdAt`) composite index for the reports tool.
- **Not yet deployed** — needs the `GEMINI_API_KEY` secret set first.

### Fixed — Header Safety / FAQ / How-it-works links did nothing
- They pointed at homepage anchors (`/#safety`, `/#faq`, `/#how`), which don't
  exist when signed in (the homepage renders the dashboard, not the marketing
  landing) — so the buttons appeared dead. Repointed to dedicated pages:
  `/safety`, `/how-it-works#faq` (added `id="faq"` to the FAQ section),
  `/how-it-works`. Also fixed the same `/#safety` link in OnboardingCard.

### Ops — DMARC upgraded to p=quarantine
- First DMARC aggregate report (Google, 06-04) showed 3 messages, 100%
  SPF+DKIM aligned, no spoofing — SendGrid + Firebase senders all authenticating.
- Upgraded `_dmarc` from `p=none` → `p=quarantine` (verified live). Unauthenticated
  mail spoofing the domain now goes to spam. Next step (later): `p=reject`.

### Fixed — Admin heatmap Leaflet crash (caught by Sentry)
- `TypeError: Cannot read properties of undefined (reading '_leaflet_pos')` on
  `/admin` — Leaflet's `fitBounds` zoom-animation `setTimeout` fired after the
  map was torn down / re-focused. Set `animate: false` on both `fitBounds` calls
  (FocusController + HeatLayer) and wrapped them + `heat.remove()` defensively.
  First real production bug surfaced by the Sentry alert. 🎯

### Added — Sign in / Sign up with Google
- "Continue with Google" button on both sign-in and sign-up (`GoogleButton`),
  `signInWithGoogle()` (popup) in `AuthContext`.
- New Google users → `/finish-signup` to pick role + confirm age (Google gives
  name/email/photo but not role or DOB), then `completeGoogleSignUp()` creates
  the profile — mirrors the existing phone-signup pattern.
- `AccountGate` now redirects a signed-in user with no profile to
  `/finish-signup` (safety net for mid-onboarding refresh).
- ⚠️ Requires console setup: enable Google provider (Auth → Sign-in method) +
  `workitsa.co.za` in Authorized domains for the popup on production.
- OAuth consent screen branded: app name "WorkitSa" + Wt logo (verified by
  Google) — the sign-in popup now reads "continue to WorkitSa" instead of the
  `firebaseapp.com` domain.

### Added — Custom branded auth emails (bypass Firebase's locked templates)
- Firebase locks the built-in auth-email templates once a custom email domain is
  set, so verification/reset emails were stuck showing `workit-6a927` + a
  `firebaseapp.com` link. Replaced them entirely: new `requestPasswordReset` /
  `requestEmailVerification` callables generate the action link via the Admin SDK
  and send fully-branded emails through SendGrid (same authenticated domain).
- Action links rebranded to `workitsa.co.za` (Hosting serves the identical
  `/__/auth/action` handler there — verified 200).
- Extracted the shared SendGrid transport into `functions/src/mailer.ts`
  (used by both notification + auth emails).
- Client: `AuthContext` (`resetPassword`, `resendEmailVerification`, signup +
  link-email flows) now call the callables instead of the Firebase client SDK;
  added `getFunctionsInstance()` (africa-south1).

### Fixed — Admin Users tab role/suspended filters errored
- The `role`+`createdAt` and `accountStatus`+`createdAt` composite indexes were
  defined in `firestore.indexes.json` but never deployed (all deploys since were
  `--only hosting`), so the paginated Users tab's role/suspended filters failed
  live. Deployed the indexes. Ran the one-off `accountStatus`/`createdAt`
  backfill (12 users, 0 needed changes). This completes the Users-tab work.

### Milestone — indexed on Google
- The site is live in Google search (ranking #1 for "workitsa" with correct
  title + description) — ~1 day after submission, faster than expected.

### Fixed — favicon not showing in search results
- Added a real `/favicon.ico` (multi-res 16/32/48 from the logo) + a 48px PNG;
  metadata now leads with `favicon.ico` and advertises 48px+ icons. The old
  32×32 was below Google's 48px-multiple threshold and there was no
  `/favicon.ico` for the crawler to probe. Favicon in results updates on
  Google's own re-crawl schedule (days–2 weeks), not instantly.

## 2026-06-04

### Added — SEO / discoverability
- `metadataBase` + canonical URL set to `https://workitsa.co.za`.
- Open Graph + Twitter card metadata, with a branded **1200×630 OG image**
  (`/public/og.png`) for link previews (WhatsApp/Facebook/Google).
- JSON-LD structured data (Organization + WebSite) so Google understands the brand.
- Explicit `robots` allow-index (+ googleBot large image preview / full snippet).
- Confirmed `sitemap.xml` and `robots.txt` serve the right URLs on the live domain.
- **Google Search Console**: domain verified via DNS TXT, `sitemap.xml` submitted
  successfully. Indexing now in Google's hands (typically a few days–2 weeks).


### Ops/Perf — Admin Users tab: cursor pagination + accountStatus backfill
- Rewrote the Users tab as `UsersTab` — was reading the **entire** users
  collection on every open; now loads 25 at a time (cursor `startAfter`), ordered
  by `createdAt` desc, with "Load more". Role/suspended filters run server-side
  (new composite indexes: `role+createdAt`, `accountStatus+createdAt`).
- Stat-card totals come from `count()` aggregation (no doc reads). Search filters
  the loaded rows (with a hint); CSV export reads the full filtered set only when
  clicked. Overview/Analytics keep their own all-users stream.
- One-off **`accountStatus` backfill** via a temporary token-guarded function
  (deployed, run, deleted): scanned 12 users, set `accountStatus` on 2 legacy
  docs (+ a `createdAt` sentinel where missing so they page correctly).

### Ops — Custom domain: workitsa.co.za
- Registered `workitsa.co.za` (domains.co.za) and connected it to Firebase
  Hosting (serve-direct, apex `A 199.36.158.100` + TXT verification, auto SSL).
- Swapped every reference from `workit-6a927.web.app` → `workitsa.co.za`
  (14 occurrences across 12 files): `NEXT_PUBLIC_SITE_URL`, email links + footer,
  push-notification deep links, report links, profile share card, referral card,
  sitemap, robots.txt, and the deck source. The `.web.app` URL still works.
- Frontend URL is now single-sourced via `NEXT_PUBLIC_SITE_URL`.

### Ops — Email deliverability completed
- SendGrid **domain authentication** verified for `workitsa.co.za` (5 CNAMEs:
  SPF/return-path + DKIM s1/s2). Mail is now SPF + DKIM signed.
- `_dmarc` upgraded to `v=DMARC1; p=none; rua=mailto:tshepowayne2@gmail.com; fo=1`.
- `SENDGRID_FROM_EMAIL` secret set to `noreply@workitsa.co.za` (v2); the 4 email
  functions redeployed to use it.
- Combined with the earlier List-Unsubscribe / Reply-To / no-tracking work,
  transactional email should now land in inboxes rather than spam.
- **Firebase Auth** email sender domain set to `workitsa.co.za` too: added the
  verification TXT (`firebase=workit-6a927`) + two DKIM CNAMEs
  (`firebase1/2._domainkey`), and merged Firebase's SPF include into the single
  root SPF record. Auth emails (verification / password reset) now send from the
  authenticated domain instead of `firebaseapp.com`. (Verified via DNS; final
  "Apply Custom Domain" click in console.)

### Added — Admin: Analytics tab
- New **Analytics** section (`AnalyticsDashboard`): week-over-week trends
  (signups / posts / completions / GMV with % deltas), conversion-rate tiles
  (fill, completion, dispute, cancellation), a **job funnel**
  (posted → got offer → assigned → confirmed) and **worker funnel**
  (signed up → submitted docs → verified → did a job), and a **suburb
  leaderboard** (posted / completed / GMV / workers). Computed from existing
  users+jobs streams — no extra reads.

### Ops — Admin: scalable badge counts (no more full-collection scans)
- New `lib/adminStats.ts` uses Firestore `count()` aggregation
  (`getCountFromServer`) for the sidebar badges (users total, pending
  approvals, verification queue) instead of downloading the entire `users`
  collection client-side. Billed ~1 read per 1000 docs → scales with growth.
- Fixed a latent bug: badge counts were derived from `allUsers`, which only
  loads on the Overview/Users tabs, so the badges silently showed 0 elsewhere.
  They're now correct on every tab.
- Removed a redundant full `users` scan that ran on the Overview tab (Overview
  already streams its own data for the dashboard).
- Added two composite indexes on `users` for the verification count queries.

### Added — Admin: in-panel verification doc viewer
- New `VerificationDocs` component: ID / proof-of-address / police-clearance /
  past-work images are now clickable thumbnails that open the in-app lightbox
  (prev/next, esc) instead of each opening a new browser tab; the selfie video
  plays inline; PDFs stay as labelled links. Big time-saver on the admin's most
  frequent task.
- Admin design polish: search field focus ring, filter-chip hover states.

### Docs — Added this CHANGELOG.

### Design — Dark-mode contrast audit
- Audited every dark-mode colour pair against WCAG AA (computed ratios, not eyeballed).
- Brightened accent **text** colours that failed on the dark surface: `ochre-600`
  (4.0→7.0), `ochre-700` (2.5→6.5), `sage-700` (2.5→7.3).
- Split the `brick` token: `--color-brick` (text) now brightens in dark mode
  (errors 2.7→6.3), while a new `--color-brick-solid` (unchanged) backs the
  white-on-brick fills (SOS, danger, dialogs) so they keep their contrast.
- Left `sage-600` un-brightened on purpose (it's a white-text fill on admin badges).
- Light theme byte-for-byte unchanged.

### Fixed — Deck (PowerPoint "repair" prompt)
- Replaced the one native chart on the monetization slide with a shapes-based
  bar chart — the embedded Excel workbook was triggering the repair prompt.
- Stripped bare directory entries from the `.pptx` package (secondary trigger).

### Added — Deck: funding ask
- Added 3 slides: the ask (R100k vs R500k), and a line-item budget breakdown
  for each tier.

## 2026-06-03

### Design — Design-system pass (deployed)
- **Form fields** (`Input`/`Textarea`/`Select` + find-work search): added a
  visible focus ring (was `focus:outline-none` only — a WCAG 2.4.7 fail) and
  error-state borders with `aria-invalid`.
- **JobCard**: fixed the save/heart button styling on photo-less cards.
- **Button**: added a `loading` state (spinner + `loadingText`) and migrated
  ~17 async buttons to it; added a `danger` variant (solid brick); subtle
  hover-lift on primary/secondary.
- Converted `DisputeButton` and `LocationPicker` raw buttons to `<Button>`.
- **Rounding**: standardised form-entry fields to `rounded-md`; reserved pills
  for chips/toggles/search/chat.

## 2026-05-29

### Design — Page heroes
- New `PageHero` component (beadwork motif + glow); rolled out across
  categories, how-it-works, verification, and all `LegalPage` pages.
- Public profile (`/u`): added a portfolio cover-band hero.
- Find-work: grouped the filters into one panel + a live result count.

### Ops — Email deliverability & infra
- Email: added `List-Unsubscribe` + one-click headers, `Reply-To`, disabled
  open/click tracking, postal footer (Gmail/Yahoo bulk-sender compliance).
- Fixed a **region-drift bug**: pinned all functions to `africa-south1` via
  `globalConfig.ts` (code had drifted to `us-central1` vs the live deployment).
- Added weekly scheduled **Firestore backups** (`scheduledFirestoreBackup`,
  europe-west1 — Cloud Scheduler has no africa-south1).
- Documented DNS (SPF/DKIM/DMARC), Sentry DSN, and backup-bucket setup steps
  in `functions/README.md`.

---

## Earlier

Initial Workit MVP and prior feature work (two-sided marketplace, phone/email
auth, worker verification + Gold badge, crew jobs, in-app chat, live location,
SAPS emergency, disputes, moderation suite, web push, admin dashboard, worker
portfolios, the system/investor deck) predates this changelog and is summarised
here rather than itemised.
