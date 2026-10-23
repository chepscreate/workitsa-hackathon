# Workit — Admin Guide

_For Workit administrators. Last updated: 2026-06-11._

Welcome to the admin side of Workit. Everything here happens at
**https://workitsa.co.za/admin** — sign in with your `@workitsa.co.za`
account. Only accounts with the admin role can open this page.

> **First things first:** change your password the first time you sign in,
> and never share your admin credentials with anyone — an admin account can
> see ID documents and delete accounts.

> **Two-step verification is required for admins.** The first time you open
> `/admin` you'll be asked to link an authenticator app (Google
> Authenticator, Authy — about two minutes, under Account → Security). After
> that, sign-in asks for a 6-digit code from the app on top of your
> password. **Save the setup key it shows you somewhere safe** — it's your
> backup if you lose your phone. Lost both? The other admin resets your
> second factor from the Firebase console.

---

## The golden rules

1. **Every action is recorded.** Approvals, rejections, verifications,
   dispute decisions — all land in the Audit log with your name. That's a
   feature, not a threat: it protects you when a user disputes a decision.
2. **Always write a note.** Rejections, suspensions and dispute resolutions
   ask for a note — the user often sees it, and future-you will need it.
3. **Erasure is forever.** The red "Deletion requests" panel permanently
   wipes a user's documents, profile and sign-in. There is no undo. Read
   `DELETION_RUNBOOK.md` before actioning one.
4. **When unsure, don't decide.** Leave it in the queue and raise it in our
   work discussion. A slow correct answer beats a fast wrong one.

---

## Finding your way around

The sidebar has the sections; these are the ones you'll live in:

| Tab | What it's for |
|-----|---------------|
| **Overview** | Live dashboard: KPIs, what's happening right now, smart insights, anything needing attention. Start your session here. |
| **Approvals** | New accounts waiting to be let in. Every new signup is `pending` until an admin approves. |
| **Verification** | Workers' ID + selfie + address + skill documents. Approve, approve with Gold, or reject with a note. |
| **Business** | Businesses that submitted CIPC registration proof for the verified-business badge. |
| **Disputes** | Frozen jobs where one side raised a problem. You are the referee. |
| **Moderation** | Reported users/jobs and automatic flags (text screen, image screen). |
| **Support** | WhatsApp messages from the public. Reply right here — but only within **24 hours** of their last message (WhatsApp's rule); after that, email them instead. A green badge shows unread threads. |
| **Users** | Everyone, searchable and filterable. The red **Deletion requests** panel lives here. |
| **Jarvis** | The AI assistant — ask it questions about the platform; it can prepare actions for your confirmation. |
| **Analytics / Heatmap / Audit** | Numbers, a map of job activity, and the full action history. |

**Speed tricks:** press `/` to jump to the global search (find any user or
job from anywhere). Press `g` then a letter to switch tabs — `g a`
approvals, `g v` verification, `g d` disputes, `g s` support, `g u` users,
`g o` overview.
On any user row, **Manage** opens their full command centre (profile, docs,
history, actions) without leaving the page.

---

## Daily routine (15–20 minutes)

1. **Overview tab.** Look at the red/amber "Attention" cards. An emergency
   banner at the top outranks everything — that means someone pressed the
   in-app SOS button; open the job and check the situation immediately.
2. **Approvals.** Real person? Name and details coherent? Approve. Obvious
   spam/duplicate? Reject with a short note.
3. **Verification.** Open each worker's documents (links are short-lived
   signed URLs — that's deliberate):
   - ID document legible, details match the profile, selfie video matches
     the ID photo.
   - Proof of address present and plausible.
   - Skill proof matches the categories they chose.
   - All good → **Approve**. Police clearance also uploaded and legitimate →
     **Approve + Gold** (the gold badge means *background verified* — never
     award it without a police clearance).
   - Something missing/unclear → **Reject with a note** saying exactly what
     to fix. Workers can resubmit; resubmissions show in their own filter.
4. **Disputes.** Read both sides and the job's message history. Your options:
   - *Force completed* — work was done; worker deserves confirmation.
   - *Cancelled, no fault* — genuine misunderstanding, nobody punished.
   - *Cancelled with warning* — someone behaved badly; warning on record.
   - *Dismissed* — dispute without merit; job returns to its previous state.
   A note of at least a few words is required — both parties can see your
   decision.
5. **Moderation.** Review reports and auto-flags. Anything involving a child
   or credible threat of harm: act immediately (remove + suspend) and flag
   it in our work discussion the same day.

---

## Jarvis

Jarvis is the admin AI assistant (also messages on WhatsApp, and sends a
morning digest at 07:00). You can ask it things like "how many signups this
week?" or have it draft an action — **it always asks for confirmation
before doing anything real**, and its actions are audit-logged like yours.
If Jarvis stops replying, tell Tshepo (it has its own billing).

## What admins must never do

- Approve a worker verification without opening the actual documents.
- Award the Gold badge without a police clearance certificate.
- Action a deletion request casually — follow `DELETION_RUNBOOK.md`.
- Share screenshots of ID documents or personal data with anyone, on any
  channel. POPIA applies to us first.
- Use admin access to look up people you know out of curiosity. Audit log,
  remember.

## Getting help

- Owner: **Tshepo M** — tshepowayne@workitsa.co.za
- Technical reference docs in the project: `DELETION_RUNBOOK.md`,
  `SECURITY_AUDIT.md`, `LAUNCH_READINESS.md`.
