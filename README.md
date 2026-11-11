# WorkitSA

**Everyday work, found nearby — verified, trusted, low-data.**

WorkitSA is a South African two-sided gig-work marketplace. Employers and
households post everyday jobs (cleaning, gardening, trades, deliveries, errands,
care, tutoring); nearby **ID-verified** workers accept or counter-offer; the work
gets done with live location + photo proof; payment is cash/EFT; and both sides
rate each other. Built for low-data, low-end Android, and multilingual
(English · Afrikaans · isiZulu).

- **Live app:** https://workitsa.co.za
- **Challenge:** Youth employment & work readiness
- **Event:** FNB App of the Year Hackathon 2026

> This is a **public code snapshot** of the app for hackathon judging. It
> excludes internal business, funding and outreach material. The live product
> above is the real thing.

## Hackathon feature — the WhatsApp Job Channel

The lowest-friction on-ramp to work: a jobseeker with **no app and no data** can
do everything over WhatsApp.

- **Register over WhatsApp** — an unknown number texts in and is guided through
  name → area → skills → POPIA consent, becoming a worker (no app download).
- **Find & offer** — `JOBS` lists nearby open work; reply a number to offer, or
  counter-offer your price.
- **Get hired** — employers review offers (`OFFERS`) and accept/decline right in
  WhatsApp; the worker is notified instantly.
- **Proof of work** — a confirmed job issues a shareable **Work Record**, turning
  each job into verifiable work readiness.
- **Safety** — `SOS` and location check-ins; `HELP` shows the full command menu.

Runs on one WhatsApp Cloud API number alongside **Jarvis**, a Gemini-powered
admin ops assistant, and a public support front door.

## Stack

- **Frontend:** Next.js (App Router, static-export PWA), Tailwind, Leaflet
- **Backend:** Firebase — Auth (TOTP MFA for admins), Firestore, Cloud Storage,
  Cloud Functions (`africa-south1`), Hosting, FCM push
- **Integrations:** WhatsApp Cloud API, Google Gemini (Jarvis), SendGrid, GA4, Sentry
- **i18n:** en · af · zu

## Structure

```
src/         Next.js app (pages, components, lib, i18n)
functions/   Cloud Functions (WhatsApp Job Channel, Jarvis, email, ratings, …)
public/      PWA assets + service worker
growth/      Market-research survey generator
tests/       Firestore security-rules tests
*.rules      Firestore + Storage security rules
```
