# Workit — Ops Quick Reference

_Everything you need to check on, run, or monitor Workit. Last updated 2026-06-13._

**Firebase project:** `workit-6a927` (it's the default, so commands need no `--project`).
**Regions:** app functions in `africa-south1`; the two scheduled jobs in `europe-west1`.

> **Paths.** The app lives in `C:\Users\tshep\Projects 26\WorkitEarnit\workit`.
> Cloud Functions live in `…\workit\functions`. Run the commands below from the
> **`workit`** folder unless it says otherwise.
>
> PowerShell: `cd "C:\Users\tshep\Projects 26\WorkitEarnit\workit"`

---

## 1. Live links

| What | URL |
|------|-----|
| **Live site** | https://workitsa.co.za |
| Firebase fallback URL | https://workit-6a927.web.app |
| Admin panel | https://workitsa.co.za/admin |
| Help / support page | https://workitsa.co.za/help |
| Privacy policy | https://workitsa.co.za/privacy |

## 2. Consoles & dashboards (where you "keep check")

| Service | Link | What you check there |
|---------|------|----------------------|
| **Firebase Console** | https://console.firebase.google.com/project/workit-6a927 | Firestore data, Auth users, Storage, Functions, Hosting |
| Firestore data | …/firestore | Browse users, jobs, supportMessages, stats |
| Auth users | …/authentication/users | Accounts, enable MFA, reset second factors |
| Functions | …/functions | Deployed functions + their logs/health |
| Hosting | …/hosting | Deploy history, rollback |
| **Analytics (GA4)** | Firebase Console → Analytics, or https://analytics.google.com | Funnel: sign_up → profile → job_posted → confirmed. Measurement ID `G-NTS42MK3ZN`. DebugView shows events instantly; reports lag ~24h |
| **Sentry** | https://sentry.io | App errors/crashes (DSN baked into prod) |
| **Google Cloud Console** | https://console.cloud.google.com/home/dashboard?project=workit-6a927 | Cloud Functions logs, Cloud Scheduler, billing |
| Cloud Scheduler | https://console.cloud.google.com/cloudscheduler?project=workit-6a927 | The weekly backup + monthly retention jobs |
| **Gemini / AI Studio** (Jarvis) | https://aistudio.google.com | The Gemini key + billing that powers Jarvis |
| **Meta / WhatsApp Cloud API** | https://business.facebook.com | The support + Jarvis WhatsApp number, token, templates |
| **SendGrid** | https://app.sendgrid.com | Branded auth emails (verify, password reset) delivery |

## 3. Business / founder portals (not the app, but related)

| Service | Link | For |
|---------|------|-----|
| CIPC BizPortal | https://www.bizportal.gov.za | Company status, **annual returns** (⚠ overdue) |
| CIPC eServices | https://eservices.cipc.co.za | Beneficial ownership, name changes |
| SARS eFiling | https://www.sarsefiling.co.za | Tax compliance PIN |
| SEDFA portal | https://sefa.finfind.co.za | Funding application |
| NYDA | https://www.nyda.gov.za | Youth grant + free BMT training |

---

## 4. Terminal commands

All from the **`workit`** folder. `npx firebase …` works without a global install;
if you've installed it globally you can drop the `npx`.

### Run / develop
```powershell
npm run dev            # local dev server → http://localhost:3000
```
**Dev-server gotcha (Turbopack / Next 16):** adding **and then deleting** an
App-Router route folder (e.g. a throwaway `src/app/somelab/` verification page)
while `npm run dev` is running corrupts the on-disk `.next` cache — Turbopack
keeps panicking with `Failed to write app endpoint /somelab/page … no longer
exists` on every HMR/compile, which wedges the server (routes hang / load the
home page / eval timeouts) and the panic **persists across restarts** because it
lives in `.next`. Fix: stop the server, clear the cache, restart:
```powershell
Remove-Item -Recurse -Force .next   # from the workit/ dir, server stopped first
```
Avoid it by **not creating/deleting route folders under a live dev server** —
restart after, or verify gated UI with `npm run build` instead. Also note first
compile of any route is slow here (~8–17 s: heavy deps + Turbopack on Windows),
so a freshly-opened route needs a few seconds before it renders.

### Check before you ship (run these after any code change)
```powershell
npx tsc --noEmit       # TypeScript — must be clean
npm run lint           # ESLint
npm run build          # full production build (static export → out/)
```

### Security-rules tests (run before ANY change to firestore.rules)
```powershell
npm run test:rules     # boots the Firestore emulator, runs the suite, shuts down (needs Java)
```
If it says **"Port 8080 … taken"**, a stray emulator is stuck — free it:
```powershell
Get-NetTCPConnection -LocalPort 8080 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

### Deploy (to production — workit-6a927)
```powershell
npx firebase deploy --only hosting                 # the website (most common)
npx firebase deploy --only functions               # all Cloud Functions
npx firebase deploy --only functions:NAME          # one function, e.g. replyToSupport
npx firebase deploy --only firestore:rules         # security rules
npx firebase deploy --only firestore:indexes       # database indexes
npx firebase deploy                                 # everything
```
> Hosting deploys serve the contents of `out/`, so **`npm run build` first**.
> Function deploys build themselves (the predeploy hook compiles TypeScript).
>
> ⚠️ **If a function deploy fails with "Cannot determine backend specification.
> Timeout after 10000":** the compiled bundle cold-loads slowly on this machine
> (~28s — heavy native deps + Windows file scanning), past the CLI's 10s
> discovery budget. GCP's runtime is unaffected. Prefix the deploy with a longer
> budget:
> ```powershell
> $env:FUNCTIONS_DISCOVERY_TIMEOUT='180'; npx firebase deploy --only functions:NAME
> ```

### Functions — health & logs
```powershell
npx firebase functions:list                        # what's deployed + region
npx firebase functions:log                         # recent logs (all functions)
npx firebase functions:log --only scheduledRetentionCleanup   # one function
```
Key functions worth watching: `onJobVisibleAlertWorkers` (job alerts),
`replyToSupport` (WhatsApp replies), `scheduledRetentionCleanup` (monthly purge),
`scheduledFirestoreBackup` (weekly backup), `jarvisWhatsApp` (support + Jarvis).

### Google Cloud auth (only if a gcloud command asks)
```powershell
gcloud auth list                                   # who you're signed in as
gcloud auth login                                  # re-auth if expired
```

---

## 5. Quick health checks ("is everything OK?")

```powershell
# Is the live site up? (200 = healthy)
(Invoke-WebRequest https://workitsa.co.za -UseBasicParsing).StatusCode

# Are all functions deployed and in the right region?
npx firebase functions:list

# Any errors in the last while? (or check Sentry)
npx firebase functions:log | Select-Object -First 40
```
- **Live numbers:** open `/admin` → Overview (signups, jobs, GMV, what's happening now).
- **Funnel / drop-off:** GA4 (Firebase Console → Analytics).
- **Crashes:** Sentry.
- **Backups:** Cloud Scheduler → `scheduledFirestoreBackup` (Sundays 02:00 SAST);
  snapshots in the `workit-6a927-backups` bucket.

---

## 5b. Automated B2B outreach (deployed 2026-07-06; twice-daily 2026-07-08)

Weekdays **08:30 + 13:30 SAST**, up to `batchCap` (15) **pending** docs from
`marketingLeads` per run, never more than `dailyCap` (30) per day across all
runs incl. the admin button — from workitsa.co.za (SendGrid), replies + BCC
copies to your Gmail, POPIA opt-out link per email, per-run summary to you.

- **Turn ON:** Firestore console → create doc `marketing/config` with
  `enabled: true` (optional: `dailyCap: 15`, `replyTo: "tshepowayne2@gmail.com"`,
  `fromEmail: "tshepo@workitsa.co.za"` — outreach-only sender, auto-falls back
  to noreply@ if SendGrid rejects it; `subject`, `bodyHtml`, `bodyText` —
  `{businessName}`/`{contactName}` placeholders).
- **Pause instantly:** set `enabled: false` (or delete the doc).
- **Queue leads** (this import is the approval step for who gets emailed):
  ```powershell
  cd "C:\Users\tshep\Projects 26\WorkitEarnit\workit"
  node functions/scripts/import-leads.mjs marketing/outreach/leads-YYYY-MM-DD.json
  ```
  The marketer agent stages those JSON files; duplicates/opt-outs are never re-queued.
- **Opt-out endpoint:** https://africa-south1-workit-6a927.cloudfunctions.net/marketingOptOut
- **Run NOW (don't wait for the schedule):** easiest — **/admin → Growth tab →
  Marketing automation card** → "Send next batch now" / "Post next queued now"
  (admin + 2FA; shows queue counts + result). Alternative:
  [Cloud Scheduler](https://console.cloud.google.com/cloudscheduler?project=workit-6a927)
  → row `firebase-schedule-scheduledMarketingOutreach-europe-west1` → ⋮ → **Force run**
  (emails the next ≤ dailyCap pending leads immediately; the normal 08:30 run
  still happens and takes the next batch). Same trick for the Facebook post:
  `firebase-schedule-scheduledFacebookPost-europe-west1` → Force run.
  Terminal equivalent:
  ```powershell
  gcloud scheduler jobs run firebase-schedule-scheduledMarketingOutreach-europe-west1 --location=europe-west1 --project=workit-6a927
  gcloud scheduler jobs run firebase-schedule-scheduledFacebookPost-europe-west1 --location=europe-west1 --project=workit-6a927
  ```

## 5c. Automated Facebook posting (deployed 2026-07-06; twice-daily 2026-07-08)

**Two slots daily** to the **Workitsa** Facebook Page (token = `META_PAGE_TOKEN`
/ `META_PAGE_ID` secrets, founder-created):
- **08:00 SAST — video clips** (`scheduledFacebookPostMorning`; queue entries
  staged with `"videoPath": "….mp4"`)
- **17:30 SAST — images** (`scheduledFacebookPost`; entries with `"imagePath"`)

Each slot posts its **oldest queued** doc in `marketingPosts`. **Staging a post
is the approval step — it defaults ON but posts nothing until you queue
content.** Empty-slot nudges email once per slot.

- **Queue posts:**
  ```powershell
  cd "C:\Users\tshep\Projects 26\WorkitEarnit\workit"
  node functions/scripts/import-posts.mjs marketing/queue/fb-week1.json
  ```
  (marketer agent stages the JSON batches; images upload to Storage
  `marketing/posts/`, published oldest-first, one per day)
- **Pause:** Firestore `marketing/config` → `fbEnabled: false`.
- **Failure/empty-queue alerts** email the founder automatically (one-time
  empty-queue nudge, resets after the next successful post).
- **Token dies?** (rare — Page tokens don't expire, but a password change /
  security event revokes them): regenerate via Graph Explorer → `me/accounts`,
  `npx firebase functions:secrets:set META_PAGE_TOKEN`, redeploy
  `scheduledFacebookPost`. The poster emails you if its token check fails.

---

## 6. Project docs (in the repo root)

| File | What it is |
|------|------------|
| `CHANGELOG.md` | Everything that's been built/changed, newest first |
| `BACKLOG.md` | Deferred / not-yet-done items |
| `LAUNCH_READINESS.md` | Legal/compliance go/no-go checklist |
| `ADMIN_GUIDE.md` | How to run the admin panel (for Simphiwe) |
| `FUNDING_OPPORTUNITIES.md` | 13 funds/grants ranked |
| `STORE_LISTING.md` | Play/App Store listing pack |
| `DELETION_RUNBOOK.md` | How to action a POPIA erasure |
| `SECURITY_AUDIT.md` | Security findings + status |
| `Workit - Business Plan.docx` / `Workit - 12-Month Cash Flow.xlsx` | Funding pack |
```
