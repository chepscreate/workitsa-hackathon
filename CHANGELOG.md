# WorkitSA — hackathon build log (19–26 Oct 2026)

## 2026-10-25 (WhatsApp onboarding polish + approval notification + job details)

### Changed — alert→details→offer flow (two-step acceptance)
Job alerts now guide workers through: VIEW (see full details) → ACCEPT (send offer).
Replying ACCEPT directly to an alert shows the job details first instead of
immediately sending an offer. Workers can also reply OFFER 400 to counter-offer.
A second ACCEPT after viewing details sends the offer. Added VIEW command.

### Added — demo always-alert override
New `config/demoAlerts` Firestore doc with `alwaysAlert[]` array. Numbers in the
list bypass ALL filters (opt-in, area, category, employer-self) for both job alerts
and the JOBS listing — ensures demo recordings capture every posted job.

### Changed — JOBS list limit raised from 10 to 35
Workers now see up to 35 open jobs when they text JOBS.

### Changed — alert text uses ACCEPT instead of number
Job alerts now say "Reply *ACCEPT*" instead of "Reply *1*" to avoid confusion with
the numbered JOBS list.

### Changed — picking a job number now shows full details before offering
When a worker replies with a job number (e.g. "1"), they now see the full job
details first — title, description, location, price, employer name, duration,
due date, and payment method — then reply ACCEPT or OFFER with a price. Previously
the offer was sent immediately with no detail view.

### Changed — onboarding asks for full name and surname
The name step now prompts "What's your *full name and surname*?" instead of just
"name", so workers provide both from the start.

### Changed — "Other" category text simplified
Removed "I'll do anything" from the Other category label — now just "Other".

### Changed — post-onboarding welcome message
Removed JOBS/HELP commands from the welcome message (they're gated behind approval
anyway). Instead tells the worker they'll receive a full guide once approved.

### Added — WhatsApp approval notification with instruction manual
When an admin approves a worker who has a `whatsappNumber`, the
`onVerificationDecision` trigger now sends a WhatsApp message with the full
instruction manual (JOBS, counter-offers, AVAILABLE, SOS, STOP, HELP commands).
Workers only learn the commands after they're approved and can actually use them.

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

