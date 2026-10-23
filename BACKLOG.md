# Workit — Backlog (deferred, not yet done)

Tracked so they're not lost. Roughly priority-ordered within each area.

## 🌍 Live "Pulse" god-view — SHIPPED v1 2026-09-29 (`/admin/live`)
Built: dark Leaflet map + animated canvas overlay (worker dots, jobs by status,
hire arcs, pulses), live KPI ticker + event feed, Live/Simulate toggle, heatmap
toggle, sound-per-hire. Files: `workit/src/app/admin/live/page.tsx` +
`workit/src/app/admin/_components/LivePulse.tsx`.
Follow-ups to consider: optional globe version for the national/African expansion
story later; consider a public/redacted "live" teaser. If the demo/marketing wants
it looking busy live, keep Simulate — never present simulated data as real to investors.

### ✅ SHIPPED — cockpit v2 (2026-09-29)
All in `workit/src/app/admin/_components/LivePulse.tsx`; verified via temp lab page (deleted), deployed.
1. ✅ **Heatmap intensity** — zoom-scaled radius/blur (46→24), higher per-point weights,
   hotter gradient, `minOpacity`, re-tunes on `zoomend`.
2. ✅ **Richer signals** — offers (`collectionGroup("offers")`, pending, teal diamonds) +
   real available-now (fixed the hardcoded `available:true` bug, uses `isAvailableNow`) +
   new KPIs (Available now, Offers). NB: no presence/`lastSeen` field exists, so "online
   workers" maps to the worker footprint; add real presence tracking later if wanted.
3. ✅ **Auto-zoom to busiest suburb + suburb filter** — scores suburbs, flies to hottest;
   dropdown filters map/heat/KPIs to one suburb + "All areas" reset + focus chip. Sim now
   clusters by suburb (Alberton weighted highest).
✅ `?src=fb` sign-up attribution — SHIPPED 2026-09-29 (first-touch capture → `signupSource` on
profile across email/Google/phone; `signup_source` column in Users CSV; FB post links tagged).

## 📣 Growth restart — ALBERTON beachhead (2026-09-29, ACTIVE)
Founder is restarting growth. Proven channel: posting in Facebook unemployment
groups drove ALL prior worker sign-ups (short first-person post + workitsa.co.za
link). Plan: run supply (worker groups) + demand (Alberton community groups + 225
B2B leads + seeded jobs) TOGETHER in Alberton, density-first.
- Post bank: `workit/marketing/outreach/facebook-growth-posts.md` (rotating supply +
  demand variants, Alberton targets, anti-ban rules).
- PR: Alberton Record pitch drafted in founder's Gmail drafts (albertonrecord@caxton.co.za)
  — angle: Alberton-based founder (company registered in Alberton) launching locally.
- Demo/live-map data re-pointed to Alberton (was Linden); still demoSeed:true.
- KEY RISK: supply-only churns without jobs — must keep demand posting + B2B in step.
- TODO next: cockpit upgrades (heatmap intensity, offers/available/online signals,
  auto-zoom/suburb filter) + `?src=fb` sign-up attribution; draft the B2B demand email
  sequence for the 225 leads.

## 🚀 Demand / cold-start features (deferred by founder 2026-09-23 — return to this)
The business-critical gap surfaced by the Harambee investor questions: 90 workers,
~0 jobs, 0 business accounts — the platform is supply-heavy and demand isn't
switched on. Founder said "note that down, we'll return to it." Build set:
- **Employer-side referral / "invite someone who needs a job done"** (the current
  referral loop is worker-oriented — make it pull demand too).
- **Business / SME accounts** (recurring, cheap, reliable demand — currently zero;
  `role: "business"` exists in the model but no accounts).
- **First-job incentive / free featured post** to spark the first transactions per
  suburb.
- **Low-friction "post a quick job" entry** so a first-time employer posts in <60s.
- Related: stakeholder-facing **outcomes/impact view** (jobs done, rand earned by
  workers, workers verified) — reuse/extend `/stats`; doubles as Harambee
  outcomes-funding evidence.
Also noted (separate, later): skill-credential badge tier (BluLever-certified) — see
the category-qualifications item below; subscription billing rails for the R25/R50
model (park until demand is live).

## 📜 Category-specific qualifications (greenlit 2026-07-08 — build next)
- Founder approved the recommendation: workers selecting **regulated categories**
  (skilled trades e.g. electrical/plumbing, childcare & elderly care,
  tutoring & education, driving & delivery) must attach **at least one
  credential** (certificate upload or qualification entry) before verification
  submits; gardening/cleaning/moving/general stay open. Quals stay
  optional-but-rewarded everywhere else. Enforce in
  `workit/src/app/verification/page.tsx` submit + show which categories are
  regulated; admin queue should surface the credential for review.

## 🚩 Fraud-signal follow-up (deferred by founder 2026-07-12)
- **Retroactive backfill of the duplicate-ID / duplicate-file indexes** — the
  fraud layer (fraudSignals.ts, shipped 2026-07-12) only indexes IDs/files as
  they're written going forward. A one-off admin script should walk existing
  `users/*/private/profile` docs + `verification/` storage objects into
  `idIndex`/`fileIndex` so pre-existing accounts are covered too.

## 🔐 Security open items (noted 2026-07-06 — founder wants to return to these)
- See **SECURITY_AUDIT.md § "OPEN ITEMS — re-verified 2026-07-06"**. Top of the
  list: App Check + a rate limit on `requestPasswordReset` (small fix, do before
  marketing pushes); then email/phone exposure at scale; storage jobs-write
  tightening; `assignedAt` blacklist nit; external pen-test pre-scale.

## 🔎 Skill search follow-ups (v1 shipped 2026-07-06)
- **Job↔worker skill matching** — boost workers whose `skills` include a job's
  `subcategory` in `scoreJobForWorker` (matching.ts) so find-work ranking and
  the offer stack use the same skill signal the directory now does.
- **/workers page i18n** — the directory (incl. the new Skill / Availability
  filters) is English-only; give it the find-work treatment (en/af/zu).
- ~~Skill-nudge for existing workers~~ — ✅ shipped 2026-07-06
  (SkillNudgeBanner on /account).

## ⚙️ Live behaviour note (2026-06-11)
- **Admin 2FA is REQUIRED** — project upgraded to Identity Platform, TOTP
  enabled. `/admin` blocks until the admin enrolls an authenticator at
  `/account/security`. Billing: phone-OTP sign-in SMS now bills per message
  (no free pool) — cents at current volume. ⚠️ Founder action: enroll your
  authenticator on next sign-in (first real end-to-end test) + tell Simphiwe.
- **Firestore rules tests** live at `workit/tests/rules/` — run
  `npm run test:rules` before any rules change (needs Java; uses the
  emulator, never production).
- **Password reset — code-complete + deployed (verified 2026-07-02).** The flow
  is correct end-to-end in code: `/forgot-password` → `resetPassword` →
  `requestPasswordReset` callable (live) → branded SendGrid email with the link
  rewritten to workitsa.co.za; `workitsa.co.za/__/auth/action` serves 200;
  authorized-domain confirmed. **Only remaining:** a real-inbox end-to-end test
  (disposable account → forgot-password → email arrives → link sets a new
  password → old one dead). Needs an inbox — founder participation easiest.

## 🛟 Safety toolkit — v2 ideas (v1 shipped 2026-06-18)
- v1 live: SOS captures GPS + pages the safety team in real time (founder email
  + admin push) + admin active-SOS banner with map link & mark-handled. See
  CHANGELOG 2026-06-18.
- **Trusted-contact loop** — let a worker share a job (who/where/when + a live
  status link) with a family member via WhatsApp/SMS *before* they go. The
  single biggest perceived-safety feature; uses the existing `publicShareToken`.
- **Safe-arrival / safe-done check-ins** — "I've arrived", "I'm done safely";
  escalate to the safety team if a worker goes quiet past an expected window.
- **Per-crew live location** — `workerLocation` is single-pin today; crews need
  per-worker tracking before the LiveLocationView is shown for them.
- **Outbound WhatsApp to founder on SOS** — email + push ship today; a WhatsApp
  ping would be even faster (needs an outbound send adapter in notify.ts).

## 👩 Women's-safety toolkit (brainstorm 2026-06-19; #1 shipped)
Both sides carry risk: women workers entering strangers' homes, women employers
letting strangers in. SA context (high GBV, slow SAPS) means private armed
response matters more than 10111. Prioritised from a cross-app review (Uber,
Bolt, Bumble, Care.com, SweepSouth, GRIT/Kwanele).
- ✅ **#1 Job start code (doorstep handshake)** — shipped 2026-06-19 (see CHANGELOG).
- ✅ **#2 Auto-arm "share with a trusted contact" on job start** — shipped
  2026-06-19 (TrustedContactArm: one-tap WhatsApp to a device-saved contact when
  the worker taps "on my way"). See CHANGELOG.
- **Safe-arrival / safe-done check-ins with escalation** — "tap when you arrive /
  done"; if a worker doesn't check out within the window, escalate to the trusted
  contact + safety team. The only thing that catches *silent* trouble. Reuses the
  recurring-jobs scheduled-function pattern + the SOS escalation path.
- **Armed-response integration on SOS** (biggest real-world bet) — wire AURA /
  Namola / a private-security API so SOS dispatches actual responders to the
  captured GPS, not just an admin page-out. Contract + cost; founder call.
- **Evidence capture on SOS** — short audio clip + GPS to a secure vault (GRIT
  model). Needs POPIA consent + retention design before build.
- **Women-prefer-women matching** — turn the soft `workerPreference.gender` into
  real options (women employers → women workers only; women workers → women/
  verified employers first). The core women-specific lever (Uber/Bolt/Shebah).
- ✅ **#3 Verify employers — phase 1** shipped 2026-06-19: "Who you'd be working
  for" trust panel (rating, workers-hired, member-since, business/ID badges,
  new-account caution) shown to workers before they accept. See CHANGELOG.
  - ✅ **Phase 2** shipped 2026-06-20: optional employer/business **ID
    verification** reusing the worker pipeline (streamlined form, trigger,
    admin-queue inclusion, /account entry point). Optional — never gates posting.
    Lights up the ✓ ID-verified badge the panel renders. See CHANGELOG.
  - **Phase 3 (optional, later):** POPIA — the consent text + privacy operator
    clause already cover ID/selfie processing; if employer verification volume
    grows, consider the same Smile ID Layer-2 (DHA + biometric) path noted for
    workers. Also: the "Approve + Gold badge" admin button is worker-specific —
    harmless for employers but an admin shouldn't use it on them.
- **Chat safety** — extend the text-screen to messages, auto-blur unsolicited
  images (Bumble "Private Detector"), one-tap block/report from every chat.

## 🔎 SEO follow-up (DEFERRED 2026-06-18, low)
- Canonical + sitemap indexing bugs FIXED 2026-06-18 (see CHANGELOG). Optional
  hardening: **consolidate the `workit-6a927.web.app` domain to `workitsa.co.za`**
  so Google never indexes the Firebase default domain as a duplicate. The 7
  content pages already carry absolute canonicals to the custom domain; only the
  client-rendered homepage self-canonicalises per-host. A hosting-level redirect
  from `*.web.app` → `workitsa.co.za` would close it — but verify it doesn't
  break the `.web.app` URL used for deploy smoke-tests first.

## 🔒 Security follow-up (DEFERRED 2026-06-17, low severity)
- **Tighten `storage.rules` for `jobs/{jobId}/…`** — currently any signed-in user
  can upload there (not just the job's employer + assigned workers). Low impact
  (an uploaded file is inert unless referenced from the job doc, which the
  Firestore rules control). Before tightening, **verify the post-a-job upload
  timing**: the gate would `firestore.get(jobs/{jobId})`, so if photos are
  uploaded *before* the job doc exists, a naive participants-only rule would
  block legitimate posting. Check the post-a-job flow first. (Tracked in
  SECURITY_AUDIT.md.)

## 🪪 KYC Layer 2 — Smile ID (DEFERRED 2026-06-17, needs founder account)
- **Layer 1 is LIVE** — free, instant SA ID structural check (Luhn + DOB/gender
  cross-match) runs on submit and shows in the admin queue. See CHANGELOG
  2026-06-17. That's the cheap fraud filter.
- **Layer 2 = real verification:** a provider-abstracted Cloud Function that
  calls **Smile ID** for (a) Home Affairs / DHA ID validation (confirms the
  number exists and belongs to a real person) and (b) a **biometric selfie
  match** against the ID photo (confirms the applicant *is* that person). This
  is what actually stops someone using a stolen-but-valid ID number.
- ⚠️ **Founder actions required before build:**
  1. Create a **Smile ID** account (https://smileidentity.com) — I can't create
     accounts. Get `SMILEID_PARTNER_ID` + `SMILEID_API_KEY`; I'll store them as
     function secrets (Secret Manager), never in the repo.
  2. **Privacy policy / consent update** — DHA validation + biometrics send PII
     to a third-party operator; needs an explicit consent checkbox at
     verification and an operator clause in `privacy`. (POPIA.)
- Cost is **per-verification** (a few rand each), so gate it behind the free
  Layer 1 pass — only spend on numbers that already look legitimate.

## ⚙️ Live behaviour note (2026-06-08)
- **Fast-track signup REVERTED** (per founder request) — **every** new account
  (employer, business, worker) is back to `accountStatus: "pending"` and waits for
  manual admin approval before posting/offering. (Deploy `--only hosting` to make
  it live.) Also tightens the spam-surface flagged in SECURITY_AUDIT.md.

## ▶️ Come back to (parked 2026-06-08)
- **Go-to-market** — `GO_TO_MARKET.md` is ready to action (get real businesses +
  workers on the platform). The actual strategic gap.
- **Launch-readiness** — erasure-on-deletion Cloud Function still paused (awaiting
  go-ahead); legal items are the founder's (attorney sign-off + IO registration).
  See `LAUNCH_READINESS.md`.
- Business accounts Phases 1–3 + upgrade: ✅ done.

## Jarvis — ✅ RESOLVED 2026-06-08 (Gemini billing → postpay, model → 2.5-flash)
- **Fix applied:** switched the Gemini project to **postpay billing** (was prepay
  with a depleted balance → free tier disabled `limit:0` → everything 429'd).
  Also `gemini-2.0-flash` was retired by Google (404), so the model is back on
  **`gemini-2.5-flash`** (no daily cap on postpay). Jarvis confirmed replying on
  dashboard + WhatsApp.
- **Original symptom (for the record):** Jarvis stopped replying (dashboard +
  WhatsApp + digest) — all Gemini calls 429 with `RESOURCE_EXHAUSTED`.
- **Cause:** the `...6OxQ` "Workitsa" Gemini key (`gen-lang-client-0516156972`)
  is on **Firebase Payment · Tier 1 · Prepay** and the **prepaid balance is
  depleted**; free-tier fallback on a billing-enabled project is `limit: 0`, so
  everything fails. NOT a code bug.
- **Fix (founder, in AI Studio → Billing for the Workitsa project):** either top
  up prepaid credits, or — better — switch **Prepay → Postpay (pay-as-you-go)**
  so it bills monthly and never runs dry. Usage is ~cents/month. No redeploy
  needed; same key just needs funds.
- **After billing is sorted:** optionally switch the model back to
  `gemini-2.5-flash` in `functions/src/jarvisCore.ts` (`JARVIS_MODEL`) — slightly
  sharper, and the daily cap is irrelevant on a paid account. Currently on
  `gemini-2.0-flash`.
- Jarvis is otherwise fully built + deployed: dashboard chat, WhatsApp (permanent
  token), morning digest 07:00 SAST, dispute alerts, and Phase-2 actions
  (approve/verify/resolve) behind a confirm gate + audit log.

## Business accounts (Phases 1 & 2 ✅ done 2026-06-08)
- ✅ Phase 1: business role, signup, profile editor (`/business/edit`), public
  profile (`/business?id=`), job surfacing.
- ✅ Phase 2: directory (`/businesses`), registration-verified tier (submit CIPC
  → admin "Business verify" tab → badge), rules lock `businessVerification.status`
  to admin-only.
- ✅ Employer→business self-upgrade (from `/account`, rule-scoped to that one
  transition) — done 2026-06-08.
- ✅ Phase 3 ("hireable", option c) done 2026-06-08: worker "express interest"
  on a business profile → lead doc → `onBusinessLeadCreated` emails/pushes the
  business → "Interested workers" inbox on `/account` → view + invite to a job.
- **Optional later:** a fuller worker↔business DM thread (current flow is
  express-interest + the existing job-invite, not free-form chat off a job).
- **Optional:** a `role + ratingAvg` index if the directory needs server-side
  sort at scale (client-side sort is fine for now).

## Launch-readiness (PAUSED 2026-06-06 — see LAUNCH_READINESS.md for the full brief)
- ✅ **Done:** verification POPIA consent checkbox + recorded consent; signup
  consent (`termsAcceptedAt` + version) recorded on every account.
- **Pending — code:**
  - ✅ **Erasure-on-deletion — LIVE.** `eraseUserData` callable (admin + 2-step
    verification required) wipes Storage folders + private doc + subcollections,
    anonymises the public profile to a tombstone, deletes the Auth account, and
    audit-logs it; the admin `DeletionRequestsPanel` actions pending requests.
    Deliberately manual (never a side effect). ✅ **Aging safety-net added
    2026-07-02** (`scheduledDeletionRequestCheck`, daily 06:00) so the 30-day
    promise isn't silently missed — deployed ✅ 2026-07-02. ⚠️ Founder must enrol
    admin TOTP to actually use the erase button.
  - Deletion runbook (doc); Sentry PII scrub (confirm no IDs/emails in errors).
- **Pending — legal/ops (founder, can't be coded):**
  - Attorney sign-off on Terms + Privacy (clauses flagged in `terms/page.tsx`).
  - Register the Information Officer with the Information Regulator (POPIA).

## 🔐 RBAC — phases 1+2 shipped 2026-07-13; next steps
- ✅ Phase 1 (foundation): roles.ts matrix, `setAdminRole` callable, Manage
  admins panel. ✅ Phase 2 (enforcement): rules/callables/tabs converted to
  `can(perm)` with the no-lockout hybrid (claims authoritative once tagged;
  untagged legacy admins unaffected). See CHANGELOG 2026-07-13.
- **Founder actions:** assign Simphiwe→operations; have another owner-capable
  account assign Tshepo→owner (no self-assign); both re-sign-in.
- **Phase 2.1 (tidy):** once both founders are tagged, remove the
  untagged-legacy bootstrap branches (perms.ts, adminRoles.ts, rules `can()`)
  and convert the remaining coarse callables (jarvisConfirmAction,
  marketingRunNow/Status, backfill/migrate utilities) to requireCan.
- **Phase 3:** ID-doc access logging (`idDocAccessLog`) + masking for lower
  roles. Phase 4: access-review view + anomaly alerts. (ADMIN_ROLES.md §8.)

## Admin — performance & scale
- ~~Users tab pagination + `accountStatus` backfill~~ ✅ **Done 2026-06-05**
  (cursor pagination + server-side counts/filters shipped 06-04, but the
  `role`/`accountStatus` composite indexes were defined-but-never-deployed —
  role/suspended filters errored live until indexes were pushed 06-05; backfill
  ran: 12 users scanned, 0 needed changes — data already clean).
- **Bound Overview trends + heatmap to a rolling date window** once job volume
  climbs (currently stream all jobs).
- **Cloud-Function-maintained stats document.** Counters incremented on writes
  (signups, jobs, completions, disputes) so the Overview/analytics load O(1)
  instead of reading collections. The truly scalable long-term move.

## Admin — power-user triage ✅ DONE 2026-06-10
- ✅ Per-user **UserDrawer** (inline approve/reject/suspend/reinstate + worker
  verification approve/+Gold/reject, audit-logged) — opens from global search or
  the Manage button on Users rows.
- ✅ **Global search** (users by name/email/uid + jobs by title/id) in the top bar.
- ✅ **Keyboard shortcuts**: `/` search, `g`+key tab switching.

## Email — Firebase Auth template polish — ✅ DONE 2026-06-05 (Option B)
Firebase locks the built-in templates once a custom email domain is set, so we
replaced them with our own: `requestPasswordReset` / `requestEmailVerification`
callables generate links via the Admin SDK + send branded SendGrid emails, links
rebranded to workitsa.co.za. Fully branded content + link.
- ⚠️ Verify: `workitsa.co.za` should be in Auth → Settings → Authorized domains
  (so the action handler accepts the branded link). Add if missing.
- ⚠️ Test the full reset flow end-to-end before relying on it (high-stakes).

## Monitoring — Sentry (LIVE ✅)
- Error monitoring is wired (`src/lib/sentry.ts`) and the DSN is in `.env.local`,
  baked into production. Verified capturing from `https://workitsa.co.za`.
- Manual follow-up: create an **alert rule** in Sentry (Alerts → "A new issue is
  created" → email) so new errors notify you instead of needing dashboard checks.
- Tidy-up: resolve the old `/sentry-test` issues so real errors stand out.

## iPhone 7 "taps dead" bug — now catchable
- Static review ruled out the usual causes; needs the real device error.
- Action: load `https://workitsa.co.za` on the iPhone 7 → if it crashes, the
  error + iOS/Safari version now lands in Sentry. Paste it and we fix it.

## App stores (PWA → Play Store + App Store) — PAUSED, resume later
The PWA is store-ready (manifest has name, maskable icons, standalone, theme).
Approach: wrap the live site (no rebuild) — web updates appear instantly; only
re-submit the store when the wrapper changes.
- **Android first (recommended):** Google Play Dev account ($25 once) → generate
  Android package via PWABuilder.com (paste workitsa.co.za) or Bubblewrap →
  host `/.well-known/assetlinks.json` (needs the signing-key fingerprint) →
  upload .aab. Gotcha: new *personal* Play accounts need a 20-tester / 14-day
  closed test before production; an *organisation* account (Furthersky) skips it.
- **iOS second:** Apple Dev account ($99/yr) → wrap with Capacitor (best) or
  PWABuilder iOS. Risk: Apple Guideline 4.2 rejects "website in a box" — lean on
  push, offline, live location, SOS, install to show native value.
- **I can prep (no accounts needed):** add `screenshots` + `shortcuts` to the
  manifest, draft Play/App Store listing copy, generate store graphics
  (feature graphic 1024×500 + captioned phone screenshots), and create/deploy
  `assetlinks.json` once the fingerprint exists.

## Email — sender avatar logo (parked, cosmetic)
Gmail shows the sender avatar from sender *identity*, not message content. Two
paid routes only:
- **Google Workspace** (~R80–100/user/mo): make the sending address a Workspace
  account with the logo as its profile photo → Gmail shows it. Bonus: gives a
  real branded inbox (replies currently go to personal Gmail via reply-to).
- **BIMI** (official): needs DMARC enforcement (`p=quarantine`+) + BIMI DNS
  record + SVG logo + a **VMC/CMC cert (~$1,000+/yr)**. Overkill for MVP.
- Free prep available anytime: upgrade DMARC to `p=quarantine`; generate the
  BIMI-spec SVG + record.

## 🔁 Rebooking — phase 3 ideas (phases 1 & 2 shipped 2026-06-19)
- Phases 1 (one-tap "Book again") + 2 (recurring weekly/fortnightly/monthly
  auto-schedule via `scheduledRecurringJobs` + dedicated "invited back" push) are
  built AND deployed — see CHANGELOG 2026-06-19.
- **Dedicated "Repeating jobs" view** — today a schedule lives on (and is managed
  from) its source confirmed job, so it's easy to lose track of. A small list of
  the employer's active schedules (with next-run + stop) is the main UX gap.
- **First-run date / skip-next** — let the employer pick when the first copy goes
  out, and skip an upcoming run (e.g. they're away) without stopping the schedule.
- **Pause vs stop** — currently stopping sets `recurrence.active:false` (can be
  re-enabled by setting it up again); a true pause/resume would be friendlier.

## 🗺️ Location / heat map (density shipped 2026-06-22)
- ✅ Admin heat map now has Jobs / Workers / Employers density layers (from the
  ~1km-rounded `approxLat/approxLng`, admin-only). See CHANGELOG.
- **Deferred — live presence collection (admin-only):** opt-in, collect a user's
  location while the app is foregrounded, shown ONLY on the admin map. Sharper
  real-time density but adds battery/data cost + needs a POPIA consent + retention
  update first. Founder asked about this; held pending that consent work.
- **Do NOT build — public live map of everyone:** exposing users' whereabouts to
  each other is a stalking vector that undercuts the women's-safety toolkit, and a
  POPIA red flag. Recorded so the idea isn't revived without the safeguards.
- On-job safety (the founder's secondary goal) is already covered: per-job live
  location (`WorkerLocationControls`/`LiveLocationView`), SOS GPS capture, and the
  auto-arm trusted-contact share. Could strengthen with an auto-prompt to share
  when a job flips to in_progress — small follow-up if wanted.

## Other
- (add items here as they come up)
