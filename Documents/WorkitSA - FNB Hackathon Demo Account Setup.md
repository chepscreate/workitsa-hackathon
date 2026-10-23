# WorkitSA — FNB Hackathon 2026: Demo Account & Data Setup (Part 4)

The brief requires **a demo account for judges to use**. This gives judges a
pre-verified login that skips the verification gate, a populated Alberton
marketplace so nothing looks empty, and a WhatsApp worker so the live WhatsApp
demo + video work. Everything is tagged `demoSeed:true` and removed afterwards
with `demo/cleanup_demo.py`.

> ⚠ **Do this during / just before the build weekend (23–25 Oct), not now.** The
> seed data should be fresh for judging, and the judge login should be working
> when you paste it onto deck slide 6.

---

## The two demo identities

| | Judge login (browse the app) | WhatsApp demo worker |
|---|---|---|
| **Purpose** | Judges log in and click around | Texts `JOBS` in the live demo + video |
| **Login** | email + password | WhatsApp only (no app login) |
| **How created** | **You** sign up on the site; **I** promote it | **I** seed it directly in Firestore |
| **Number** | — | **+27 67 748 2643** |

---

## Step 1 — You create the judge login (I can't set passwords on the live site)

1. Go to **https://workitsa.co.za/signup** on any device.
2. Sign up with **email + password**. Recommended throwaway demo values:
   - **Email:** `tshepowayne2+judge@gmail.com` (a +alias of your Gmail — verification mail still reaches you)
   - **Password:** `WorkitDemo2026` *(a demo-only account — no real personal data)*
   - **Role:** Worker
3. Finish signup (verify the email if prompted). **Stop there** — do **not** try to
   complete ID verification. Leave it pending; I'll flip it to approved.
4. Get the account's **UID**: open **workitsa.co.za/admin → Users**, find
   `tshepowayne2+judge@gmail.com`, copy its UID (or read it from the Firebase
   Auth console). Send me the UID.

> Why a Worker account: the hero feature (the WhatsApp channel) and the "find work
> → offer → done → rated" loop are worker-side, so that's the most impressive thing
> for a judge to see. Seeded employer jobs (Step 3) give them plenty to look at.

## Step 2 — I promote it + seed the WhatsApp worker

Once you send me the UID (and you've run `gcloud auth login` as
`tshepowayne2@gmail.com`), I run:

```bash
python demo/setup_judge_account.py --uid <JUDGE_UID>
```

This (script already written at `demo/setup_judge_account.py`):
- sets the judge account to **approved + ID-verified worker**, Alberton/Gauteng,
  with `verification.submittedAt` set so it never bounces to the "complete your
  submission" screen;
- seeds a **Firestore-only verified worker** on **+27 67 748 2643**, opted in to
  WhatsApp alerts, in Alberton — so texting `JOBS` from that phone matches jobs
  and the whole channel demos end-to-end. No signup needed for this one.

## Step 3 — Populate the marketplace (so it's never empty)

Run the existing seed (Alberton employers, workers, open jobs + offers — all
"normal candidates", no BluLever framing, all `demoSeed:true`):

```bash
python demo/seed_demo.py
```

Judges logging in as the worker will then see real nearby jobs to browse and offer on.

---

## Step 4 — Pre-submission smoke test (5 minutes)

- [ ] Log in at workitsa.co.za as `tshepowayne2+judge@gmail.com` / `WorkitDemo2026`
      → lands on the app, **not** the verification gate.
- [ ] `/find-work` shows seeded Alberton jobs.
- [ ] Open a job → "Make an offer" works.
- [ ] Account page shows the **WhatsApp alerts** toggle (your weekend feature).
- [ ] Text `JOBS` to the WhatsApp line **+27 67 748 2643** → get a job list;
      reply `ACCEPT 1` → "Offer sent ✓" (confirms the live channel).
- [ ] The admin Live Pulse shows the seeded activity (good for a screenshot).

---

## Step 5 — Put it on the deck + video

Paste onto **deck slide 6** (and the login into your runbook):

```
Live app:     https://workitsa.co.za
Judge login:  tshepowayne2+judge@gmail.com  /  WorkitDemo2026
WhatsApp:     save +27 67 748 2643 and send JOBS
Demo video:   <paste the <=90s video link>
```

---

## Step 6 — Cleanup (after judging)

```bash
python demo/cleanup_demo.py
```

Removes every `demoSeed:true` doc — the judge account, the WhatsApp worker, and
all seeded jobs/offers/employers/workers. (Run it after judging closes, not before.)

---

### Notes
- **WhatsApp number:** the demo uses **+27 67 748 2643**. The founder's personal
  number (081…) is kept private and never shown to judges or in any materials.
- The judge account is **not** an admin account (admin logins are blocked by
  enforced TOTP MFA). A regular approved worker is exactly what judges need.
- No real ID documents are uploaded for the demo — `idCheckVerdict:"pass"` is set
  so the account reads as verified without any personal data in Storage.
- If you'd also like an **employer** login so judges can post a job and watch an
  offer arrive, tell me and I'll add a second promotion (same pattern, role
  `employer`).
