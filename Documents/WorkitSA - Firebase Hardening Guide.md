# WorkitSA — Firebase Hardening (step-by-step for a non-developer)

Project: **workit-6a927**. The code for items 1 & 2 is already written, built and
**deployed**. Items 1, 3 and 4 need you to click a few things in the console —
every step is spelled out below. Nothing here can block real users until *you*
flip enforcement on (item 1), and I've set it up so you test first.

> Console = **https://console.firebase.google.com/project/workit-6a927**

---

## 1. App Check (reCAPTCHA Enterprise) — abuse protection

**What it does:** proves a request really came from our app, not a bot or a
stolen API key. We roll it out in **monitor-only** mode first so nobody is blocked,
watch the numbers for a few days, then enforce.

### 1a. Register the site key (console)
1. Console → left menu → **Build → App Check**.
2. Open the **Apps** tab → click your **Web app** (workitsa.co.za).
3. Choose **reCAPTCHA Enterprise** as the provider → **Save**.
   - If it asks you to create a reCAPTCHA Enterprise key, say yes (it opens Google
     Cloud, creates a key for your site, and links it back). Allow the
     reCAPTCHA Enterprise API to be enabled if prompted.
4. It will show a **site key** that starts with `6L…`. **Copy it** and send it to me.

### 1b. I turn it on in the app
- I paste the key into `.env.local` as `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY`,
  rebuild and redeploy. (It's a public key — safe.) Until then the app runs
  exactly as before — App Check is dormant, so this is zero-risk.

### 1c. Debug token for your own computer (localhost)
- Already handled in code: on localhost the app auto-enables an App Check **debug
  token** and prints it to the browser console (F12 → Console) the first time you
  load `npm run dev` after the key is set. Copy that token → Console → **App Check →
  Apps → (your app) → ⋮ → Manage debug tokens → Add** → paste. That lets your PC
  keep working once enforcement is on.

### 1d. Monitor-only first, then check metrics
- **Do NOT click "Enforce" yet.** When you register a product below it starts in
  monitor mode automatically (enforcement OFF = monitoring).
- After ~2–3 days: Console → **App Check** → click **Firestore** (then Storage,
  Functions, Authentication). Each shows a graph of **verified vs unverified**
  requests. You want the overwhelming majority **verified** before enforcing.

### 1e. Enforce (only after the metrics look clean)
- For each of **Cloud Firestore**, **Cloud Storage**, **Cloud Functions**,
  **Authentication**: Console → App Check → click the product → **Enforce** →
  confirm. Do them one at a time and watch for errors for a few minutes after each.
- If anything breaks, click **Unenforce** on that product — it's instant and
  reversible.

---

## 2. Performance Monitoring — already live ✅

The code is deployed. It collects **automatic** traces (page load + network) plus
three **custom traces** I added:
- **`post_job`** — time to create a job
- **`load_jobs_list`** — time for the find-work feed to appear
- **`upload_verification_doc`** — time to upload an ID / proof document

**Where to see it:** Console → **Release & Monitor → Performance**. Data starts
appearing **~12–24 hours** after real visits (it's gated on cookie consent for
POPIA, so it counts users who accepted the cookie banner). Nothing to toggle.

---

## 3. Restrict Phone-Auth SMS to South Africa only

Stops someone draining your SMS budget by requesting codes to foreign numbers
("SMS pumping").

1. Console → **Build → Authentication → Settings** tab.
2. Find **SMS region policy** (sometimes under "SMS" / "Regions").
3. Choose **Allow** (allowlist) → from the country list **add only South Africa
   (+27 / ZA)**.
4. Leave every other country **unticked** → **Save**.
   (The alternative "Deny" list is a blocklist — don't use that; the allowlist with
   just ZA is tighter.)

Result: codes only ever go to +27 numbers.

---

## 4. Firestore point-in-time recovery (PITR) + daily backups

### 4a. Point-in-time recovery (7 days of continuous history)
1. Console → **Build → Firestore Database**.
2. Top tabs → **Backups** (or the **⚙ / database settings**).
3. Find **Point-in-time recovery** → **Enable**. (Gives you 7 days of
   continuous recovery automatically.)

### 4b. Daily scheduled backups, 7-day retention
1. Same **Backups** screen → **Create backup schedule** (or **Add schedule**).
2. Frequency: **Daily**.
3. Retention: **7 days**.
4. **Save**.

> Note: these are paid features (small cost, scales with data size) and need the
> Blaze plan — which this project is already on. You can confirm later spend under
> Console → ⚙ → Usage and billing.

---

## ✅ Confirmation checklist

Run these to confirm everything's working:

- [ ] **(2) Performance:** Console → Performance shows a dashboard (data within ~24h);
      after posting a job / loading find-work / uploading a doc, the custom traces
      `post_job`, `load_jobs_list`, `upload_verification_doc` appear.
- [ ] **(3) SMS region:** Authentication → Settings shows SMS allowlist = **South
      Africa only**. (Optional test: a +27 phone signup still receives its code.)
- [ ] **(4) Backups:** Firestore → Backups shows **PITR = Enabled** and a **Daily /
      7-day** schedule listed.
- [ ] **(1) App Check — after you send me the site key & I redeploy:**
  - [ ] Console → App Check shows your web app with **reCAPTCHA Enterprise** registered.
  - [ ] Each product (Firestore/Storage/Functions/Auth) shows a verified-requests
        graph filling in over 2–3 days.
  - [ ] Your localhost debug token is registered (so your PC still works).
  - [ ] Once verified-request share is high, **Enforce** each product one by one.

---

### What I still need from you
1. **The App Check site key** (step 1a) → I'll wire it in and redeploy.
2. Then **you** do the console clicks for items 3 and 4 (I can't click the console
   for you), and the App Check **Enforce** toggles after the monitor period.
