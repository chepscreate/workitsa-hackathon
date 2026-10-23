/* Workit — system + investor deck. Built with pptxgenjs. */
const pptxgen = require("pptxgenjs");
const path = require("path");

const A = (f) => path.join(__dirname, "assets", f);
const p = new pptxgen();
p.defineLayout({ name: "W", width: 13.333, height: 7.5 });
p.layout = "W";
p.author = "Workit / Furthersky Solutions";
p.company = "Workit";

// ---- palette (no #) ----
const INK = "1F1612", INK2 = "2A1F17", CREAM = "FAF4EC", CREAM2 = "F1E7D6",
  PAPER = "FFFFFF", OCHRE = "D97742", OCHRE6 = "B85A2A", OCHRE50 = "FBEEE2",
  SAGE = "5D7A47", SAGE7 = "46603A", SAGE100 = "E7EEDF", LINE = "E3D7C2",
  BRICK = "A93226", INKSOFT = "4A3A30", INKMUT = "8A7868", GOLD = "C9922B";
const HEAD = "Georgia", BODY = "Calibri";

const W = 13.333, H = 7.5, M = 0.7;

// ---- helpers ----
function beadwork(s, y) {
  const cols = [OCHRE, INK, SAGE, CREAM2];
  const seg = 0.34;
  let x = 0, i = 0;
  while (x < W) {
    s.addShape(p.ShapeType.rect, { x, y, w: seg, h: 0.12, fill: { color: cols[i % 4] }, line: { type: "none" } });
    x += seg; i++;
  }
}
function eyebrow(s, text, color = OCHRE6, x = M, y = 0.55) {
  s.addText(text.toUpperCase(), { x, y, w: 9, h: 0.3, fontFace: BODY, fontSize: 12, bold: true, color, charSpacing: 3 });
}
function title(s, text, opts = {}) {
  s.addText(text, { x: opts.x ?? M, y: opts.y ?? 0.85, w: opts.w ?? 11.9, h: opts.h ?? 1.0,
    fontFace: HEAD, fontSize: opts.size ?? 34, bold: true, color: opts.color ?? INK, align: "left" });
}
function contentBG(s) { s.background = { color: CREAM }; }
function card(s, x, y, w, h, opts = {}) {
  s.addShape(p.ShapeType.roundRect, { x, y, w, h, rectRadius: opts.r ?? 0.12,
    fill: { color: opts.fill ?? PAPER }, line: { color: opts.line ?? LINE, width: 1 }, shadow: opts.shadow });
}
function chip(s, x, y, label, fill, fg, w) {
  const ww = w ?? (0.16 + label.length * 0.085);
  s.addShape(p.ShapeType.roundRect, { x, y, w: ww, h: 0.34, rectRadius: 0.17, fill: { color: fill }, line: { type: "none" } });
  s.addText(label, { x, y, w: ww, h: 0.34, fontFace: BODY, fontSize: 10.5, bold: true, color: fg, align: "center", valign: "middle" });
  return ww;
}
const softShadow = { type: "outer", color: "B9A98F", blur: 8, offset: 3, angle: 90, opacity: 0.35 };

// =================================================================
// 1 — COVER
// =================================================================
let s = p.addSlide();
s.background = { color: INK };
s.addShape(p.ShapeType.rect, { x: 0, y: 0, w: W, h: H, fill: { color: INK } });
// faint phone on right
s.addImage({ path: A("screen_home.png"), x: 9.5, y: 0.7, h: 6.6, w: 3.33, sizing: { type: "contain", w: 3.33, h: 6.6 } });
s.addText("WORKIT", { x: M, y: 1.7, w: 9, h: 0.4, fontFace: BODY, fontSize: 15, bold: true, color: OCHRE, charSpacing: 6 });
s.addText("Find work.\nGet work done.", { x: M - 0.05, y: 2.1, w: 9, h: 2.2, fontFace: HEAD, fontSize: 60, bold: true, color: CREAM, lineSpacing: 56 });
s.addText("South Africa's people-first marketplace for everyday work — connecting people who need a job done with verified workers nearby.",
  { x: M, y: 4.5, w: 7.6, h: 1.0, fontFace: BODY, fontSize: 17, color: "CDBBA8", lineSpacing: 24 });
s.addText([
  { text: "A Furthersky Solutions product", options: { bold: true, color: CREAM } },
  { text: "    ·    Built by Tshepo M    ·    workitsa.co.za", options: { color: "9C8A78" } },
], { x: M, y: 6.55, w: 11, h: 0.4, fontFace: BODY, fontSize: 12 });
beadwork(s, 7.18);

// =================================================================
// 2 — THE PROBLEM
// =================================================================
s = p.addSlide(); contentBG(s);
eyebrow(s, "The problem");
title(s, "Joblessness is South Africa's\ndefining crisis.", { size: 32, h: 1.4 });
const stats = [
  ["42%+", "expanded unemployment rate — among the highest on earth"],
  ["60%+", "youth (15–34) are without work"],
  ["8M+", "South Africans actively want a job and can't find one"],
];
stats.forEach((st, i) => {
  const x = M + i * 4.06;
  card(s, x, 2.55, 3.8, 1.85, { fill: PAPER, shadow: softShadow });
  s.addText(st[0], { x: x + 0.25, y: 2.7, w: 3.4, h: 0.8, fontFace: HEAD, fontSize: 40, bold: true, color: OCHRE6 });
  s.addText(st[1], { x: x + 0.25, y: 3.55, w: 3.35, h: 0.75, fontFace: BODY, fontSize: 12.5, color: INKSOFT, lineSpacing: 16 });
});
card(s, M, 4.75, 11.93, 2.05, { fill: INK });
s.addText("…and the tools to find work are broken.", { x: M + 0.35, y: 4.95, w: 11, h: 0.45, fontFace: HEAD, fontSize: 18, bold: true, color: CREAM });
const broken = [
  "Classifieds (Gumtree, Facebook) have zero trust or verification",
  "Existing apps cover narrow niches — cleaning only, one city only",
  "Word-of-mouth doesn't scale and leaves newcomers out",
  "No safety net: no ratings, no IDs, no recourse when things go wrong",
];
broken.forEach((b, i) => {
  const x = M + 0.35 + (i % 2) * 5.7, y = 5.5 + Math.floor(i / 2) * 0.62;
  s.addText("✕", { x, y, w: 0.3, h: 0.3, fontFace: BODY, fontSize: 13, bold: true, color: OCHRE });
  s.addText(b, { x: x + 0.32, y, w: 5.3, h: 0.55, fontFace: BODY, fontSize: 12.5, color: "D9CBB8", lineSpacing: 15 });
});

// =================================================================
// 3 — THE OPPORTUNITY
// =================================================================
s = p.addSlide(); contentBG(s);
eyebrow(s, "The opportunity", SAGE7);
title(s, "One trusted place for\neveryday work.", { size: 32, h: 1.4 });
s.addText("South Africa's informal + gig economy is enormous and almost entirely offline. Smartphones are everywhere; the marketplace to organise this work is not.",
  { x: M, y: 2.35, w: 7.0, h: 1.1, fontFace: BODY, fontSize: 15, color: INKSOFT, lineSpacing: 21 });
const opp = [
  ["Broad by design", "11 categories from gardening to trades to tutoring — not a single niche."],
  ["Trust-first", "Every worker reviewed by a human. Two-way ratings on every job."],
  ["Low-data, mobile-first", "Built as a PWA for prepaid Android on tight data budgets."],
  ["Cash or EFT", "Pay on completion — no card, no bank account required to start."],
];
opp.forEach((o, i) => {
  const x = M + (i % 2) * 6.0, y = 3.5 + Math.floor(i / 2) * 1.65;
  card(s, x, y, 5.6, 1.45, { fill: PAPER, shadow: softShadow });
  s.addShape(p.ShapeType.roundRect, { x: x + 0.25, y: y + 0.25, w: 0.55, h: 0.55, rectRadius: 0.27, fill: { color: OCHRE50 }, line: { type: "none" } });
  s.addText(["🌿", "🛡", "📱", "💵"][i], { x: x + 0.25, y: y + 0.25, w: 0.55, h: 0.55, fontSize: 16, align: "center", valign: "middle" });
  s.addText(o[0], { x: x + 1.0, y: y + 0.22, w: 4.4, h: 0.4, fontFace: HEAD, fontSize: 16, bold: true, color: INK });
  s.addText(o[1], { x: x + 1.0, y: y + 0.62, w: 4.45, h: 0.75, fontFace: BODY, fontSize: 12, color: INKSOFT, lineSpacing: 15 });
});
// right rail competitor framing
card(s, 8.05, 2.3, 4.6, 0.95, { fill: SAGE100, line: SAGE });
s.addText("Where others are narrow, Workit is the whole market.", { x: 8.3, y: 2.45, w: 4.1, h: 0.7, fontFace: BODY, fontSize: 13, italic: true, bold: true, color: SAGE7, valign: "middle", lineSpacing: 17 });

// =================================================================
// 4 — WHAT IS WORKIT (marketplace diagram)
// =================================================================
s = p.addSlide(); contentBG(s);
eyebrow(s, "What is Workit");
title(s, "A two-sided marketplace for honest work.", { size: 28 });
// three nodes
function node(x, label, sub, fill, fg, icon) {
  card(s, x, 2.7, 3.3, 2.0, { fill, shadow: softShadow, line: fill });
  s.addText(icon, { x: x, y: 2.95, w: 3.3, h: 0.7, fontSize: 30, align: "center" });
  s.addText(label, { x, y: 3.7, w: 3.3, h: 0.45, fontFace: HEAD, fontSize: 19, bold: true, color: fg, align: "center" });
  s.addText(sub, { x: x + 0.25, y: 4.15, w: 2.8, h: 0.5, fontFace: BODY, fontSize: 11.5, color: fg === CREAM ? "E8DCCB" : INKSOFT, align: "center", lineSpacing: 14 });
}
node(M, "Employer", "Posts a job + a fair price", PAPER, INK, "🛠");
node(5.02, "Workit", "Trust, matching, safety, payments-ready", INK, CREAM, "◆");
node(9.03, "Worker", "Accepts or counters, does the work", PAPER, INK, "💪");
// arrows
s.addShape(p.ShapeType.line, { x: 4.0, y: 3.5, w: 1.0, h: 0, line: { color: OCHRE, width: 2.5, endArrowType: "triangle", beginArrowType: "triangle" } });
s.addShape(p.ShapeType.line, { x: 8.32, y: 3.5, w: 0.7, h: 0, line: { color: OCHRE, width: 2.5, endArrowType: "triangle", beginArrowType: "triangle" } });
s.addText("posts", { x: 3.9, y: 3.1, w: 1.2, h: 0.3, fontFace: BODY, fontSize: 10, italic: true, color: INKMUT, align: "center" });
s.addText("offers", { x: 8.2, y: 3.1, w: 1.0, h: 0.3, fontFace: BODY, fontSize: 10, italic: true, color: INKMUT, align: "center" });
card(s, M, 5.05, 11.93, 1.55, { fill: OCHRE50, line: OCHRE });
s.addText([
  { text: "The loop:  ", options: { bold: true, color: OCHRE6, fontFace: HEAD, fontSize: 15 } },
  { text: "Post → workers offer → employer accepts → worker does the job → cash or EFT on completion → both sides rate each other.", options: { color: INKSOFT, fontFace: BODY, fontSize: 14 } },
], { x: M + 0.35, y: 5.25, w: 11.2, h: 0.6, lineSpacing: 18 });
s.addText("No middleman fee during launch — the agreed price is exactly what the worker earns.", { x: M + 0.35, y: 5.95, w: 11.2, h: 0.45, fontFace: BODY, fontSize: 12.5, italic: true, color: SAGE7 });

// =================================================================
// 5–8 PRODUCT TOUR (device + features)
// =================================================================
function productSlide(eb, ttl, img, feats, accent = OCHRE6) {
  s = p.addSlide(); contentBG(s);
  // device on left
  s.addShape(p.ShapeType.rect, { x: 0, y: 0, w: 4.7, h: H, fill: { color: CREAM2 } });
  s.addImage({ path: A(img), x: 1.0, y: 0.65, h: 6.2, w: 3.13, sizing: { type: "contain", w: 3.13, h: 6.2 } });
  eyebrow(s, eb, accent, 5.1, 0.7);
  s.addText(ttl, { x: 5.1, y: 1.05, w: 7.6, h: 1.0, fontFace: HEAD, fontSize: 28, bold: true, color: INK, lineSpacing: 30 });
  feats.forEach((f, i) => {
    const y = 2.45 + i * 1.05;
    s.addShape(p.ShapeType.roundRect, { x: 5.1, y, w: 0.5, h: 0.5, rectRadius: 0.25, fill: { color: OCHRE50 }, line: { type: "none" } });
    s.addText(f[0], { x: 5.1, y, w: 0.5, h: 0.5, fontSize: 15, align: "center", valign: "middle" });
    s.addText(f[1], { x: 5.78, y: y - 0.04, w: 7.0, h: 0.4, fontFace: HEAD, fontSize: 16, bold: true, color: INK });
    s.addText(f[2], { x: 5.78, y: y + 0.36, w: 7.1, h: 0.62, fontFace: BODY, fontSize: 12.5, color: INKSOFT, lineSpacing: 15 });
  });
}
productSlide("Product · Home", "A personalised home the moment you sign in.", "screen_home.png", [
  ["👋", "Role-aware dashboard", "Employers see “post a job”; workers see “find work” + a finish-verification nudge."],
  ["📌", "Your active job, up top", "The in-flight job surfaces with the worker's photo and one-tap message / track."],
  ["📊", "Reputation at a glance", "Rating, jobs done, level and stars — the trust you've built, front and centre."],
  ["📲", "Installable PWA", "Add to home screen; works offline-first and light on data."],
]);
productSlide("Product · Find work", "Jobs open near you, ranked by distance.", "screen_findwork.png", [
  ["📍", "Distance-aware feed", "Pin your home once; jobs sort by how close they are to you."],
  ["🔎", "Filters + saved searches", "Category, radius, keyword — save a search and get a buzz when a match is posted."],
  ["❤", "Save & compare", "Bookmark jobs, see who else has offered, send your price in one tap."],
  ["★", "Direct invites", "Employers can invite you to a specific job — it lands with a star badge."],
], SAGE7);
productSlide("Product · Post a job", "Post in under a minute, with a live preview.", "screen_postjob.png", [
  ["⚡", "Two-minute posting", "Title, category, price, suburb — optional photos, GPS pin, urgency flag."],
  ["👥", "Single worker or a crew", "Need 3 people for a move? Set a crew size; the post stays open until it's filled."],
  ["⏰", "Due-by + payment choice", "Set a deadline; choose cash or EFT on completion. Workers see it upfront."],
  ["🪞", "Live preview", "See exactly what workers will see in their feed as you type."],
]);
productSlide("Product · Offers & the job", "Accept the price, or let workers counter.", "screen_jobdetail.png", [
  ["🤝", "Accept or counter-offer", "Workers accept your price in one tap or send their own with a note."],
  ["✓", "Verified-only filter", "Filter incoming offers to Verified or Gold-badged workers."],
  ["🔄", "Clear job lifecycle", "On-my-way → started → done → confirmed, with status both sides can see."],
  ["💬", "In-app chat with photos", "Message + share before/after photos — only after someone's hired."],
], SAGE7);

// =================================================================
// 9 — EMPLOYER WALKTHROUGH
// =================================================================
function walk(eb, ttl, steps, accent) {
  s = p.addSlide(); contentBG(s);
  eyebrow(s, eb, accent);
  title(s, ttl, { size: 28 });
  const cw = (W - M * 2 - 0.5 * 4) / 5;
  steps.forEach((st, i) => {
    const x = M + i * (cw + 0.5);
    card(s, x, 2.6, cw, 3.6, { fill: PAPER, shadow: softShadow });
    s.addShape(p.ShapeType.roundRect, { x: x + cw / 2 - 0.35, y: 2.85, w: 0.7, h: 0.7, rectRadius: 0.35, fill: { color: accent }, line: { type: "none" } });
    s.addText(String(i + 1), { x: x + cw / 2 - 0.35, y: 2.85, w: 0.7, h: 0.7, fontFace: HEAD, fontSize: 22, bold: true, color: CREAM, align: "center", valign: "middle" });
    s.addText(st[0], { x: x + 0.18, y: 3.75, w: cw - 0.36, h: 0.7, fontFace: HEAD, fontSize: 14.5, bold: true, color: INK, align: "center", lineSpacing: 17 });
    s.addText(st[1], { x: x + 0.18, y: 4.5, w: cw - 0.36, h: 1.6, fontFace: BODY, fontSize: 11.5, color: INKSOFT, align: "center", lineSpacing: 15 });
  });
}
walk("Walkthrough · Employer", "From “I need this done” to done — in 5 steps.", [
  ["Post the job", "Describe it, suggest a price, optionally pin the spot and add photos."],
  ["Review offers", "Workers nearby respond. See ratings, badges, completed-job counts."],
  ["Accept who you trust", "One tap. Other offers are politely declined; chat opens up."],
  ["Track the work", "See on-the-way → started, message, live location, SOS if needed."],
  ["Confirm & rate", "Pay cash or EFT on completion, confirm, leave an honest rating."],
], OCHRE6);

// 10 — WORKER WALKTHROUGH
walk("Walkthrough · Worker", "From sign-up to paid — in 5 steps.", [
  ["Sign up + verify", "SA ID, selfie video, proof of address, skills. Reviewed by a person."],
  ["Browse work nearby", "Filter by category + distance. Save searches for instant alerts."],
  ["Send an offer", "Accept the price or counter with your own + a short pitch."],
  ["Do the job", "Tap on-my-way, then started. Share before/after photos in chat."],
  ["Get paid + rated", "Mark done, employer confirms, you both rate. Keep 100% at launch."],
], SAGE7);

// =================================================================
// 11 — TRUST & SAFETY
// =================================================================
s = p.addSlide(); contentBG(s);
eyebrow(s, "Trust & safety", BRICK);
title(s, "Safety isn't a feature. It's the foundation.", { size: 26 });
const safety = [
  ["🪪", "Human verification", "SA ID + selfie video + proof of address, reviewed by a real person. Verified & Gold (police-cleared) tiers."],
  ["⭐", "Two-way ratings", "Both sides rate every job. Reputation badges. Bad actors don't last."],
  ["📍", "Live location", "Workers share live GPS on the day; employers watch them arrive."],
  ["🆘", "Emergency button", "One tap dials SAPS 10111 from inside any active job — logged."],
  ["⚖", "Disputes", "Either side can freeze a job; an admin reviews chat, photos, ratings."],
  ["🛡", "Moderation engine", "Auto image scanning (Vision), text screening, rate-limits, user reports, CSAM auto-escalation."],
];
safety.forEach((sf, i) => {
  const x = M + (i % 3) * 4.06, y = 2.45 + Math.floor(i / 3) * 2.12;
  card(s, x, y, 3.8, 1.95, { fill: PAPER, shadow: softShadow });
  s.addShape(p.ShapeType.roundRect, { x: x + 0.25, y: y + 0.25, w: 0.6, h: 0.6, rectRadius: 0.3, fill: { color: i >= 3 ? OCHRE50 : SAGE100 }, line: { type: "none" } });
  s.addText(sf[0], { x: x + 0.25, y: y + 0.25, w: 0.6, h: 0.6, fontSize: 17, align: "center", valign: "middle" });
  s.addText(sf[1], { x: x + 1.0, y: y + 0.28, w: 2.7, h: 0.55, fontFace: HEAD, fontSize: 14.5, bold: true, color: INK, lineSpacing: 16 });
  s.addText(sf[2], { x: x + 0.25, y: y + 0.95, w: 3.35, h: 0.9, fontFace: BODY, fontSize: 11, color: INKSOFT, lineSpacing: 14 });
});

// =================================================================
// 12 — CREW JOBS (differentiator)
// =================================================================
s = p.addSlide(); contentBG(s);
eyebrow(s, "Differentiator");
title(s, "Crew jobs: hire a whole team in one post.", { size: 26 });
s.addText("Moving day, event staff, a queue-standing team — set how many workers you need and Workit keeps the post open until the crew is full.",
  { x: M, y: 1.95, w: 11.8, h: 0.8, fontFace: BODY, fontSize: 15, color: INKSOFT, lineSpacing: 21 });
const crew = [
  ["Set a crew size", "Need 1 or need 20. The job shows “1 of 3 hired” to everyone."],
  ["Per-worker lifecycle", "Each crew member has their own on-the-way / done / confirmed — and own agreed price."],
  ["One group chat", "Employer + the whole crew coordinate in a single thread."],
  ["Slots auto-reopen", "If someone drops out, their spot reopens for new offers automatically."],
];
crew.forEach((c, i) => {
  const x = M + (i % 2) * 6.0, y = 3.0 + Math.floor(i / 2) * 1.75;
  card(s, x, y, 5.6, 1.55, { fill: PAPER, shadow: softShadow });
  s.addText(["①", "②", "③", "④"][i], { x: x + 0.25, y: y + 0.2, w: 0.6, h: 0.6, fontFace: HEAD, fontSize: 22, bold: true, color: OCHRE6 });
  s.addText(c[0], { x: x + 0.95, y: y + 0.24, w: 4.5, h: 0.4, fontFace: HEAD, fontSize: 16, bold: true, color: INK });
  s.addText(c[1], { x: x + 0.95, y: y + 0.66, w: 4.5, h: 0.8, fontFace: BODY, fontSize: 12, color: INKSOFT, lineSpacing: 15 });
});

// =================================================================
// 13 — ENGAGEMENT / NOTIFICATIONS
// =================================================================
s = p.addSlide(); contentBG(s);
eyebrow(s, "Engagement", SAGE7);
title(s, "We bring people back — for free.", { size: 28 });
const eng = [
  ["🔔", "Web push (FCM)", "Free Firebase push: offers, accepted jobs, confirmations buzz the phone even when Workit is closed."],
  ["💾", "Saved-search alerts", "“Gardening within 5 km of Linden” → instant toast the moment a match is posted."],
  ["★", "Direct invites", "Found a worker you like? Invite them to a job; they get a personal notification."],
  ["✉", "Email fallback", "SendGrid emails for every key event, so nothing important is missed."],
];
eng.forEach((e, i) => {
  const x = M + (i % 2) * 6.0, y = 2.4 + Math.floor(i / 2) * 1.9;
  card(s, x, y, 5.6, 1.65, { fill: PAPER, shadow: softShadow });
  s.addShape(p.ShapeType.roundRect, { x: x + 0.25, y: y + 0.25, w: 0.6, h: 0.6, rectRadius: 0.3, fill: { color: SAGE100 }, line: { type: "none" } });
  s.addText(e[0], { x: x + 0.25, y: y + 0.25, w: 0.6, h: 0.6, fontSize: 16, align: "center", valign: "middle" });
  s.addText(e[1], { x: x + 1.0, y: y + 0.26, w: 4.4, h: 0.4, fontFace: HEAD, fontSize: 16, bold: true, color: INK });
  s.addText(e[2], { x: x + 1.0, y: y + 0.66, w: 4.45, h: 0.9, fontFace: BODY, fontSize: 11.5, color: INKSOFT, lineSpacing: 15 });
});
card(s, M, 6.25, 11.93, 0.72, { fill: OCHRE50, line: OCHRE });
s.addText([{ text: "Next up:  ", options: { bold: true, color: OCHRE6 } },
  { text: "WhatsApp + SMS notifications — the unlock for reaching prepaid users with data off.", options: { color: INKSOFT } }],
  { x: M + 0.3, y: 6.25, w: 11.3, h: 0.72, fontFace: BODY, fontSize: 13, valign: "middle", italic: true });

// =================================================================
// 14 — ADMIN & OPS
// =================================================================
s = p.addSlide(); contentBG(s);
eyebrow(s, "Operations");
title(s, "A real admin cockpit, not a spreadsheet.", { size: 26 });
s.addImage({ path: A("screen_admin.png"), x: M, y: 1.95, w: 7.4, h: 4.6, sizing: { type: "contain", w: 7.4, h: 4.6 } });
const ops = [
  ["Overview & trends", "Live KPIs + 30-day sparklines for signups, jobs, completions, disputes."],
  ["Moderation queue", "Reports + auto-flags in one place; warn / remove / suspend / ban."],
  ["Heatmap + suburbs", "Where the work is, with a clickable suburb drill-down."],
  ["Verification & re-verify", "Approve IDs, award the Gold badge, re-review re-submissions."],
  ["Audit log", "Every admin action recorded — accountability built in."],
];
ops.forEach((o, i) => {
  const y = 2.05 + i * 0.97;
  s.addText("▸", { x: 8.35, y, w: 0.3, h: 0.3, fontFace: BODY, fontSize: 13, bold: true, color: OCHRE6 });
  s.addText(o[0], { x: 8.65, y: y - 0.02, w: 4.0, h: 0.35, fontFace: HEAD, fontSize: 14.5, bold: true, color: INK });
  s.addText(o[1], { x: 8.65, y: y + 0.34, w: 4.1, h: 0.6, fontFace: BODY, fontSize: 11, color: INKSOFT, lineSpacing: 14 });
});

// =================================================================
// 15 — TECH & ARCHITECTURE
// =================================================================
s = p.addSlide(); s.background = { color: INK };
eyebrow(s, "Under the hood", OCHRE);
s.addText("Built to scale, hosted in South Africa.", { x: M, y: 0.85, w: 11.9, h: 0.8, fontFace: HEAD, fontSize: 28, bold: true, color: CREAM });
const layers = [
  ["CLIENT", "Next.js 16 PWA", "React, Tailwind v4, offline-first, installable. i18n-ready for all 11 official languages.", OCHRE],
  ["AUTH", "Firebase Auth", "Phone OTP + email/password. Link both to one account.", SAGE],
  ["DATA", "Cloud Firestore", "Real-time jobs, offers, chat, ratings, disputes. Security rules enforce every access.", OCHRE],
  ["LOGIC", "13 Cloud Functions", "Email, push, ratings, moderation, text screen, rate-limit, verification — all in africa-south1.", SAGE],
  ["STORAGE", "Firebase Storage", "Photos, videos, CVs, verification docs. Auto image moderation via Google Vision.", OCHRE],
];
layers.forEach((l, i) => {
  const y = 1.85 + i * 1.05;
  card(s, M, y, 11.93, 0.92, { fill: INK2, line: "3A2C22" });
  s.addText(l[0], { x: M + 0.3, y, w: 1.5, h: 0.92, fontFace: BODY, fontSize: 11, bold: true, color: l[3], charSpacing: 2, valign: "middle" });
  s.addText(l[1], { x: M + 1.9, y, w: 3.0, h: 0.92, fontFace: HEAD, fontSize: 16, bold: true, color: CREAM, valign: "middle" });
  s.addText(l[2], { x: M + 5.0, y: y + 0.08, w: 6.7, h: 0.78, fontFace: BODY, fontSize: 12, color: "C9B9A8", valign: "middle", lineSpacing: 15 });
});
s.addText("africa-south1 (Johannesburg) region · scheduled backups · Sentry-ready error monitoring",
  { x: M, y: 7.05, w: 11.9, h: 0.35, fontFace: BODY, fontSize: 11.5, italic: true, color: "9C8A78" });

// =================================================================
// 16 — BUILT & SHIPPED
// =================================================================
s = p.addSlide(); contentBG(s);
eyebrow(s, "Status", SAGE7);
title(s, "Not a concept — a working product, live today.", { size: 25 });
card(s, M, 1.95, 5.7, 4.9, { fill: INK });
s.addText("Shipped & live", { x: M + 0.35, y: 2.15, w: 5, h: 0.4, fontFace: HEAD, fontSize: 17, bold: true, color: OCHRE });
const shipped = ["Two-sided marketplace end-to-end", "Phone + email auth, account approval", "Worker verification + Gold badge", "Crew (multi-worker) jobs", "In-app chat with photo sharing", "Live location + SAPS emergency", "Disputes + full moderation suite", "Web push + saved-search alerts", "Admin dashboard, heatmap, audit log", "Worker portfolios + public profiles"];
shipped.forEach((t, i) => {
  const y = 2.6 + i * 0.41;
  s.addText("✓", { x: M + 0.35, y, w: 0.3, h: 0.35, fontFace: BODY, fontSize: 12, bold: true, color: SAGE });
  s.addText(t, { x: M + 0.7, y, w: 5.0, h: 0.35, fontFace: BODY, fontSize: 12.5, color: "E8DCCB" });
});
card(s, 6.63, 1.95, 6.0, 4.9, { fill: PAPER, shadow: softShadow });
s.addText("By the numbers", { x: 6.95, y: 2.15, w: 5, h: 0.4, fontFace: HEAD, fontSize: 17, bold: true, color: INK });
const nums = [["13", "Cloud Functions in production"], ["11", "job categories at launch"], ["24+", "screens / routes shipped"], ["3", "verification tiers (None → Verified → Gold)"], ["100%", "of agreed price kept by workers at launch"]];
nums.forEach((n, i) => {
  const y = 2.7 + i * 0.82;
  s.addText(n[0], { x: 6.95, y, w: 1.5, h: 0.7, fontFace: HEAD, fontSize: 30, bold: true, color: OCHRE6, valign: "middle" });
  s.addText(n[1], { x: 8.5, y, w: 3.9, h: 0.7, fontFace: BODY, fontSize: 12.5, color: INKSOFT, valign: "middle", lineSpacing: 15 });
});

// =================================================================
// 17 — MONETIZATION MODEL
// =================================================================
s = p.addSlide(); contentBG(s);
eyebrow(s, "Monetization", OCHRE6);
title(s, "Free to grow. Built to earn.", { size: 28 });
s.addText("Launch free to win liquidity and trust. Then layer revenue where it adds value — never taxing a worker's first rand.",
  { x: M, y: 1.9, w: 11.8, h: 0.55, fontFace: BODY, fontSize: 14, color: INKSOFT, lineSpacing: 19 });
const streams = [
  ["1", "Transaction fee", "A small % service fee on each completed job once liquidity is healthy. Employer-side, so workers keep their rate.", OCHRE6],
  ["2", "Workit Plus", "Monthly subscription for power employers: priority placement, scheduled & recurring jobs, team accounts.", SAGE7],
  ["3", "Featured & urgent", "Pay to boost a post to the top of the feed or flag it urgent — pay-per-boost, fully optional.", OCHRE6],
  ["4", "Background checks", "Paid police-clearance / ID verification for the Gold badge, in partnership with a screening provider.", SAGE7],
  ["5", "Value-add services", "Job insurance, instant EFT payouts via a banking partner, materials financing — revenue-share.", OCHRE6],
  ["6", "B2B / SME plans", "Small businesses booking regular labour: dashboards, invoicing, preferred-worker pools.", SAGE7],
];
streams.forEach((st, i) => {
  const x = M + (i % 3) * 4.06, y = 2.6 + Math.floor(i / 3) * 2.1;
  card(s, x, y, 3.8, 1.9, { fill: PAPER, shadow: softShadow });
  s.addShape(p.ShapeType.roundRect, { x: x + 0.25, y: y + 0.25, w: 0.55, h: 0.55, rectRadius: 0.27, fill: { color: st[3] }, line: { type: "none" } });
  s.addText(st[0], { x: x + 0.25, y: y + 0.25, w: 0.55, h: 0.55, fontFace: HEAD, fontSize: 18, bold: true, color: CREAM, align: "center", valign: "middle" });
  s.addText(st[1], { x: x + 0.95, y: y + 0.26, w: 2.75, h: 0.5, fontFace: HEAD, fontSize: 15, bold: true, color: INK, lineSpacing: 17 });
  s.addText(st[2], { x: x + 0.25, y: y + 0.9, w: 3.35, h: 0.95, fontFace: BODY, fontSize: 10.8, color: INKSOFT, lineSpacing: 13.5 });
});

// =================================================================
// 18 — MONETIZATION NUMBERS (chart)
// =================================================================
s = p.addSlide(); contentBG(s);
eyebrow(s, "Monetization · the math", OCHRE6);
title(s, "How small fees compound into a real business.", { size: 24 });
// Grouped bar chart drawn with shapes (NOT a native chart object).
// A native chart embeds an Excel workbook, which is fragile and was making
// PowerPoint prompt "found a problem with content" → Repair. Shapes are bullet-
// proof and render identically.
const years = ["Year 1", "Year 2", "Year 3"];
const gmv = [6, 34, 120];
const rev = [0.2, 3.1, 14];
const cx = M, cy = 2.35, cw = 7.0, ch = 4.05;
const baseY = cy + ch - 0.55;     // x-axis baseline
const plotH = ch - 0.95;          // usable vertical space for bars
const maxV = 120;
// horizontal gridlines + y-axis labels
[0, 30, 60, 90, 120].forEach((g) => {
  const gy = baseY - (g / maxV) * plotH;
  s.addShape(p.ShapeType.line, { x: cx + 0.55, y: gy, w: cw - 0.55, h: 0, line: { color: LINE, width: 1 } });
  s.addText("R" + g + "m", { x: cx - 0.2, y: gy - 0.13, w: 0.65, h: 0.26, fontFace: BODY, fontSize: 8.5, color: INKMUT, align: "right" });
});
// baseline
s.addShape(p.ShapeType.line, { x: cx + 0.55, y: baseY, w: cw - 0.55, h: 0, line: { color: INKMUT, width: 1.25 } });
// bars per year
const groupW = (cw - 0.55) / 3;
years.forEach((yr, i) => {
  const gx = cx + 0.55 + i * groupW + groupW * 0.16;
  const bw = groupW * 0.3;
  [[gmv[i], OCHRE, OCHRE6], [rev[i], SAGE, SAGE7]].forEach((pr, j) => {
    const h = Math.max(0.04, (pr[0] / maxV) * plotH);
    const bx = gx + j * (bw + 0.14);
    s.addShape(p.ShapeType.roundRect, { x: bx, y: baseY - h, w: bw, h, rectRadius: 0.03, fill: { color: pr[1] }, line: { type: "none" } });
    s.addText(pr[0] % 1 ? pr[0].toFixed(1) : String(pr[0]), { x: bx - 0.2, y: baseY - h - 0.27, w: bw + 0.4, h: 0.25, fontFace: BODY, fontSize: 9, bold: true, color: pr[2], align: "center" });
  });
  s.addText(yr, { x: gx - 0.25, y: baseY + 0.08, w: groupW * 0.6 + 0.5, h: 0.3, fontFace: BODY, fontSize: 11, color: INKSOFT, align: "center" });
});
// legend
s.addShape(p.ShapeType.rect, { x: cx + 0.6, y: cy + ch + 0.02, w: 0.28, h: 0.18, fill: { color: OCHRE }, line: { type: "none" } });
s.addText("GMV (R, millions)", { x: cx + 0.95, y: cy + ch - 0.06, w: 2.4, h: 0.32, fontFace: BODY, fontSize: 10.5, color: INKSOFT, valign: "middle" });
s.addShape(p.ShapeType.rect, { x: cx + 3.4, y: cy + ch + 0.02, w: 0.28, h: 0.18, fill: { color: SAGE }, line: { type: "none" } });
s.addText("Net revenue (R, millions)", { x: cx + 3.75, y: cy + ch - 0.06, w: 3.0, h: 0.32, fontFace: BODY, fontSize: 10.5, color: INKSOFT, valign: "middle" });
// unit economics rail
const ue = [["~8%", "blended take rate at maturity (employer-side)"], ["R 260", "avg job value (illustrative)"], ["3–5×", "target worker-to-job liquidity per suburb"], ["R0", "CAC at launch — WhatsApp & referral led"]];
ue.forEach((u, i) => {
  const y = 2.25 + i * 1.12;
  card(s, 8.05, y, 4.6, 0.98, { fill: PAPER, shadow: softShadow });
  s.addText(u[0], { x: 8.3, y, w: 1.5, h: 0.98, fontFace: HEAD, fontSize: 24, bold: true, color: OCHRE6, valign: "middle" });
  s.addText(u[1], { x: 9.85, y: y + 0.08, w: 2.6, h: 0.82, fontFace: BODY, fontSize: 11.5, color: INKSOFT, valign: "middle", lineSpacing: 14 });
});
s.addText("Figures are illustrative planning scenarios, not forecasts — shown to demonstrate the model's shape.",
  { x: M, y: 6.95, w: 11.9, h: 0.35, fontFace: BODY, fontSize: 10.5, italic: true, color: INKMUT });

// =================================================================
// 19 — GO TO MARKET
// =================================================================
s = p.addSlide(); contentBG(s);
eyebrow(s, "Go to market", SAGE7);
title(s, "Win one suburb at a time.", { size: 28 });
s.addText("Marketplaces live or die on local liquidity. We saturate a handful of Gauteng suburbs before widening — density first, geography second.",
  { x: M, y: 1.9, w: 11.8, h: 0.7, fontFace: BODY, fontSize: 14.5, color: INKSOFT, lineSpacing: 20 });
const gtm = [
  ["🎯", "Beachhead", "3–5 Gauteng suburbs. Hit 3–5 workers per open job before expanding the next block."],
  ["🔁", "Built-in growth loops", "One-tap WhatsApp job sharing + referral codes turn every user into a recruiter."],
  ["🤝", "Trust as the wedge", "Verification + ratings make employers comfortable letting strangers into their homes."],
  ["🌍", "Then province by province", "Replicate the playbook: KZN, Western Cape, Eastern Cape."],
];
gtm.forEach((g, i) => {
  const x = M + (i % 2) * 6.0, y = 2.75 + Math.floor(i / 2) * 1.85;
  card(s, x, y, 5.6, 1.6, { fill: PAPER, shadow: softShadow });
  s.addShape(p.ShapeType.roundRect, { x: x + 0.25, y: y + 0.25, w: 0.6, h: 0.6, rectRadius: 0.3, fill: { color: SAGE100 }, line: { type: "none" } });
  s.addText(g[0], { x: x + 0.25, y: y + 0.25, w: 0.6, h: 0.6, fontSize: 17, align: "center", valign: "middle" });
  s.addText(g[1], { x: x + 1.0, y: y + 0.24, w: 4.4, h: 0.4, fontFace: HEAD, fontSize: 15.5, bold: true, color: INK });
  s.addText(g[2], { x: x + 1.0, y: y + 0.64, w: 4.45, h: 0.85, fontFace: BODY, fontSize: 11.5, color: INKSOFT, lineSpacing: 14.5 });
});

// =================================================================
// 20 — ROADMAP
// =================================================================
s = p.addSlide(); contentBG(s);
eyebrow(s, "Roadmap");
title(s, "Where Workit goes next.", { size: 28 });
const phases = [
  ["NOW — Live", OCHRE6, ["MVP shipped & in production", "Full trust + safety suite", "Crew jobs, portfolios, push", "Gauteng launch-ready"]],
  ["NEXT — 0–6 months", SAGE7, ["WhatsApp + SMS notifications", "Payments & escrow (cash → digital)", "First ops / community hire", "Suburb saturation in Gauteng"]],
  ["LATER — 6–18 months", INK, ["Native Android app", "Instant payouts via bank partner", "Job insurance + background checks", "Province-by-province rollout", "isiZulu / Sesotho translations"]],
];
phases.forEach((ph, i) => {
  const x = M + i * 4.06;
  card(s, x, 2.5, 3.8, 4.3, { fill: i === 2 ? INK : PAPER, shadow: softShadow, line: i === 2 ? INK : LINE });
  s.addText(ph[0], { x: x + 0.3, y: 2.75, w: 3.2, h: 0.5, fontFace: HEAD, fontSize: 15, bold: true, color: i === 2 ? OCHRE : ph[1] });
  s.addShape(p.ShapeType.line, { x: x + 0.3, y: 3.3, w: 3.2, h: 0, line: { color: i === 2 ? "3A2C22" : LINE, width: 1 } });
  ph[2].forEach((t, j) => {
    const y = 3.5 + j * 0.62;
    s.addText("•", { x: x + 0.3, y, w: 0.2, h: 0.5, fontFace: BODY, fontSize: 14, bold: true, color: i === 2 ? OCHRE : ph[1] });
    s.addText(t, { x: x + 0.55, y, w: 3.05, h: 0.6, fontFace: BODY, fontSize: 12, color: i === 2 ? "E8DCCB" : INKSOFT, lineSpacing: 14.5 });
  });
});

// =================================================================
// 21 — THE ASK (funding request overview)
// =================================================================
s = p.addSlide(); contentBG(s);
eyebrow(s, "The ask", OCHRE6);
title(s, "What we're raising — and what it unlocks.", { size: 25 });
s.addText("The product is built, deployed and live. This is growth capital — to win local liquidity in Gauteng and prove the model. Two scenarios, same playbook:",
  { x: M, y: 1.95, w: 11.9, h: 0.6, fontFace: BODY, fontSize: 14, color: INKSOFT, lineSpacing: 19 });
const tiers = [
  { tag: "Minimum — lean launch", amt: "R100,000", runway: "≈ 6 months runway · founder-led",
    fill: PAPER, fg: INK, accent: OCHRE6, sub: INKSOFT,
    pts: ["Launch in 3 Gauteng suburbs", "500–1,000 verified workers onboarded", "Prove liquidity: 3–5 offers per job", "First paying transactions live"] },
  { tag: "Target — accelerated scale", amt: "R500,000", runway: "≈ 12 months runway · first small team",
    fill: INK, fg: CREAM, accent: OCHRE, sub: "CDBBA8",
    pts: ["10+ suburbs across Gauteng", "~5,000 workers · payments + escrow", "First hires: 1 dev + 1 ops/community", "WhatsApp/SMS · positioned for seed round"] },
];
tiers.forEach((t, i) => {
  const x = M + i * 6.06;
  card(s, x, 2.75, 5.87, 4.05, { fill: t.fill, shadow: softShadow, line: t.fill === INK ? INK : LINE });
  s.addText(t.tag.toUpperCase(), { x: x + 0.35, y: 2.95, w: 5.2, h: 0.3, fontFace: BODY, fontSize: 11, bold: true, color: t.accent, charSpacing: 2 });
  s.addText(t.amt, { x: x + 0.32, y: 3.22, w: 5.2, h: 0.85, fontFace: HEAD, fontSize: 44, bold: true, color: t.fg });
  s.addText(t.runway, { x: x + 0.35, y: 4.08, w: 5.2, h: 0.35, fontFace: BODY, fontSize: 12, italic: true, color: t.sub });
  t.pts.forEach((pt, j) => {
    const y = 4.6 + j * 0.5;
    s.addText("✓", { x: x + 0.35, y, w: 0.3, h: 0.38, fontFace: BODY, fontSize: 12, bold: true, color: t.accent, valign: "middle" });
    s.addText(pt, { x: x + 0.72, y, w: 4.95, h: 0.38, fontFace: BODY, fontSize: 12, color: t.fill === INK ? "E8DCCB" : INKSOFT, valign: "middle" });
  });
});

// =================================================================
// 22–23 — BUDGET BREAKDOWNS
// =================================================================
function budgetSlide(eb, ttl, sub, rows, totalLabel, totalSub) {
  s = p.addSlide(); contentBG(s);
  eyebrow(s, eb, OCHRE6);
  title(s, ttl, { size: 25 });
  s.addText(sub, { x: M, y: 1.95, w: 11.9, h: 0.5, fontFace: BODY, fontSize: 13, italic: true, color: INKSOFT, lineSpacing: 17 });
  const top = 2.55, step = rows.length > 6 ? 0.58 : 0.64;
  const maxPct = Math.max(...rows.map((r) => r[1]));
  const barX = 5.4, barMaxW = 4.2, amtX = 9.75, pctX = 11.45;
  rows.forEach((r, i) => {
    const y = top + i * step;
    s.addText(r[0], { x: M, y, w: 4.55, h: step - 0.06, fontFace: BODY, fontSize: 12.5, color: INK, valign: "middle" });
    s.addShape(p.ShapeType.roundRect, { x: barX, y: y + step / 2 - 0.13, w: barMaxW, h: 0.22, rectRadius: 0.11, fill: { color: CREAM2 }, line: { type: "none" } });
    const bw = Math.max(0.18, (r[1] / maxPct) * barMaxW);
    s.addShape(p.ShapeType.roundRect, { x: barX, y: y + step / 2 - 0.13, w: bw, h: 0.22, rectRadius: 0.11, fill: { color: i % 2 ? SAGE : OCHRE }, line: { type: "none" } });
    s.addText(r[2], { x: amtX, y, w: 1.6, h: step - 0.06, fontFace: HEAD, fontSize: 13, bold: true, color: INK, align: "right", valign: "middle" });
    s.addText(r[1] + "%", { x: pctX, y, w: 1.1, h: step - 0.06, fontFace: BODY, fontSize: 11, color: INKMUT, align: "right", valign: "middle" });
  });
  const ty = top + rows.length * step + 0.12;
  card(s, M, ty, 11.93, 0.62, { fill: INK });
  s.addText("TOTAL", { x: M + 0.35, y: ty, w: 2, h: 0.62, fontFace: BODY, fontSize: 12, bold: true, color: OCHRE, charSpacing: 2, valign: "middle" });
  s.addText(totalLabel, { x: M + 2.0, y: ty, w: 3.0, h: 0.62, fontFace: HEAD, fontSize: 20, bold: true, color: CREAM, valign: "middle" });
  s.addText(totalSub, { x: 6.8, y: ty, w: 5.8, h: 0.62, fontFace: BODY, fontSize: 11.5, italic: true, color: "CDBBA8", align: "right", valign: "middle" });
}

budgetSlide(
  "Budget · R100,000",
  "R100,000 — minimum lean-launch budget.",
  "A six-month, founder-led runway to prove liquidity in the first Gauteng suburbs. Every rand goes to demand, supply, and keeping the platform running.",
  [
    ["Marketing & user acquisition", 30, "R 30,000"],
    ["Trust & safety / verification ops", 18, "R 18,000"],
    ["Field ops & community ambassadors", 16, "R 16,000"],
    ["Contingency / working capital", 15, "R 15,000"],
    ["Cloud infrastructure & services", 12, "R 12,000"],
    ["Legal & compliance (POPIA, contracts)", 9, "R 9,000"],
  ],
  "R100,000",
  "≈ 6 months · 3 suburbs · 500–1,000 verified workers",
);

budgetSlide(
  "Budget · R500,000",
  "R500,000 — accelerated-scale budget.",
  "A twelve-month runway with the first small team. Adds engineering capacity, payments and a real growth engine on top of everything the R100k plan already covers.",
  [
    ["Engineering (contract dev + tooling)", 26, "R 130,000"],
    ["Marketing & growth", 26, "R 130,000"],
    ["Field ops & community ambassador team", 13, "R 65,000"],
    ["Trust & safety / verification ops", 12, "R 60,000"],
    ["Cloud infrastructure & scaling", 8, "R 40,000"],
    ["Contingency / working capital", 8, "R 40,000"],
    ["Legal, compliance & insurance", 7, "R 35,000"],
  ],
  "R500,000",
  "≈ 12 months · 10+ suburbs · ~5,000 workers · payments live",
);

// =================================================================
// 24 — CLOSING
// =================================================================
s = p.addSlide(); s.background = { color: INK };
beadwork(s, 0.0);
s.addText("THE VISION", { x: M, y: 1.6, w: 9, h: 0.4, fontFace: BODY, fontSize: 14, bold: true, color: OCHRE, charSpacing: 5 });
s.addText("Dignified work,\none job at a time.", { x: M - 0.05, y: 2.1, w: 11.5, h: 2.0, fontFace: HEAD, fontSize: 52, bold: true, color: CREAM, lineSpacing: 50 });
s.addText("A South African platform that turns the country's biggest problem — joblessness — into its biggest marketplace. Trust-first, mobile-first, built for the people who need it most.",
  { x: M, y: 4.5, w: 9.5, h: 1.1, fontFace: BODY, fontSize: 16, color: "CDBBA8", lineSpacing: 23 });
card(s, M, 5.9, 11.93, 0.95, { fill: INK2, line: "3A2C22" });
s.addText([
  { text: "Workit", options: { bold: true, color: OCHRE, fontFace: HEAD, fontSize: 16 } },
  { text: "   ·   workitsa.co.za   ·   Tshepo M   ·   tshepowayne2@gmail.com   ·   Furthersky Solutions", options: { color: "CDBBA8", fontFace: BODY, fontSize: 13 } },
], { x: M + 0.35, y: 5.9, w: 11.2, h: 0.95, valign: "middle" });

p.writeFile({ fileName: path.join(__dirname, "Workit-System-Deck.pptx") }).then((f) => console.log("WROTE", f));
