# WorkitSA — FNB Hackathon Weekend Run-Sheet (23–26 Oct 2026)

**Updated 2026-10-20.** The WhatsApp Job Channel — the required new feature — is
**already built, deployed and committed** (folded into the live `jarvisWhatsApp`
webhook). The `job_alert` template is **submitted to Meta (in review)**. So the
event days are now mostly **assembly + demo**, not building.

**Who:** 🧑 = you (Tshepo) · 👩 = Simphiwe · 🤖 = Claude (in a working session)
**Deadline:** submit on **Sonke by Mon 26 Oct, 23:59**.
**Key facts to keep consistent:** WhatsApp demo line **+27 67 748 2643** (personal
081 never shown) · judge login you create · traction **140+ users / 110+ workers /
25+ verified** · challenge **Youth employment & work readiness**.

> ⚠️ **Confirm the build-window rule first.** If the hackathon requires the feature
> to be built *during* the event (23–25 Oct), treat this session's work as a
> prototype and redo the integration commits inside the window so git history lands
> in the event. If not required, we're simply ahead.

---

## ✅ Already done (this session, 19–20 Oct)
- [x] 🤖 **WhatsApp Job Channel built + deployed** — `whatsappJobChannel.ts`
  (`handleWhatsAppJobReply` + `onJobVisibleWhatsAppAlert`), opt-in card
  `WhatsAppJobAlertsCard.tsx`, folded into `jarvisWhatsApp`. Replies: `1`/`ACCEPT`,
  `START`, `DONE`, `STOP`.
- [x] 🧑 **Secrets set + functions deployed** (`jarvisWhatsApp`, `onJobVisibleWhatsAppAlert`).
- [x] 🧑 **`job_alert` template submitted** to Meta — **in review**.
- [x] 🤖 **No webhook wiring needed** — reuses the existing Jarvis callback URL.
- [x] ✅ **Sonke SSDLC + Lean Business Canvas confirmed filled.**
- [x] 🤖 Marketplace populated (40 placeholder jobs + 24 verified workers) for screenshots.

## Before the weekend (now → Thu 22 Oct)
- [ ] 🧑 **Confirm the build-window rule** (see ⚠️ above).
- [ ] 🧑 **Watch for `job_alert` approval** (Meta 🔔 / email). Ping me to re-check anytime.
- [ ] 🤖 **(Insurance) Build the free-text fallback** so the demo works even if the
  template isn't approved: when a worker has messaged in the last 24 h, send the
  alert as plain text with full job details; template only for cold sends. ~15 min.
- [ ] 🧑 **Add ≤5 WhatsApp test recipients** in Meta → API Setup → *To* → Manage
  phone number list (include the demo worker **067 748 2643** + any judge number).
- [ ] 🧑 **Add Simphiwe to the Sonke team** (invite her by email from the Team page).
- [ ] 🧑 Decide the judge demo login (suggested `tshepowayne2+judge@gmail.com` / a demo password).

## Friday 23 Oct — kickoff + verify
- [ ] 🧑 Watch the kickoff **10:00** on appoftheyear.co.za.
- [ ] 🤖/🧑 **End-to-end test** of the WhatsApp feature: opt in as a worker → post a
  matching job → alert arrives → reply `1` → offer appears → `START` → `DONE`.
- [ ] 🧑 *(if build-during-event required)* 🤖 stages the integration commits now.
- [ ] 🧑 Post the **Day-1 Sonke update** + Friday social post (`…Progress Posts.md`).

## Saturday 24 Oct — demo account, screenshots
- [ ] 🧑 Create the **judge signup** on workitsa.co.za → send me the **UID**.
- [ ] 🤖 Run `python demo/setup_judge_account.py --uid <UID>` (promote judge →
  approved/verified; seed the WhatsApp demo worker).
- [ ] 🧑 **Capture deck screenshots:** find-work feed, the live WhatsApp job-alert
  chat (opt-in → alert → reply `1`), sign-in, Live Pulse + Jarvis.
- [ ] 👩 **Record the ≤90s video** — only after the WhatsApp feature is confirmed
  live. Send Simphiwe the go-ahead + demo login + number. Brief: `…Video Brief (for Simphiwe).pdf`.
- [ ] 🧑 Attend War Rooms; post the **Day-2 Sonke update**.

## Sunday 25 Oct — assemble
- [ ] 👩/🧑 **Host the video** (YouTube unlisted / Drive "anyone with link"); test in incognito.
- [ ] 🤖/🧑 Drop screenshots + **video link into the deck**; confirm traction numbers;
  **export the deck → PDF**.
- [ ] 🧑 Post the Sunday social + Sonke update.

## Monday 26 Oct — SUBMIT (by 23:59)
- [ ] 🧑 On Sonke → **Submit Files**: upload the **deck PDF** (≤10 slides, judge login
  + video link on a slide) and the **≤90s video link**.
- [ ] 🧑 Final pass against `…Final Submission.md`.
- [ ] 🧑 Post the "submitted ✅" Sonke update.

## After judging closes
- [ ] 🤖 Run `python demo/cleanup_demo.py` → removes all placeholder/demo data.

---

### The deliverables, mapped to the submission
| Submission item | Status |
|---|---|
| New feature (required) — WhatsApp Job Channel | ✅ **built + deployed** (template in review) |
| Slide deck (PDF ≤10) | built; add screenshots + links, export PDF |
| Demo video (≤90s) | script + Simphiwe brief ready; record Sat |
| SSDLC | ✅ filled on Sonke |
| Lean Business Canvas | ✅ filled on Sonke |

**The critical path now:** `job_alert` approval (or the free-text fallback) →
screenshots → Simphiwe's video → deck PDF → upload. No more building required.
