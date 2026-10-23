# Workit Cloud Functions

Serverless functions running on Firebase / Google Cloud:

| File | What it does | Trigger |
|------|--------------|---------|
| `email.ts` | Sends transactional emails via SendGrid | Firestore writes |
| `ratings.ts` | Server-side rating aggregation (replaces client-side) | Firestore writes |
| `moderation.ts` | Auto-deletes unsafe uploads using Vision SafeSearch | Storage uploads |
| `backups.ts` | Weekly Firestore export to a Cloud Storage bucket | Schedule (Sun 02:00 SAST) |

> **Region note:** all functions run in `africa-south1` (set once in
> `globalConfig.ts`) to sit next to our users and the Storage bucket. The one
> exception is `scheduledFirestoreBackup`, pinned to `europe-west1` — Cloud
> Scheduler has no `africa-south1` location. The export it runs still targets
> the `africa-south1` database + bucket, so data never leaves the region.

## One-time setup

### 1. SendGrid (for email notifications)

1. Sign up free at <https://sendgrid.com> — 100 emails/day free
2. **Settings → Sender Authentication** → verify a "Single Sender" (e.g. `noreply@workit.co.za` — you can also use your gmail temporarily)
3. **Settings → API Keys** → create a key with "Mail Send · Full Access"
4. Store both as Cloud Functions secrets:

   ```powershell
   cd "C:\Users\tshep\Projects 26\WorkitEarnit\workit\functions"
   npx firebase functions:secrets:set SENDGRID_API_KEY
   # paste the SG.xxx... key when prompted
   npx firebase functions:secrets:set SENDGRID_FROM_EMAIL
   # paste your verified sender email
   ```

#### ⚠️ Email deliverability — STOP MAIL GOING TO SPAM

The code already sets the things Gmail/Yahoo require (List-Unsubscribe header,
Reply-To, no tracking pixels, postal footer). **But the real fix is DNS — until
you do this, mail will keep landing in spam:**

1. **Authenticate your domain** in SendGrid → **Settings → Sender
   Authentication → Authenticate Your Domain**. SendGrid gives you ~3 CNAME
   records → add them at your domain registrar. This sets up **SPF + DKIM**
   (≈90% of the fix). A single-sender gmail.com address can *never* be
   authenticated — you must own a real domain (e.g. `workit.co.za`).
2. **Add a DMARC record** — a TXT at `_dmarc.<yourdomain>`:
   `v=DMARC1; p=none; rua=mailto:tshepowayne@workitsa.co.za`
3. Make sure `SENDGRID_FROM_EMAIL` uses that authenticated domain.
4. **Firebase Auth emails are separate** (verification + password reset come
   from `noreply@workit-6a927.firebaseapp.com`). In Firebase Console →
   **Authentication → Templates → ✏️ → Customize domain** to send those from
   your authenticated domain too.

### 1b. Sentry (error monitoring — also powers the iPhone-7 diagnosis)

The client SDK is wired (`src/lib/sentry.ts`, initialised in `AuthContext`). It
only needs a DSN. **Because the site is a static export, the DSN is inlined at
BUILD time — you must set it before `npm run build`, then redeploy hosting:**

```powershell
# in workit/.env.local
NEXT_PUBLIC_SENTRY_DSN=https://xxxx@oyyy.ingest.sentry.io/zzzz
```

Get the DSN from sentry.io → your project → Settings → Client Keys (DSN). Once
live, an iOS-15 hydration crash (the suspected "iPhone 7 taps dead" bug) will
appear in Sentry with the exact error + stack.

### 1c. Firestore backups (weekly export)

`scheduledFirestoreBackup` is deployed, but its first run needs a bucket + IAM.
Run these once (the bucket MUST be in `africa-south1` to match Firestore):

```powershell
gcloud storage buckets create gs://workit-6a927-backups --project workit-6a927 --location africa-south1
gcloud projects add-iam-policy-binding workit-6a927 --member "serviceAccount:workit-6a927@appspot.gserviceaccount.com" --role "roles/datastore.importExportAdmin"
# 90-day retention so old snapshots auto-delete:
gcloud storage buckets update gs://workit-6a927-backups --add-lifecycle-rule="type=Delete,age=90"
```

Restore when needed: `gcloud firestore import gs://workit-6a927-backups/<timestamp>`

### 2. Vision API (for image moderation)

Enable it once per project:

```powershell
gcloud services enable vision.googleapis.com --project workit-6a927
```

…or in console: <https://console.cloud.google.com/apis/library/vision.googleapis.com?project=workit-6a927> → **Enable**.

### 3. Install + deploy

```powershell
cd "C:\Users\tshep\Projects 26\WorkitEarnit\workit\functions"
npm install
npm run build
cd ..
npx firebase deploy --only functions
```

That's it.

## Cost expectations (pilot scale)

| Function | Free tier (per month) | Beyond that |
|---|---|---|
| Functions invocations | 2M | $0.40 per 1M |
| Outbound bandwidth | 5 GB | $0.12 / GB |
| SendGrid | 100 emails/day | $19.95/mo for 50k |
| Vision SafeSearch | 1,000/mo free | $1.50 per 1,000 |

At pilot scale (1000s of jobs/month) you'll stay deep inside the free tiers.

## Local development

To run the functions locally before deploying, install the Firebase emulator:

```powershell
npm install -g firebase-tools
firebase emulators:start --only functions,firestore
```

## What goes where

- **Email events:**
  - New offer → email employer
  - Offer accepted → email worker
  - Job confirmed → email both for ratings

- **Rating aggregation:**
  - When `employerRating` is added → bumps the worker's `ratingAvg` / `ratingCount`
  - When `workerRating` is added → bumps the employer's

- **Moderation:**
  - Any image upload to `/avatars`, `/verification`, `/jobs`
  - SafeSearch flags adult/violence/racy → file deleted + entry in `/moderationLog`
