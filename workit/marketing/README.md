# Workit — marketing kit

Produced by the **workit-marketer** agent. Everything here is **draft-and-review** —
nothing is sent, posted, or published automatically. You approve and send/post.

## Content (`content/`)
- `poster-find-work.html` — worker-side launch poster (cream/ochre), live QR to
  workitsa.co.za. Open in a browser → screenshot or print for social/flyers.
- `poster-list-your-business.html` — business-side poster (ink/ochre), live QR. Doubles
  as the hero image for B2B outreach.
- `captions.md` — ready-to-post captions for Facebook / WhatsApp / Instagram / TikTok,
  split by audience (worker / employer / business), plus hashtags and one-liners.
- `posting-calendar.md` — a 2-week starter calendar alternating supply/demand posts.

## Outreach (`outreach/`)
- `strategy.md` — who to target, the offer, the 3-touch sequence, how to source real
  contacts, tracking, and the POPIA/anti-spam send rules.
- `email-drafts.md` — intro + 2 follow-ups + subject lines + 3 worked examples.
  Personalise the `{{fields}}` before sending.
- `target-list.csv` — fillable target sheet (example rows included — replace them with
  real public business listings). Track status here.
- `workit-business-onepager.html` — the email attachment. Open → Print → Save as PDF.

## How to use it
1. **Social:** open a poster, screenshot/export it, post it with a caption from
   `captions.md` following the calendar.
2. **Outreach:** fill `target-list.csv` with real public business emails → personalise a
   draft from `email-drafts.md` → attach the one-pager PDF → review the batch → send.

## Sending email — the rules (don't skip)
- **No passwords shared, ever.** Nothing is sent without your explicit go-ahead.
- **B2B only**, public business addresses, **small reviewed batches** (10–20), each with
  a clear opt-out. Honour declines.
- Best channel = Workit's **SendGrid** on the authenticated `workitsa.co.za` domain
  (better deliverability + opt-out) — ask the code pipeline to build a small admin
  outreach sender. Personal Gmail/Outlook works for low volume but lands in spam more
  easily.
