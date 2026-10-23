# Workit — B2B outreach strategy (get businesses onto the app)

Goal: sign up Gauteng service businesses as **employers/business accounts** so there's
demand (jobs + listings) for workers to fill. Demand is the binding constraint, so this
is high-leverage. Everything here is **draft-and-review** — see the send rules at the end.

## Who we're targeting (ideal customer)
Gauteng SMEs that either hire casual/temporary workers or sell services households want:
1. **Gardening / landscaping** services
2. **Cleaning** companies (domestic, office, post-construction)
3. **Security** firms (often need extra hands fast)
4. **Trades** — plumbing, electrical, painting, building, tiling
5. **Logistics / delivery / moving** (bakkie hire, couriers)
6. **Events / hospitality** staffing
7. **Estate agents, body corporates, complexes** (recurring maintenance buyers)

Prioritise: clear public business email, active (recent posts / reviews), Gauteng-based,
small enough that the owner reads their own inbox.

## The offer (why they should care)
- **Free during launch** — list services, receive job requests, no fee yet.
- **Verified business badge** — instant trust with customers.
- **Featured / boosted listings** — top placement while it's free.
- **Access to a pool of verified workers** when they need extra hands.
- Low-data, works on any phone — fits SA reality.

Keep claims honest: we're launching in Gauteng; don't quote user numbers we don't have.

## Channels & sequence
Primary: **email** (personalised, one business at a time). Secondary: WhatsApp Business,
and in-person at trade counters / markets / chambers of commerce.

Per target, a light 3-touch sequence over ~2 weeks:
1. **Day 0 — Intro email** (value in 5 lines + one-pager attached + link). 
2. **Day 4 — Follow-up** if no reply (shorter, one new angle: the verified badge).
3. **Day 10 — Final nudge** (soft close: "should I close the loop?").
Stop immediately on any reply or opt-out.

Drafts for all three are in `email-drafts.md`. Attachment: `workit-business-onepager.html`
(open in a browser → Print → Save as PDF to attach).

## Sourcing the list (you populate real contacts)
I don't scrape or buy lists. Use public sources and paste results into
`target-list.csv`. Useful searches:
- Google: `gardening services Pretoria`, `cleaning company Johannesburg contact`,
  `"plumber" Centurion email`, `security company Midrand`.
- Google Maps (filter by area) → business website → public "contact"/"about" email.
- Local Facebook business pages, area community groups, Yellow-Pages-style directories,
  chamber-of-commerce member lists.
Capture only the **public business** email — never personal/private data.

## Tracking & targets
Log status in `target-list.csv` (Not contacted → Sent → Replied → Signed up → Declined).
Tie it back to the **Growth dashboard**: each signed-up business adds to the
employer/demand side and should lift fill-rate as they post jobs. A reasonable starter
target: **50 quality businesses contacted/week**, aiming for a 10–20% sign-up rate.

## Send rules (non-negotiable — POPIA + deliverability)
- **B2B only, public business addresses.** No personal data, no bought lists.
- **Small reviewed batches** (10–20 at a time), not blasts — protects your domain
  reputation and stays POPIA-friendly.
- **Every email**: says who we are, why they're getting it, and a clear opt-out line.
- **Honour declines** instantly and permanently.
- **Best sending channel:** Workit's own SendGrid on the authenticated `workitsa.co.za`
  domain (better inbox placement + opt-out) — ask the code pipeline to build a small
  admin outreach sender. Personal Gmail/Outlook works for low volume but lands in spam
  more easily. Either way: **nothing is sent without your explicit go-ahead.**
