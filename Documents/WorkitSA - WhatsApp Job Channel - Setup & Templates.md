# WorkitSA — WhatsApp Job Channel: Setup, Templates & Test Checklist

**Feature:** low-data job alerts over WhatsApp. Workers get a message when a
matching job is posted and reply `1` to send an offer, `START` / `DONE` to update
status, `STOP` to opt out. Built for the FNB hackathon "youth employment" challenge.

## ⚠️ Architecture (changed 2026-10-19)
We discovered the Meta app whose webhook we were about to configure is the **same
app already running Jarvis + the "Chat to support" button**. Meta allows only
**one** webhook callback URL per number, so standing up a second webhook would
have broken Jarvis. Instead:

- The Job Channel's inbound handling now runs **inside the existing `jarvisWhatsApp`
  webhook** — a known opted-in worker's job keyword (`1`/`ACCEPT`/`START`/`DONE`/
  `STOP`) is handled first; everything else falls through to support exactly as
  before. **No Meta webhook change is needed.**
- Job alerts go out from your **production WhatsApp number** (one consistent number
  per worker; no test-recipient cap).

**What's already done:** functions deployed; the standalone webhook was deleted.
The 3 `WHATSAPP_JOB_*` secrets you set earlier are now **unused** (the code reuses
Jarvis's `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID`) — harmless to leave; delete
them later if you like.

**What's left for you:** just **approve the `job_alert` template** (Step 1 below),
then test (Step 2). That's it.

---

## Step 1 — Create & submit the `job_alert` template

Meta → **WhatsApp → Templates → Create template**. Category **Utility**, language
**English** (plain `en`). Approval is usually minutes to a few hours.

### Template: `job_alert`  *(this is the one the code sends automatically)*
**Body:**
```
🛠️ New job near you on Workit: *{{1}}* in {{2}} — pay {{3}}.
Reply *1* to send an offer, or *STOP* to opt out.
```
**Sample values:** `{{1}}` = Garden clean-up · `{{2}}` = Soweto · `{{3}}` = R350

> If Meta creates it as **English (US) / `en_US`** instead of plain `en`, tell me
> and I'll flip one line in the code (`TEMPLATE_LANG`) and redeploy.

### Optional extras (nice-to-have, not required for the demo)
Create these two the same way if you want to re-message workers **outside** the
24-hour window later (the code doesn't send them yet):

**`offer_accepted`:**
```
🎉 Good news! The employer accepted your offer for *{{1}}* in {{2}}. Agreed pay: {{3}}.
Reply *START* when you're on site, and *DONE* when the job is finished.
```
**`job_reminder`:**
```
⏰ Reminder: your Workit job *{{1}}* in {{2}} is scheduled {{3}}.
Reply *START* when you arrive or *DONE* when it's complete.
```

---

## Works before approval — the free-text fallback + `JOBS` pull (added 2026-10-20)
- If a worker has **texted the number in the last 24h**, job alerts arrive as
  **plain text with full detail** — no template needed. So for the live demo,
  have the worker text the number once (e.g. `hi` or `JOBS`) and everything works
  even while `job_alert` is still "in review".
- A worker can text **`JOBS`** (or `WORK`) any time to get a numbered list of the
  top 5 open jobs near them, then reply with the **number** to send an offer.
- Only *cold* sends (worker hasn't messaged in 24h) need the approved template.

## Worker WhatsApp commands (reference)
| Text | Does |
|---|---|
| `JOBS` / `WORK` | List open jobs near you (numbered) |
| `1` … `5` | Send an offer on that listed job |
| `1 400` | Offer **R400** on job 1 (counter-offer) |
| `OFFER 400` | Counter-offer R400 on the last job shown |
| `START` | Mark your assigned job started (prompts a safety location share) |
| `DONE` | Mark your job done |
| `AVAILABLE` | Flag yourself available-now (ranks higher, +8h) |
| `SOS` / `HELP ME` | Raise an emergency → alerts the safety team; reply tells you to call SAPS 10111 |
| `REPORT <what happened>` | File a report for the admin team |
| *(share location)* | Saved as a safety check-in on your active job |
| `STOP` | Opt out of WhatsApp job alerts |

## Step 2 — Test checklist

Opt-in / consent
- [ ] Sign in as a **worker**, open **Account** → *WhatsApp job alerts* card shows.
- [ ] Toggle on → enter `067 748 2643` → tick consent → **Turn on**. Card shows "● On".
- [ ] Firestore `users/{uid}` now has `whatsappJobOptIn: true`, `whatsappNumber: "27677482643"`, `whatsappConsentAt`.

Outbound alert
- [ ] Post a job in that worker's category + area (within 25 km / same city).
- [ ] Within ~1 min the worker's WhatsApp receives the `job_alert` message from your
      production number. *(Held first-posts wait ~45 s for the moderation settle.)*
- [ ] `waJobThreads/27677482643` has `lastJobId` = that job.

Inbound replies (these share the Jarvis number — support still works for everyone else)
- [ ] Text **`JOBS`** → bot replies with a numbered list of open jobs near you.
- [ ] Reply **`2`** (or any listed number) → offer sent on that listed job.
- [ ] With the worker's session open (they just texted), post a new matching job →
      the alert arrives as **plain text with full detail** (not a template).
- [ ] Reply **`1`** → bot confirms "Offer sent"; a `pending` offer with
      `source: "whatsapp"` appears under `jobs/{jobId}/offers`; the **employer**
      gets the normal push/email.
- [ ] Reply **`1`** again → "already sent an offer" (no duplicate).
- [ ] Employer accepts the offer in-app → worker is assigned.
- [ ] Reply **`START`** → job flips to `in_progress`; bot confirms.
- [ ] Reply **`DONE`** → job flips to `completed`; bot confirms.
- [ ] Reply **`STOP`** → `whatsappJobOptIn` goes false; bot confirms opt-out.
- [ ] From a **non-worker** number, send a normal support question → it still reaches
      **support** (the job branch only catches workers' keywords). Jarvis owner path
      also unaffected.

Privacy
- [ ] Confirm no message contains an ID number, exact street address, or a
      customer's phone number — only title, category, suburb/city, budget.

---

## Reference (unchanged)
| Setting | Value |
|---|---|
| Meta App ID | `1394440649400767` |
| WhatsApp Business Account ID | `1506107717177486` |
| Webhook (already live) | `jarvisWhatsApp` — no change needed |
| Firebase project | `workit-6a927` (functions in `africa-south1`) |

## After the hackathon
- `demo/cleanup_demo.py` removes the placeholder jobs/workers; opt-in fields on real
  workers are harmless to leave (off unless they opted in).
- Optionally delete the unused `WHATSAPP_JOB_TOKEN` / `WHATSAPP_JOB_APP_SECRET` /
  `WHATSAPP_JOB_VERIFY_TOKEN` secrets.
