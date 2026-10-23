# Workit — market-research survey

A Google Form to learn what people actually need from Workit, on **both sides**
of the marketplace (workers + employers + businesses), and to capture early-access
leads. Designed for the Gauteng pre-launch push.

## How to create the form (≈2 minutes)

The fastest route is the generator script — it builds the whole form, with
answer-based branching, in your own Google account. **I can't create it for you**
(that would mean signing into your Google account), so you run it:

1. Open <https://script.google.com> and sign in as `tshepowayne@workitsa.co.za`.
2. **New project** → delete the sample code.
3. Paste the contents of [`workit-survey.gs`](workit-survey.gs) → **Save**.
4. **Run** → choose `createWorkitSurvey` → **Allow** the one-time authorisation
   (Google asking *you* for permission to let your script make a form in your Drive).
5. **View ▸ Logs** → copy the **Edit** link (to tweak) and the **Share** link
   (to send out / put behind a QR code — the same QR style as the video ad).

Re-running makes a fresh, separate copy.

### Manual alternative
If you'd rather build it by hand, the full question list is below — paste each
section into Forms and set the first question ("Which best describes you?") to
**Go to section based on answer**.

## Why it's built this way

- **One form, three audiences.** A branching question at the top routes workers,
  employers and businesses to their own short section, so nobody answers irrelevant
  questions — each person's path is ~3 minutes.
- **Validates the things Workit is betting on:** trust/verification, fair pricing,
  safety features, low-data/low-end-Android reality, and language priority (en/af/zu
  first, but we ask so the data decides).
- **Calibrates real numbers:** the "what would you pay for a half-day?" question
  feeds the fair-price bands; the importance grid ranks which safety features matter.
- **Captures demand + leads:** likelihood-to-use, and an *optional, consent-gated*
  contact field (POPIA-safe — anonymous by default, contact never shared).

## Survey structure

**Intro** — what Workit is, ~3 min, anonymous unless you opt in, POPIA note.

**Page 1 · About you** (everyone)
- Province (required) · town/suburb
- Age group
- Preferred phone languages (multi-select, incl. all 11 official languages)
- Phone type · mobile-data situation
- **Which best describes you?** → routes to one branch below

**Branch A · Finding work** (workers)
- What work can you do (categories) · how much work you want
- How you find work now · biggest barriers
- Willing to ID+selfie verify? · payment preference
- Open: what would make you trust/use it

**Branch B · Hiring someone** (households/employers)
- What jobs you need done · how often you hire
- How you find workers now · biggest worry about a stranger
- **What you'd pay for a half-day** · would ID-verification help? · payment preference

**Branch C · Hiring for your business** (businesses)
- What the business does · workers hired per month
- Hardest part of casual hiring · **which paid features you'd buy** (monetization signal)

**Page · About Workit** (everyone)
- Likelihood to use (1–5)
- Importance grid: verification, live tracking, panic button, ratings, fair-price
- Open: the ONE thing that would make/break it
- How did you hear about Workit

**Page · Stay in the loop** (optional)
- Want early access? · WhatsApp/email (optional) · consent checkbox

## Reading the results
In Forms, the **Responses** tab gives live charts; **Link to Sheets** exports
everything to a spreadsheet for cross-tabs (e.g. fill the worker:employer split,
top categories by area, price expectations vs the bands in
[`priceGuide.ts`](../src/lib/priceGuide.ts)). Those same signals feed the admin
**Growth** dashboard once people start signing up.
