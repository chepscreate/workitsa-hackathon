# WorkitSA — FNB Hackathon 2026: Final Submission Pack (Part 6)

**Deadline: Monday 26 Oct, 23:59** — upload on Sonke ("Submit Files" on the
Dashboard or your team page). **You must have profiled/created your team first**
(even solo) or you can't be judged.

---

## ✅ Submission checklist (what to upload)

| # | Item | Status / where it lives |
|---|------|--------------------------|
| 1 | **Slide deck (PDF), ≤10 slides** incl. features, screenshots, demo details, security, user journey, architecture | `Documents/WorkitSA - FNB Hackathon Deck.pptx` → export to PDF |
| 2 | **Demo video link on a slide** (video ≤90s) | On deck slides 6 & 10 — paste the link before exporting |
| 3 | **Demo video (≤90s)** uploaded to YouTube (unlisted) / Drive | Script: `WorkitSA - FNB Hackathon Demo Video Script.md` |
| 4 | **SSDLC form** filled in on Sonke | Content below — copy/paste |
| 5 | **Lean Business Canvas** filled in on Sonke | Content below — copy/paste |

### Final pre-upload check (5 min)
- [ ] Team is **profiled** on Sonke (solo is fine).
- [ ] Deck is **≤10 slides**; demo-video link is **on a slide** and opens in incognito.
- [ ] Video is **under 90 seconds** and set to "anyone with the link".
- [ ] Judge demo login works (Part 4) and is written on slide 6.
- [ ] Live traction numbers on slide 10 are confirmed (not placeholders).
- [ ] Deck exported to **PDF** (brief prefers PDF). Keep the .pptx as backup.
- [ ] SSDLC + Lean Canvas submitted.
- [ ] Hit **Submit Files** before 23:59 Mon 26 Oct — don't leave it to the last minute.

### How to export the deck to PDF
Open the .pptx in PowerPoint → **File → Save As / Export → PDF**. (A PDF won't
*play* the video — that's fine; what's required is the **link** being on a slide,
which it is.)

---

## 3. SSDLC — Secure Software Development Lifecycle (paste-ready)

*Paste the relevant parts into whatever fields Sonke shows. WorkitSA treats trust
& safety and POPIA as first-class requirements, not an afterthought.*

**1. Requirements & planning.** Security and privacy requirements are defined up
front: POPIA compliance, a "trust & safety first" verified marketplace, and a
low-data/low-end-Android design constraint. Key risks identified early:
impersonation, fraud, worker/employer safety, and personal-data exposure.
Tracked in `LAUNCH_READINESS.md` (go/no-go) and `SECURITY_AUDIT.md`.

**2. Design.** Principles: least privilege, defence in depth, and privacy by
design. Authentication via Firebase Identity Platform (phone OTP / email / Google)
with **TOTP multi-factor authentication enforced for all admins**. Role-based
access (worker / employer / business / admin). **Sensitive PII (ID number, documents,
exact address) is isolated in a private per-user subcollection** readable only by
the owner and admins — never on the public user document. Exact GPS is kept private;
only a ~1 km-rounded approximate location is exposed. **All data is resident in
`africa-south1`** (data sovereignty). Secrets are held in Google Secret Manager.

**3. Development.** **Firestore Security Rules are written as code** and enforce
per-document access. Sensitive operations are **server-authored via Cloud Functions**
(ratings, payments, verification decisions) so clients can't forge them — e.g. a
worker cannot self-author a 5-star review. The WhatsApp webhook verifies an
**HMAC-SHA256 signature** on every request and rejects forged calls. No secrets ship
in client code. Analytics is **consent-gated and carries no personal data** (POPIA).
TypeScript strict typechecking is a required gate.

**4. Testing & verification.** **Automated Firestore security-rules tests** run on
the emulator (`npm run test:rules`). Typecheck + production build are mandatory
gates before deploy. **Image uploads are auto-moderated** (Google Vision API deletes
unsafe content). **Fraud signals** run automatically: duplicate-document detection
and a ban registry flag risky sign-ups. Runtime errors are monitored with **Sentry**.

**5. Deployment & release.** Static export served via Firebase Hosting; Cloud
Functions deployed to `africa-south1` with least-privilege service accounts.
New accounts' first posts are held for moderation before going public. **Scheduled
Firestore backups** run automatically. Secrets are injected from Secret Manager, never
committed.

**6. Maintenance & operations.** Every admin action is **audit-logged**. A POPIA
**data-erasure runbook** (`DELETION_RUNBOOK.md`) plus an `eraseUserData` function
handle right-to-be-forgotten requests; a scheduled retention cleanup removes stale
data. Real-time safety: an in-app **SOS** pages the safety team and dials SAPS;
dispute/emergency alerts notify the founder. Dependencies and rules are reviewed on
an ongoing basis.

---

## 4. Lean Business Canvas (paste-ready)

**1. Problem**
- Nearly half of young South Africans (15–34) are unemployed, and real skills don't
  translate into income or a credible profile.
- Job-hunting itself costs scarce **data and transport** money.
- No **trust layer**: employers can't tell who's reliable or nearby, and workers have
  no portable proof of past work.
- *Existing alternatives:* word-of-mouth, Facebook groups, Gumtree, standing on the
  corner.

**2. Customer Segments**
- **Workers:** young South Africans (18–35), low income, low-end Android, often low data.
- **Job posters:** households needing everyday help + township/suburb **SMEs**.
- *Early adopters:* Gauteng households and small businesses; grads from training
  partners (BluLever) and Harambee's network.

**3. Unique Value Proposition**
- **"Everyday work, found nearby — verified and trusted, even with no data."**
- High-level concept: *a trusted marketplace for everyday gig work, built for
  low-data South Africa — and reachable over WhatsApp.*

**4. Solution**
- Verified two-sided marketplace: real-person ID checks, ratings, time-stamped
  proof-of-work photos.
- Geo-matching + job alerts; the new **WhatsApp Job Channel** (find/accept/update by
  text, no app, no data).
- Intelligence: **Jarvis** AI co-pilot + **Live Pulse** demand map + automatic fraud
  checks. Multilingual low-data PWA (en/af/zu).

**5. Channels**
- The PWA at **workitsa.co.za** + WhatsApp.
- Worker and employer **referrals**; social (Facebook/radio, with tagged attribution).
- **B2B outreach** to SMEs; partnerships (BluLever, Harambee, NYDA/SEDFA).

**6. Revenue Streams**
- **Free during launch** (build liquidity first), then:
- **8% service fee** (paid by the job poster) · **R49** Gold verification badge ·
  **R20** boosted posts · **R199/month** business plan.

**7. Cost Structure**
- Running costs ≈ **R14,100/month** (cloud/Firebase, SMS + WhatsApp, verification
  checks, email, operations).
- **Break-even ≈ 500 completed jobs/month.** Low CAC via referrals + organic.

**8. Key Metrics**
- The funnel (now instrumented in GA4): sign-ups → verified → jobs posted → accepted →
  completed; plus completion rate, repeat-post rate, and time-to-fill.
- **12-month targets: 3,000 verified workers · 1,500 job posters · 1,500 completed jobs.**

**9. Unfair Advantage**
- **POPIA-compliant, verified-worker and proof-of-work data** that can't be scraped or
  copied from a listings feed.
- Built-in **trust & safety** infrastructure (ID verification, ratings, moderation,
  SOS) — hard and slow for a clone to replicate.
- **Local-first:** low-data, multilingual, data resident in South Africa, with a
  founder on the ground and a partner pipeline (BluLever / Harambee).

---

### Consistency note
All figures match the deck, video and earlier parts: 8% fee · R49 Gold · R20 boost ·
R199/mo · ~R14,100/mo cost · break-even ~500 jobs/mo · 12-month targets 3,000 / 1,500 /
1,500. Keep them identical everywhere a judge can cross-check.
