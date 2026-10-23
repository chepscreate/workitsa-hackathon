// Generate Workit-Growth-Plan.docx
// Run with: node scripts/generate-growth-plan.mjs

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  Header,
  Footer,
  AlignmentType,
  LevelFormat,
  HeadingLevel,
  BorderStyle,
  WidthType,
  ShadingType,
  PageNumber,
  PageBreak,
  TabStopType,
  TabStopPosition,
} from "docx";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// Repo-root Documents/ (Word + PDF live here since the 2026-07-08 tidy-up).
const OUT = join(here, "..", "..", "Documents", "Workit-Growth-Plan.docx");

// ---- helpers ---------------------------------------------------------------

const OCHRE = "B85A2A";
const INK = "1F1612";
const SAGE = "5D7A47";
const MUTED = "7A6A5E";
const LINE = "E5D9C4";
const CREAM = "FAF4EC";

const text = (t, opts = {}) => new TextRun({ text: t, ...opts });

const para = (children, opts = {}) =>
  new Paragraph({
    spacing: { after: 120, line: 300 },
    ...opts,
    children: Array.isArray(children)
      ? children.map((c) => (typeof c === "string" ? text(c) : c))
      : [typeof children === "string" ? text(children) : children],
  });

const h1 = (t) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200 },
    children: [text(t)],
  });

const h2 = (t) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 140 },
    children: [text(t)],
  });

const h3 = (t) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
    children: [text(t)],
  });

const bullet = (t, level = 0) =>
  new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { after: 80, line: 280 },
    children: Array.isArray(t)
      ? t.map((c) => (typeof c === "string" ? text(c) : c))
      : [typeof t === "string" ? text(t) : t],
  });

const numbered = (t, level = 0) =>
  new Paragraph({
    numbering: { reference: "numbers", level },
    spacing: { after: 80, line: 280 },
    children: Array.isArray(t)
      ? t.map((c) => (typeof c === "string" ? text(c) : c))
      : [typeof t === "string" ? text(t) : t],
  });

const callout = (t, colour = OCHRE) =>
  new Paragraph({
    spacing: { before: 160, after: 160 },
    border: {
      left: { style: BorderStyle.SINGLE, size: 24, color: colour, space: 12 },
    },
    indent: { left: 240 },
    children: [text(t, { italics: true })],
  });

const hr = () =>
  new Paragraph({
    spacing: { before: 200, after: 200 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: LINE, space: 1 },
    },
  });

// Table builder ---------------------------------------------------------------

const PAGE_CONTENT_WIDTH = 9360; // letter, 1" margins

const cellBorders = (color = LINE) => {
  const b = { style: BorderStyle.SINGLE, size: 4, color };
  return { top: b, bottom: b, left: b, right: b };
};

const cell = (content, opts = {}) =>
  new TableCell({
    borders: cellBorders(),
    width: { size: opts.width, type: WidthType.DXA },
    shading: opts.fill
      ? { fill: opts.fill, type: ShadingType.CLEAR }
      : undefined,
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
    children: (Array.isArray(content) ? content : [content]).map((c) =>
      typeof c === "string"
        ? new Paragraph({
            spacing: { after: 0, line: 260 },
            children: [text(c, opts.runOpts ?? {})],
          })
        : c,
    ),
  });

const makeTable = (columnWidths, header, rows) =>
  new Table({
    width: { size: columnWidths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths,
    rows: [
      new TableRow({
        tableHeader: true,
        children: header.map((h, i) =>
          cell(h, {
            width: columnWidths[i],
            fill: INK,
            runOpts: { bold: true, color: CREAM },
          }),
        ),
      }),
      ...rows.map(
        (row, ri) =>
          new TableRow({
            children: row.map((c, i) =>
              cell(c, {
                width: columnWidths[i],
                fill: ri % 2 === 0 ? CREAM : "FFFFFF",
              }),
            ),
          }),
      ),
    ],
  });

// ---- content ---------------------------------------------------------------

const titlePage = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 3200, after: 200 },
    children: [text("WORKIT", { bold: true, size: 80, color: OCHRE })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
    children: [text("Growth & Monetisation Plan", { size: 36, color: INK })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [
      text("South Africa's people-first work marketplace", {
        italics: true,
        color: MUTED,
        size: 22,
      }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 2400, after: 80 },
    children: [text("Prepared by Tshepo M", { color: INK, size: 22 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [text("Furthersky Solutions", { italics: true, color: MUTED })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [text("tshepowayne@workitsa.co.za", { color: MUTED, size: 20 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 600, after: 40 },
    children: [text("Version 1.0 · May 2026", { color: MUTED, size: 20 })],
  }),
  new Paragraph({ children: [new PageBreak()] }),
];

const execSummary = [
  h1("Executive Summary"),
  para(
    "Workit is a two-sided work marketplace built for South Africa’s reality — high unemployment, low data budgets, cash-first economy, WhatsApp-native sharing, and a deep need for trust between strangers. The MVP is live at https://workitsa.co.za with a complete loop: post a job, send/accept offers, two-way ratings, dispute resolution, live GPS, in-app chat, and an emergency button.",
  ),
  para(
    "This document is the plan for turning the MVP into a self-sustaining business. It covers what we charge for, how we acquire users without paid ads, how we keep them coming back, what success looks like at 30 / 60 / 90 days, and the risks that will kill us if we don’t handle them.",
  ),
  callout(
    "The 12-month north star: 10,000 monthly active workers in Gauteng, 25,000 monthly job posts, R5 million in gross marketplace volume, R250k+ monthly revenue from a 5–8% take rate.",
    OCHRE,
  ),
  h2("Strategic principles"),
  bullet([text("Trust beats features. ", { bold: true }), "Every shipping decision is judged by whether it makes employers safer letting strangers into their homes or workers more confident getting paid."]),
  bullet([text("WhatsApp-first distribution. ", { bold: true }), "Every job and every worker profile must be one-tap shareable. South African virality runs on WhatsApp."]),
  bullet([text("Density before breadth. ", { bold: true }), "Win one suburb completely (50+ verified workers, 20+ weekly jobs) before opening a second one."]),
  bullet([text("Cash now, escrow later. ", { bold: true }), "Resist the urge to add payments until liquidity is proven. Cash keeps friction at zero."]),
  bullet([text("Be locally rooted, not Silicon Valley. ", { bold: true }), "Warm visual language, isiZulu / Sesotho / Afrikaans copy, real worker stories, hand-drawn flourishes. Differentiation comes from feel as much as function."]),
  new Paragraph({ children: [new PageBreak()] }),
];

// Monetisation -----------------------------------------------------------------

const monetisation = [
  h1("Part 1 — Monetisation"),
  para(
    "Monetisation has to be sequenced. Charging before there is enough supply or demand kills both sides at once. The plan is three phases.",
  ),

  h2("Phase A — Free for everyone (Months 0–3)"),
  para(
    "Goal: prove the marketplace works. Both employers and workers see zero cost. The only revenue spend is on supply acquisition (subsidising police clearances for the first 100 workers).",
  ),
  bullet("Posting a job: free."),
  bullet("Accepting work: free."),
  bullet("Verification: free."),
  bullet("Background-Verified gold badge: free during pilot (we cover the R150 SAPS clearance for the first 100 workers as an acquisition cost)."),
  callout(
    "Revenue target: R0. This is supposed to lose money. If you hit R0 with 1,000+ posted jobs you have a real business.",
    SAGE,
  ),

  h2("Phase B — Soft monetisation (Months 4–6)"),
  para(
    "Goal: prove people will pay for value. Introduce the first revenue line in a way that does not slow growth.",
  ),
  bullet([text("Featured job listing — R20 per post. ", { bold: true }), "Employer pays for a job to appear at the top of the feed for 24h with an ochre highlight. Optional. No revenue share with workers needed."]),
  bullet([text("Pro worker subscription — R49/month. ", { bold: true }), "Workers can: counter-offer on more than 5 jobs/day (free tier capped), appear higher in employer search, get a verified-pro badge, see jobs 1 hour before free users."]),
  bullet([text("Background-Verified gold badge — R150 one-off. ", { bold: true }), "Worker pays for the clearance themselves or Workit fronts it and recoups from earnings."]),
  callout(
    "Revenue target: R10k–R30k MRR by month 6. Less about cash, more about validating that there is willingness-to-pay.",
    SAGE,
  ),

  h2("Phase C — Mature take rate (Months 7–12)"),
  para(
    "Goal: scale the business. Add the commission line that becomes the dominant revenue source. Requires in-app payments / escrow (build it in months 6–7).",
  ),
  bullet([text("Commission on jobs paid in-app — 8% take rate. ", { bold: true }), "Employer prepays into escrow when accepting an offer; Workit holds the money; released to worker on confirmed completion. We keep 8% (split: 5% platform fee from employer side, 3% service fee from worker side)."]),
  bullet([text("Cash jobs stay free. ", { bold: true }), "We don’t police cash payments. The carrot for using in-app: escrow protection, faster dispute resolution, formal invoice for tax."]),
  bullet([text("Verification renewal — R100/year. ", { bold: true }), "Re-verify ID + address annually to keep the verified badge active."]),
  bullet([text("Insurance markup (optional). ", { bold: true }), "Partner with Hollard or Naked to offer R5 per-job accident cover, marked up 20%."]),
  callout(
    "Revenue target: R200k–R500k MRR by month 12 in Gauteng alone. With Cape Town + Durban opening in year 2, this becomes a real business.",
    SAGE,
  ),

  h2("Pricing & take-rate benchmark"),
  makeTable(
    [2200, 1500, 1500, 1660, 2500],
    ["Platform", "Take rate", "Min job", "Region", "Notes"],
    [
      ["Uber Eats", "30%", "n/a", "Global", "Hostile to workers; bad model"],
      ["Airbnb", "14–16%", "n/a", "Global", "Mature, brand-led"],
      ["SweepSouth (SA)", "~20%", "R300", "SA", "Cleaning-only niche"],
      ["TaskRabbit", "15% + 7.5%", "$20", "US/UK", "Sets price floors"],
      ["Workit (proposed)", "8%", "R50", "SA", "5% employer + 3% worker, cash optional"],
    ],
  ),
  para(
    "An 8% take is deliberately below the market norm. It earns goodwill, signals long-term thinking, and reduces the temptation for workers to ask employers to “pay cash on the side.” We can raise it once retention is locked in.",
  ),
  new Paragraph({ children: [new PageBreak()] }),
];

// Growth -----------------------------------------------------------------------

const growth = [
  h1("Part 2 — Growth Strategy"),

  h2("Target user personas"),
  h3("Worker — “Thabo”"),
  bullet("25–45, lives in Soweto / Tembisa / Khayelitsha / Mamelodi."),
  bullet("Has a skill (gardener, painter, handyman, mover, cleaner) but no steady income."),
  bullet("Owns a R1,500–R3,000 Android with limited monthly data."),
  bullet("Reachable on WhatsApp, hears about jobs via word of mouth + Facebook groups."),
  bullet("Bank account: yes, but used to cash."),
  bullet("Pain point: unreliable, irregular work."),
  bullet("What he needs: a phone full of legit job alerts in his suburb."),

  h3("Employer — “Refiloe”"),
  bullet("28–55, lives in suburb (Linden, Sandton, Centurion, Bryanston, Boksburg)."),
  bullet("Dual-income household, kids, no time for chores."),
  bullet("Currently uses: SweepSouth for cleaning, asks the WhatsApp suburb group for everything else."),
  bullet("Frustrated by: ghosting, quality, safety, having to vet strangers herself."),
  bullet("Willing to pay slightly more for verified + rated."),
  bullet("What she needs: post a job, get someone she trusts at her gate by Saturday."),

  h2("Acquisition channels — in priority order"),
  para(
    "Paid ads are last on purpose. Cost-per-install in SA is R10–R30 for a low-intent install. Organic + community-driven channels deliver an order of magnitude better CAC, and the resulting users are stickier.",
  ),

  h3("1. WhatsApp viral loop (free, top priority)"),
  bullet([text("Already shipped: ", { bold: true }), "every job has a one-tap “Share on WhatsApp” button + a public preview link that doesn’t require sign-up to view."]),
  bullet([text("Next: ", { bold: true }), "let employers WhatsApp a shortlist of verified workers to share with friends-and-family who might know someone. Worker referral = R50 credit on first completed job."]),
  bullet([text("Next: ", { bold: true }), "auto-generate a per-suburb “jobs near you this week” WhatsApp digest that workers can subscribe to."]),

  h3("2. Township + community partnerships (high leverage)"),
  bullet("Partner with church groups, taxi associations, community halls, NGO youth programmes — they have the trusted distribution. Offer them a co-branded onboarding day."),
  bullet("Sponsor verification fees for the first 50 workers per partner. They become evangelists."),
  bullet("Goal: 5 partnerships in 90 days, each yielding 30–80 verified workers."),

  h3("3. Suburb-by-suburb micro-launches (depth not breadth)"),
  bullet("Pick one suburb at a time (suggest: Linden / Greenside in north Joburg — high density of small jobs, demographic likely to use a new app)."),
  bullet("Saturate it: door-flyers, suburb WhatsApp groups, local nextdoor-style Facebook groups, sponsor a school newsletter for a month."),
  bullet("Get to 100 active employers + 30 verified workers in that one suburb before opening the next. Density beats spread — a worker who sees 4 jobs a day stays, one who sees 1 a week leaves."),

  h3("4. Content (TikTok, Instagram, Facebook reels)"),
  bullet("Format 1: 30-second worker-success videos. “Sipho earned R4,200 on Workit this month. Here’s how.”"),
  bullet("Format 2: home-improvement before/afters from completed jobs (with permission)."),
  bullet("Format 3: behind-the-scenes “how we verify a worker” showing the human review."),
  bullet("Goal: post 3x/week per platform. One viral hit (>100k views) is worth 1,000 signups."),

  h3("5. Press / earned media"),
  bullet("Pitch: “The South African founder building a marketplace that pays unemployed Gauteng residents R4k a month.”"),
  bullet("Outlets to chase: Daily Maverick, Stuff SA, Memeburn, TimesLIVE, 702 / Cape Talk."),
  bullet("Story angles: youth unemployment, women in trades, verified-trust differentiator, township innovation."),

  h3("6. Paid ads (only after Channels 1–5 plateau)"),
  bullet("Meta + TikTok: target Gauteng, age 25–55, interests in home services."),
  bullet("Budget cap: R1,500/week to start. Optimise for “posted first job” not “install.”"),
  bullet("Only worth it once CAC for organic exceeds R30."),

  h2("Retention loops"),
  bullet([text("Habit loop (workers): ", { bold: true }), "daily “new jobs in your area” notification at 7am + 5pm. Capped at 3 jobs to avoid spam."]),
  bullet([text("Habit loop (employers): ", { bold: true }), "after first completed job, prompt: “Want Sipho back next month?” → one-tap rebook."]),
  bullet([text("Streaks + status: ", { bold: true }), "Top Rated, Reliable, Local Hero badges (already built). Add a “this week’s top workers in your suburb” email/in-app."]),
  bullet([text("Re-engagement: ", { bold: true }), "if a worker doesn’t open the app for 14 days, send a personalised WhatsApp: “3 new gardening jobs in Soweto this week — want to see them?”"]),

  h2("Virality + referral mechanics"),
  bullet("Worker refers worker: R50 credit when referred worker completes their first job."),
  bullet("Employer refers employer: first job’s 5% platform fee waived for both."),
  bullet("Public worker profile: every approved worker gets a /u/sipho-m URL they can put in their bio / share on WhatsApp."),
  bullet("Embedded badge: “Verified on Workit” badge with link that workers can put on their personal social profiles."),
  new Paragraph({ children: [new PageBreak()] }),
];

// 90-day playbook --------------------------------------------------------------

const playbook = [
  h1("Part 3 — 90-Day Launch Playbook"),
  para(
    "Day-by-day plan to go from “live URL” to “real economy.” Each phase has one numeric goal and three concrete actions. If a goal slips, drop the next phase’s actions until you catch up.",
  ),

  h2("Days 1–30 — Foundation"),
  callout("Goal: 50 verified workers + 25 paid-out completed jobs in one chosen suburb.", OCHRE),
  numbered([text("Pick the launch suburb. ", { bold: true }), "Recommend Linden or Tembisa. Spend Day 1 walking it. List every street, primary school, taxi rank."]),
  numbered([text("Onboard the first 10 workers in person. ", { bold: true }), "You verify each one face-to-face. Subsidise their police clearance. These 10 become the case studies."]),
  numbered([text("Get the first 5 jobs from your own network. ", { bold: true }), "Your house, your mum, two neighbours, a friend’s office. Run them through the platform yourself."]),
  numbered([text("Document every completed job. ", { bold: true }), "Photos, quote on a card, ZAR amount, worker name. These become your first testimonials + organic content."]),
  numbered([text("Daily: post one before/after on TikTok + Facebook. ", { bold: true }), "Even if it gets 200 views, you’re building the muscle."]),

  h2("Days 31–60 — First real growth"),
  callout("Goal: 250 verified workers + 100 weekly job posts + first R500 revenue.", OCHRE),
  numbered([text("Run two community partnerships. ", { bold: true }), "Sign one church + one youth NGO. Subsidise their verification batch."]),
  numbered([text("Launch the WhatsApp suburb digest. ", { bold: true }), "Every Friday evening, a list of weekend jobs near them. Workers can subscribe by replying with their suburb."]),
  numbered([text("Introduce featured listings. ", { bold: true }), "R20 to boost your job to the top of the feed for 24h. First revenue line."]),
  numbered([text("Press push. ", { bold: true }), "Pitch the worker-success angle to 5 publications. Aim for 1 placement."]),
  numbered([text("Refine signup flow. ", { bold: true }), "Watch real users sign up over your shoulder. Cut the slowest 30%."]),

  h2("Days 61–90 — Repeatable"),
  callout("Goal: 1,000 verified workers + 500 weekly job posts + R10k MRR + opened suburb #2.", OCHRE),
  numbered([text("Open suburb #2. ", { bold: true }), "Repeat the playbook. This time hand the in-person verification to a paid part-time “verifier” (R3,000/month)."]),
  numbered([text("Launch the pro-worker subscription. ", { bold: true }), "R49/month for early-access + verified-pro badge + counter-offer cap removed."]),
  numbered([text("Wire in-app payments scaffolding. ", { bold: true }), "Integrate Yoco or Payfast as the escrow rail. Don’t force users to it yet — just make it available as the ‘protected’ option."]),
  numbered([text("Run one referral push. ", { bold: true }), "R50-each refer-a-worker bonus for one week. Measure: cost per acquired worker."]),
  numbered([text("Write the month-4 plan. ", { bold: true }), "Reset goals based on what worked. Cape Town / Durban planning starts here if Gauteng is healthy."]),
  new Paragraph({ children: [new PageBreak()] }),
];

// KPIs ------------------------------------------------------------------------

const kpis = [
  h1("Part 4 — KPIs Dashboard"),
  para(
    "Six numbers. Look at them every Monday morning. If three or more move backward two weeks in a row, stop building features and figure out why.",
  ),
  makeTable(
    [2200, 1700, 1700, 1700, 2060],
    ["Metric", "Day 30 target", "Day 60", "Day 90", "What it tells you"],
    [
      ["Verified workers (cumulative)", "50", "250", "1,000", "Supply liquidity. Trust pipeline is working."],
      ["Weekly job posts", "10", "100", "500", "Demand liquidity. Acquisition is working."],
      ["Time-to-first-offer (median)", "<60 min", "<30 min", "<15 min", "Marketplace depth. Workers see jobs fast."],
      ["Jobs completed / posted", ">50%", ">65%", ">75%", "Match quality. Trust + price fit."],
      ["Avg rating both sides", ">4.3", ">4.4", ">4.5", "Experience quality."],
      ["Dispute rate", "<8%", "<5%", "<3%", "Trust + payment expectations aligned."],
    ],
  ),
  h2("Secondary metrics to track but not obsess"),
  bullet("DAU / WAU / MAU — standard funnel. Watch the WAU/MAU ratio (“stickiness”). Aim >40%."),
  bullet("Time-to-first-job-posted (employer activation). Aim <10 min from signup."),
  bullet("Time-to-first-offer-sent (worker activation). Aim <24 hours from approval."),
  bullet("NPS — survey monthly. Aim >50 by month 6."),
  bullet("CAC per channel — don’t spend on any paid channel where CAC exceeds expected LTV/3."),
  new Paragraph({ children: [new PageBreak()] }),
];

// Competition + risks ---------------------------------------------------------

const competition = [
  h1("Part 5 — Competitive Landscape"),
  para(
    "Workit is not first to think about this. Knowing why the others have not won the market matters — it tells us where the wedge is.",
  ),
  makeTable(
    [2400, 3000, 3960],
    ["Competitor", "What they do", "Why Workit beats them"],
    [
      ["SweepSouth", "Online cleaning bookings (and recently other services)", "Narrow category, top-down pricing, no real worker autonomy. Workit is broad + worker-pricing."],
      ["Gumtree / OLX", "Classified-ad listings", "No verification, no rating, no payment safety. Workit’s entire premise is what they lack."],
      ["Local Facebook groups", "Suburb-level requests + recommendations", "Zero structure, no record, no recourse. Workit formalises what already happens informally."],
      ["TaskRabbit / Helpling", "Marketplace, foreign", "Not in SA. We have the local-knowledge moat (suburbs, languages, payment patterns, SAPS integration)."],
      ["WhatsApp itself", "Word of mouth", "Will always be the channel. Workit doesn’t compete with WhatsApp — we ride it (share buttons, future bot interface)."],
    ],
  ),
  h2("Our edge — in plain terms"),
  bullet("We are built for the SA reality (low data, cash, WhatsApp, suburb-density, isiZulu)."),
  bullet("We make trust the product, not a feature."),
  bullet("We are founder-led by someone in the market — we will spot what foreign competitors miss for years."),
  bullet("Our brand is warm and human, not corporate, not generic-SaaS."),

  h1("Part 6 — Risks + Mitigations"),
  h2("Marketplace chicken-and-egg (highest probability, highest impact)"),
  bullet("Risk: workers won’t join with no jobs; employers won’t post with no workers."),
  bullet("Mitigation: seed manually. You bring the first 25 employer jobs from your own network. Subsidise the first 50 workers’ verification. Geographic density (one suburb at a time) makes liquidity reachable."),

  h2("Trust incident (medium probability, catastrophic impact)"),
  bullet("Risk: a Workit worker harms an employer in their home, or vice versa. One bad story can destroy the brand."),
  bullet("Mitigation: verification rigor (don’t cut corners on the human review). Live tracking + SAPS button on every job. Dispute resolution flow already live. Insurance partnership in year 1. Public incident-response policy."),

  h2("Cash-payment disputes"),
  bullet("Risk: “the worker says I didn’t pay” / “the employer says I didn’t finish.” No record."),
  bullet("Mitigation: completion photo evidence already required. Two-way ratings. Dispute flow with admin review. Move to escrow in month 6–7."),

  h2("Cost of SMS / phone verification at scale"),
  bullet("Risk: Firebase Phone Auth + reCAPTCHA SMS costs add up at 10k+ workers."),
  bullet("Mitigation: do the maths early. SMS costs ~R0.30/message. Bake into CAC. Consider WhatsApp Business API for cheaper messaging."),

  h2("Incumbents enter (SweepSouth broadens, or a foreign player enters)"),
  bullet("Risk: a well-capitalised competitor copies our model."),
  bullet("Mitigation: brand + community lock-in. Our edge is the suburb-by-suburb community partnerships. Hard to copy. Also: keep shipping faster than them."),

  h2("Regulation / labour law"),
  bullet("Risk: SARS or labour department treating workers as employees."),
  bullet("Mitigation: clear independent-contractor framing. Get an employment lawyer’s opinion before month 6. Provide workers with payment records so they can file their own tax."),
  new Paragraph({ children: [new PageBreak()] }),
];

// Tech roadmap aligned ---------------------------------------------------------

const tech = [
  h1("Part 7 — Tech Roadmap Aligned to Growth"),
  para(
    "What we already ship vs. what each growth phase requires. Don’t build ahead of the user need.",
  ),
  h2("Already shipped (sufficient for Phase A)"),
  bullet("Two-sided signup with role split (employer / worker)."),
  bullet("Account approval gate (admin reviews every account)."),
  bullet("Worker verification: ID + selfie video + address + skill proof uploads."),
  bullet("Admin review queue (accounts + verification + disputes)."),
  bullet("Job posting with photos + suggested price."),
  bullet("Worker job feed with category + geographic radius filtering."),
  bullet("Hybrid offer system (accept-or-counter)."),
  bullet("Full job lifecycle (assign → in-progress → completed → confirmed)."),
  bullet("Two-way star ratings with text."),
  bullet("Reputation badges (Verified, Background Verified, Top Rated, Reliable, Local Hero, Rising Star)."),
  bullet("Profile photos + Avatar primitive."),
  bullet("In-app real-time chat once job is assigned."),
  bullet("Live worker GPS share + Leaflet map preview for employer."),
  bullet("SAPS 10111 emergency button on every active job."),
  bullet("Two-way dispute flow with frozen-job state and admin resolution."),
  bullet("WhatsApp share + public job preview (no signup needed to view)."),
  bullet("Browser push notifications + in-app toasts."),
  bullet("Light + dark mode."),
  bullet("Branded confirm modals with brand animation."),
  bullet("Mobile-responsive PWA with installable app icon (iOS + Android)."),
  bullet("Deployed live on Firebase Hosting + Firestore + Storage."),

  h2("Needed for Phase B (Months 4–6)"),
  bullet("Phone OTP signup (SA users prefer cell+SMS to email)."),
  bullet("Email notifications (catch users when tab is closed)."),
  bullet("Featured-listing payment flow (one-off card payment)."),
  bullet("Pro-worker subscription billing."),
  bullet("Worker portfolio / public profile pages (/u/sipho-m)."),
  bullet("Referral tracking + reward credits."),
  bullet("Custom domain (workit.co.za)."),
  bullet("Server-side hardening (move rating-aggregation + payouts to Cloud Functions)."),

  h2("Needed for Phase C (Months 7–12)"),
  bullet("Escrow / in-app payments (Yoco or Payfast integration)."),
  bullet("Recurring jobs (weekly garden service, monthly deep clean)."),
  bullet("Invoice + tax-statement generation."),
  bullet("Multi-language UI (isiZulu, Sesotho, Afrikaans switchable)."),
  bullet("Advanced admin analytics (signups, GMV, take rate, cohort retention)."),
  bullet("FCM push notifications for mobile (works when app is closed)."),
  bullet("Insurance partner integration."),
  new Paragraph({ children: [new PageBreak()] }),
];

const appendix = [
  h1("Appendix — Glossary"),
  bullet([text("GMV: ", { bold: true }), "Gross Marketplace Volume — total rand value of all completed jobs."]),
  bullet([text("Take rate: ", { bold: true }), "the share of GMV we keep (e.g. 8%)."]),
  bullet([text("MRR: ", { bold: true }), "Monthly Recurring Revenue."]),
  bullet([text("ARPU: ", { bold: true }), "Average Revenue Per User."]),
  bullet([text("CAC: ", { bold: true }), "Customer Acquisition Cost."]),
  bullet([text("LTV: ", { bold: true }), "Lifetime Value of a user."]),
  bullet([text("NPS: ", { bold: true }), "Net Promoter Score — 0–10 “would you recommend” survey."]),
  bullet([text("Liquidity: ", { bold: true }), "in a marketplace, the probability that a posted job gets filled within an acceptable time."]),
  bullet([text("Activation: ", { bold: true }), "a signed-up user reaching the first key action (post a job / send an offer)."]),
  bullet([text("Retention: ", { bold: true }), "share of users still active in week 4 / month 3 / month 12."]),
  hr(),
  para(
    "This document is version 1.0 and is a living plan. Revisit every 30 days. Numbers above are deliberate targets, not promises — anchor decisions to direction-of-travel, not to whether you hit a specific number to two decimal places.",
    { alignment: AlignmentType.CENTER },
  ),
  para(
    "Built by Tshepo M — tshepowayne@workitsa.co.za — Furthersky Solutions.",
    { alignment: AlignmentType.CENTER, spacing: { before: 80 } },
  ),
];

// ---- assemble document -----------------------------------------------------

const doc = new Document({
  creator: "Tshepo M (Furthersky Solutions)",
  title: "Workit — Growth & Monetisation Plan",
  description: "Plan for growing and monetising the Workit marketplace.",

  styles: {
    default: {
      document: { run: { font: "Calibri", size: 22 } }, // 11pt body
    },
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 40, bold: true, color: OCHRE, font: "Calibri" },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 },
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 30, bold: true, color: INK, font: "Calibri" },
        paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 1 },
      },
      {
        id: "Heading3",
        name: "Heading 3",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 24, bold: true, color: SAGE, font: "Calibri" },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 },
      },
    ],
  },

  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 540, hanging: 300 } } },
          },
          {
            level: 1,
            format: LevelFormat.BULLET,
            text: "◦",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 900, hanging: 300 } } },
          },
        ],
      },
      {
        reference: "numbers",
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: "%1.",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 540, hanging: 300 } } },
          },
        ],
      },
    ],
  },

  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 }, // US Letter
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                text("Workit", { bold: true, color: OCHRE, size: 18 }),
                text(" · Growth & Monetisation Plan", {
                  color: MUTED,
                  size: 18,
                }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
              children: [
                text("Furthersky Solutions · May 2026", {
                  color: MUTED,
                  size: 18,
                }),
                text("\t", {}),
                text("Page ", { color: MUTED, size: 18 }),
                new TextRun({ children: [PageNumber.CURRENT], color: MUTED, size: 18 }),
                text(" of ", { color: MUTED, size: 18 }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], color: MUTED, size: 18 }),
              ],
            }),
          ],
        }),
      },
      children: [
        ...titlePage,
        ...execSummary,
        ...monetisation,
        ...growth,
        ...playbook,
        ...kpis,
        ...competition,
        ...tech,
        ...appendix,
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  writeFileSync(OUT, buffer);
  console.log(`✓ Wrote ${OUT}`);
});
