# Workit — App Store Listing Pack

_Prepared 2026-06-13. Copy-ready text + asset checklist for the Google Play
and Apple App Store submissions. The PWA is wrapped (no native rebuild), so the
live site updates instantly; you only re-submit when the wrapper changes._

> **Approach:** wrap the live PWA at workitsa.co.za. **Android first** (cheaper,
> friendlier to PWAs). iOS second (Apple is stricter about "website in a box").

---

## Google Play

**App name** (30 chars max)
`Workit — Find Work, Get It Done`

**Short description** (80 chars max)
`Find work or hire trusted, verified workers near you. Gardening to trades.`

**Full description** (4000 chars max)
```
Workit is South Africa's people-first work marketplace — connecting people who
need a job done with skilled, verified workers nearby. Starting in Gauteng.

NEED SOMETHING DONE?
Post a job in about two minutes — gardening, cleaning, plumbing, painting,
moving, deliveries, tutoring and more. Suggest a price, and workers nearby
send you offers. See each worker's rating, completed jobs and verification
badge before you choose. Pay cash or EFT on completion — no upfront fees, no
commission during launch.

LOOKING FOR WORK?
Browse open jobs sorted by how close they are to you. Accept a price or send a
counter-offer. Build a public profile, earn reputation badges, and get the
green Verified badge so employers trust you faster. Get a notification the
moment a matching job is posted near you.

BUILT FOR TRUST AND SAFETY
• Every worker is reviewed by a real person — ID, selfie and proof of address.
• Two-way ratings after every job.
• In-app chat that keeps a record.
• Optional live location sharing on the day of the job.
• An emergency button that dials SAPS 10111.
• Photo proof on completion, and a dispute system reviewed by real admins.

BUILT FOR SOUTH AFRICA
• Light on data — made for prepaid budgets and everyday phones.
• Works offline-friendly and installs like a normal app.
• Cash or EFT, agreed upfront. No card needed.

Workit is free to use during launch. Post a job, find work, get it done.

A Furthersky Solutions product.
```

**Category:** Business (alternate: Lifestyle)
**Tags:** jobs, gig work, hire, services, marketplace
**Content rating:** likely PEGI 3 / Everyone — complete Google's IARC
questionnaire (declares user-generated content + messaging).
**Contact email:** tshepowayne@workitsa.co.za
**Privacy policy URL:** https://workitsa.co.za/privacy
**Website:** https://workitsa.co.za

**"What's new"** (release notes, 500 chars)
```
First release of the Workit app. Find work or hire verified workers near you,
chat in-app, share live location, and stay safe with built-in emergency
support. Launching in Gauteng.
```

---

## Apple App Store

**App name** (30 chars): `Workit: Find Work & Hire`
**Subtitle** (30 chars): `SA's local work marketplace`
**Promotional text** (170 chars, updatable anytime):
`Post a job or find work nearby — verified workers, fair prices, real reviews. Free during launch. Now in Gauteng.`

**Keywords** (100 chars, comma-separated, no spaces):
`jobs,work,gig,hire,gardener,cleaner,handyman,domestic,plumber,delivery,tasker,South Africa,Gauteng`

**Description:** reuse the Google Play full description above.
**Category:** Business (secondary: Lifestyle)
**Support URL:** https://workitsa.co.za/help
**Privacy policy URL:** https://workitsa.co.za/privacy

> **Apple risk (Guideline 4.2 "minimum functionality"):** a wrapped website can
> be rejected as "just a web view." Lean on the native-feeling features in the
> review notes — push notifications, install/offline, live location, the SOS
> emergency dialer — and submit with Capacitor (not a bare web view) to pass.

---

## Asset checklist

| Asset | Spec | Status |
|-------|------|--------|
| App icon | 512×512 PNG | ✅ have (`/icon-512.png`) |
| Adaptive/maskable icon | 512×512 | ✅ have (`/icon-512-maskable.png`) |
| Feature graphic (Play) | 1024×500 PNG/JPG | ⬜ **need** — I can generate |
| Phone screenshots | 2–8, min 1080px, 16:9 or 9:16 | ⬜ **need** — capture landing, find-work, a job, a profile, post-a-job |
| 7-inch + 10-inch tablet shots (Play, optional) | — | ⬜ optional |
| iPhone 6.7" + 6.5" screenshots (Apple) | required sizes | ⬜ **need** |
| Promo video | optional | ⬜ skip for v1 |
| Privacy policy URL | live | ✅ https://workitsa.co.za/privacy |
| Data-safety / privacy nutrition labels | questionnaire | ⬜ fill at submission (declares: email, phone, location, photos, messages; reviewed by a person; not sold) |

I can produce the **feature graphic** and **captioned phone screenshots** on
request (captured from the live app), and draft the data-safety answers.

---

## Submission steps (when you're ready)

### Android (do first)
1. **Google Play Developer account** — US$25 once, at play.google.com/console.
   Register as **Furthersky Solutions** (an *organisation* account skips the
   new 20-tester / 14-day closed-test requirement that personal accounts now
   have).
2. **Generate the Android package** — paste `https://workitsa.co.za` into
   [PWABuilder](https://www.pwabuilder.com/) (or use Bubblewrap). It produces a
   signed `.aab` (Android App Bundle) and a **signing-key SHA-256 fingerprint**.
3. **Digital Asset Links** — host `/.well-known/assetlinks.json` on the site
   with that fingerprint (template below) so the app opens without a browser
   address bar (verified TWA). Tell me the fingerprint and I'll create + deploy
   this file.
4. **Upload the `.aab`**, paste the listing text above, add the screenshots +
   feature graphic, complete the content-rating and data-safety questionnaires,
   and submit for review.

### iOS (after Android is live)
1. **Apple Developer account** — US$99/year.
2. Wrap with **Capacitor** (best for passing review) pointing at the live site.
3. Add the iOS screenshots, reuse the listing copy, submit. Budget for one
   rejection round and reply citing the native features.

---

## assetlinks.json template

Once PWABuilder/Bubblewrap gives you the signing-key SHA-256 fingerprint,
this goes live at `https://workitsa.co.za/.well-known/assetlinks.json`:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "za.co.workitsa.twa",
      "sha256_cert_fingerprints": ["REPLACE_WITH_SHA256_FINGERPRINT"]
    }
  }
]
```

(Confirm the `package_name` matches what PWABuilder generates — adjust if
different. Then I'll add the file to `public/.well-known/` and deploy.)
