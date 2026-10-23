/* Workit — system SHOWCASE deck (~14 slides) for the 30 Sep 2026 credibility
   meeting. Walks through every important step. Reuses the Workit brand look +
   phone mockups from build_deck.js. */
const pptxgen = require("pptxgenjs");
const path = require("path");
const A = (f) => path.join(__dirname, "assets", f);
const p = new pptxgen();
p.defineLayout({ name: "W", width: 13.333, height: 7.5 });
p.layout = "W";
p.author = "Workit / Futhersky Solutions";
p.company = "Workit";

const INK = "1F1612", INK2 = "2A1F17", CREAM = "FAF4EC", CREAM2 = "F1E7D6",
  PAPER = "FFFFFF", OCHRE = "D97742", OCHRE6 = "B85A2A", OCHRE50 = "FBEEE2",
  SAGE = "5D7A47", SAGE7 = "46603A", SAGE100 = "E7EEDF", LINE = "E3D7C2",
  BRICK = "A93226", INKSOFT = "4A3A30", INKMUT = "8A7868";
const HEAD = "Georgia", BODY = "Calibri";
const W = 13.333, H = 7.5, M = 0.7;
const softShadow = { type: "outer", color: "B9A98F", blur: 8, offset: 3, angle: 90, opacity: 0.35 };

function beadwork(s, y) {
  const cols = [OCHRE, INK, SAGE, CREAM2]; const seg = 0.34; let x = 0, i = 0;
  while (x < W) { s.addShape(p.ShapeType.rect, { x, y, w: seg, h: 0.12, fill: { color: cols[i % 4] }, line: { type: "none" } }); x += seg; i++; }
}
function eyebrow(s, text, color = OCHRE6, x = M, y = 0.55) {
  s.addText(text.toUpperCase(), { x, y, w: 11, h: 0.3, fontFace: BODY, fontSize: 12, bold: true, color, charSpacing: 3 });
}
function title(s, text, opts = {}) {
  s.addText(text, { x: opts.x ?? M, y: opts.y ?? 0.85, w: opts.w ?? 11.9, h: opts.h ?? 1.0, fontFace: HEAD, fontSize: opts.size ?? 32, bold: true, color: opts.color ?? INK, align: "left", lineSpacing: opts.ls });
}
function contentBG(s) { s.background = { color: CREAM }; }
function card(s, x, y, w, h, opts = {}) {
  s.addShape(p.ShapeType.roundRect, { x, y, w, h, rectRadius: opts.r ?? 0.12, fill: { color: opts.fill ?? PAPER }, line: { color: opts.line ?? LINE, width: 1 }, shadow: opts.shadow });
}

// 1 — COVER
let s = p.addSlide(); s.background = { color: INK };
s.addImage({ path: A("screen_home.png"), x: 9.6, y: 0.7, h: 6.6, w: 3.33, sizing: { type: "contain", w: 3.33, h: 6.6 } });
s.addText("WORKIT", { x: M, y: 1.55, w: 8, h: 0.4, fontFace: BODY, fontSize: 15, bold: true, color: OCHRE, charSpacing: 6 });
s.addText("How the system\nworks.", { x: M - 0.05, y: 1.95, w: 8.6, h: 2.2, fontFace: HEAD, fontSize: 54, bold: true, color: CREAM, lineSpacing: 52 });
s.addText("A guided walk-through of Workit — South Africa's people-first marketplace for everyday work. From sign-up to paid, every step is built trust-first.",
  { x: M, y: 4.35, w: 8.0, h: 1.1, fontFace: BODY, fontSize: 16, color: "CDBBA8", lineSpacing: 23 });
s.addText([{ text: "A Futhersky Solutions product", options: { bold: true, color: CREAM } }, { text: "    ·    workitsa.co.za    ·    Tshepo M", options: { color: "9C8A78" } }],
  { x: M, y: 6.5, w: 11, h: 0.4, fontFace: BODY, fontSize: 12 });
beadwork(s, 7.18);

// 2 — WHAT IS WORKIT
s = p.addSlide(); contentBG(s);
eyebrow(s, "What is Workit");
title(s, "One trusted place for any everyday work.", { size: 30 });
s.addText("Employers and households post jobs — gardening, cleaning, trades, deliveries, errands, tutoring and more. Nearby ID-verified workers offer, do the job, and both sides rate each other. If it's a task someone needs done, it can be posted.",
  { x: M, y: 1.95, w: 11.9, h: 1.0, fontFace: BODY, fontSize: 15, color: INKSOFT, lineSpacing: 21 });
const pillars = [["🌿", "Broad by design", "One marketplace across 11 categories — not a single niche."],
  ["🛡", "Trust-first", "Every worker human-verified. Two-way ratings on every job."],
  ["📱", "Low-data, mobile-first", "A PWA built for prepaid Android on tight data budgets."],
  ["💵", "Cash or EFT", "Pay on completion — no card or bank account needed to start."]];
pillars.forEach((o, i) => {
  const x = M + (i % 2) * 6.0, y = 3.15 + Math.floor(i / 2) * 1.5;
  card(s, x, y, 5.6, 1.3, { fill: PAPER, shadow: softShadow });
  s.addShape(p.ShapeType.roundRect, { x: x + 0.25, y: y + 0.22, w: 0.55, h: 0.55, rectRadius: 0.27, fill: { color: OCHRE50 }, line: { type: "none" } });
  s.addText(o[0], { x: x + 0.25, y: y + 0.22, w: 0.55, h: 0.55, fontSize: 16, align: "center", valign: "middle" });
  s.addText(o[1], { x: x + 1.0, y: y + 0.2, w: 4.4, h: 0.4, fontFace: HEAD, fontSize: 16, bold: true, color: INK });
  s.addText(o[2], { x: x + 1.0, y: y + 0.6, w: 4.45, h: 0.6, fontFace: BODY, fontSize: 12, color: INKSOFT, lineSpacing: 15 });
});
card(s, M, 6.35, 11.93, 0.68, { fill: SAGE100, line: SAGE });
s.addText([{ text: "Live today:  ", options: { bold: true, color: SAGE7 } },
  { text: "workitsa.co.za  ·  ~90 workers already signed up  ·  every worker human-verified  ·  full safety suite shipped.", options: { color: INKSOFT } }],
  { x: M + 0.3, y: 6.35, w: 11.4, h: 0.68, fontFace: BODY, fontSize: 12.5, italic: true, valign: "middle" });

// 3 — THE LOOP
s = p.addSlide(); contentBG(s);
eyebrow(s, "The loop");
title(s, "Post → offer → hire → do → pay → rate.", { size: 28 });
function node(x, label, sub, fill, fg, icon) {
  card(s, x, 2.8, 3.3, 2.0, { fill, shadow: softShadow, line: fill });
  s.addText(icon, { x, y: 3.05, w: 3.3, h: 0.7, fontSize: 30, align: "center" });
  s.addText(label, { x, y: 3.8, w: 3.3, h: 0.45, fontFace: HEAD, fontSize: 19, bold: true, color: fg, align: "center" });
  s.addText(sub, { x: x + 0.25, y: 4.25, w: 2.8, h: 0.5, fontFace: BODY, fontSize: 11.5, color: fg === CREAM ? "E8DCCB" : INKSOFT, align: "center", lineSpacing: 14 });
}
node(M, "Employer", "Posts a job + a fair price", PAPER, INK, "🛠");
node(5.02, "Workit", "Trust, matching, safety", INK, CREAM, "◆");
node(9.03, "Worker", "Accepts or counters, does the work", PAPER, INK, "💪");
s.addShape(p.ShapeType.line, { x: 4.0, y: 3.6, w: 1.0, h: 0, line: { color: OCHRE, width: 2.5, endArrowType: "triangle", beginArrowType: "triangle" } });
s.addShape(p.ShapeType.line, { x: 8.32, y: 3.6, w: 0.7, h: 0, line: { color: OCHRE, width: 2.5, endArrowType: "triangle", beginArrowType: "triangle" } });
card(s, M, 5.15, 11.93, 1.5, { fill: OCHRE50, line: OCHRE });
s.addText([{ text: "The full loop:  ", options: { bold: true, color: OCHRE6, fontFace: HEAD, fontSize: 15 } },
  { text: "Post → workers offer → employer accepts → worker does the job → cash or EFT on completion → both sides rate each other.", options: { color: INKSOFT, fontFace: BODY, fontSize: 14 } }],
  { x: M + 0.35, y: 5.35, w: 11.2, h: 0.6, lineSpacing: 18 });
s.addText("Free for users during launch — the agreed price is exactly what the worker earns.", { x: M + 0.35, y: 6.05, w: 11.2, h: 0.45, fontFace: BODY, fontSize: 12.5, italic: true, color: SAGE7 });

// STEP SLIDES (device on left, points on right)
function step(eb, ttl, img, feats, accent = OCHRE6) {
  s = p.addSlide(); contentBG(s);
  s.addShape(p.ShapeType.rect, { x: 0, y: 0, w: 4.7, h: H, fill: { color: CREAM2 } });
  s.addImage({ path: A(img), x: 1.0, y: 0.65, h: 6.2, w: 3.13, sizing: { type: "contain", w: 3.13, h: 6.2 } });
  eyebrow(s, eb, accent, 5.1, 0.7);
  s.addText(ttl, { x: 5.1, y: 1.05, w: 7.6, h: 1.0, fontFace: HEAD, fontSize: 27, bold: true, color: INK, lineSpacing: 30 });
  feats.forEach((f, i) => {
    const y = 2.5 + i * 1.05;
    s.addShape(p.ShapeType.roundRect, { x: 5.1, y, w: 0.5, h: 0.5, rectRadius: 0.25, fill: { color: OCHRE50 }, line: { type: "none" } });
    s.addText(f[0], { x: 5.1, y, w: 0.5, h: 0.5, fontSize: 15, align: "center", valign: "middle" });
    s.addText(f[1], { x: 5.78, y: y - 0.04, w: 7.0, h: 0.4, fontFace: HEAD, fontSize: 16, bold: true, color: INK });
    s.addText(f[2], { x: 5.78, y: y + 0.36, w: 7.1, h: 0.62, fontFace: BODY, fontSize: 12.5, color: INKSOFT, lineSpacing: 15 });
  });
}
// 4 — Step 1
step("Step 1 · Trust from day one", "Sign up, then get verified.", "screen_home.png", [
  ["📲", "Quick sign-up", "Phone OTP or email — installable PWA, light on data."],
  ["🪪", "Human verification", "SA ID + selfie video + proof of address, reviewed by a real person."],
  ["🏅", "Verified & Gold tiers", "A police-clearance Gold badge employers can filter for."],
  ["👋", "Role-aware home", "Workers see “find work”; employers see “post a job”."],
]);
// 5 — Step 2
step("Step 2 · Post", "Post a job in under two minutes.", "screen_postjob.png", [
  ["⚡", "Fast posting", "Title, category, price, suburb — optional photos + GPS pin."],
  ["👥", "One worker or a crew", "Set a crew size; the post stays open until it's filled."],
  ["⏰", "Due-by + payment choice", "Set a deadline; choose cash or EFT on completion."],
  ["🪞", "Live preview", "See exactly what workers will see as you type."],
], SAGE7);
// 6 — Step 3
step("Step 3 · Match", "Workers find jobs near them.", "screen_findwork.png", [
  ["📍", "Distance-ranked feed", "Pin your home once; jobs sort by how close they are."],
  ["🔎", "Filters + saved alerts", "Save a search, get a buzz the moment a match is posted."],
  ["🤝", "Accept or counter-offer", "Take the price in one tap, or send your own with a note."],
  ["★", "Direct invites", "Employers can invite a specific worker to a job."],
]);
// 7 — Step 4
step("Step 4 · Hire", "Hire with confidence.", "screen_jobdetail.png", [
  ["✅", "One-tap hire", "Accept an offer; chat opens; others are politely declined."],
  ["🔑", "Doorstep start-code", "The worker enters a code you read out — right person, confirmed."],
  ["🔄", "Clear lifecycle", "On-my-way → started → done → confirmed, visible to both."],
  ["✓", "Verified-only filter", "Only take offers from Verified or Gold workers, if you choose."],
], SAGE7);

// 8 — Step 5 · On the job (safety cards)
s = p.addSlide(); contentBG(s);
eyebrow(s, "Step 5 · On the job", BRICK);
title(s, "Safe on every single job.", { size: 28 });
const onjob = [["💬", "In-app chat + photos", "Coordinate and share before/after photos — only after someone's hired."],
  ["📍", "Live location", "The worker shares live GPS on the day; the employer watches them arrive."],
  ["🆘", "SOS button", "One tap dials SAPS 10111 from inside any active job — logged."],
  ["⚖", "Disputes, handled", "Either side can freeze a job; an admin reviews chat, photos and ratings."]];
onjob.forEach((c, i) => {
  const x = M + (i % 2) * 6.0, y = 2.4 + Math.floor(i / 2) * 1.95;
  card(s, x, y, 5.6, 1.65, { fill: PAPER, shadow: softShadow });
  s.addShape(p.ShapeType.roundRect, { x: x + 0.25, y: y + 0.25, w: 0.6, h: 0.6, rectRadius: 0.3, fill: { color: OCHRE50 }, line: { type: "none" } });
  s.addText(c[0], { x: x + 0.25, y: y + 0.25, w: 0.6, h: 0.6, fontSize: 17, align: "center", valign: "middle" });
  s.addText(c[1], { x: x + 1.0, y: y + 0.26, w: 4.4, h: 0.4, fontFace: HEAD, fontSize: 16, bold: true, color: INK });
  s.addText(c[2], { x: x + 1.0, y: y + 0.66, w: 4.45, h: 0.9, fontFace: BODY, fontSize: 11.5, color: INKSOFT, lineSpacing: 15 });
});

// 9 — Step 6 · Proof of work (highlight new feature)
s = p.addSlide(); contentBG(s);
eyebrow(s, "Step 6 · Proof of work");
title(s, "Real proof — captured live, not uploaded.", { size: 27 });
s.addText("The hardest problem in this market: anyone can post a photo and claim it's their work. Workit closes that gap.",
  { x: M, y: 1.95, w: 11.8, h: 0.7, fontFace: BODY, fontSize: 15, color: INKSOFT, lineSpacing: 20 });
const proof = [["📷", "Camera-only capture", "“After” photos open the camera — no picking an old image from the gallery."],
  ["🕒", "Time-stamped", "Each photo is watermarked with the date & time it was taken."],
  ["🔗", "Tied to the real job", "Evidence is generated on the job — it can't be faked after the fact."],
  ["⭐", "Builds a real portfolio", "Verified completion photos flow to the worker's public profile."]];
proof.forEach((c, i) => {
  const x = M + (i % 2) * 6.0, y = 2.85 + Math.floor(i / 2) * 1.55;
  card(s, x, y, 5.6, 1.3, { fill: PAPER, shadow: softShadow });
  s.addShape(p.ShapeType.roundRect, { x: x + 0.25, y: y + 0.22, w: 0.55, h: 0.55, rectRadius: 0.27, fill: { color: SAGE100 }, line: { type: "none" } });
  s.addText(c[0], { x: x + 0.25, y: y + 0.22, w: 0.55, h: 0.55, fontSize: 15, align: "center", valign: "middle" });
  s.addText(c[1], { x: x + 0.95, y: y + 0.2, w: 4.5, h: 0.4, fontFace: HEAD, fontSize: 15.5, bold: true, color: INK });
  s.addText(c[2], { x: x + 0.95, y: y + 0.6, w: 4.5, h: 0.62, fontFace: BODY, fontSize: 11.5, color: INKSOFT, lineSpacing: 14.5 });
});
card(s, M, 6.35, 11.93, 0.6, { fill: OCHRE50, line: OCHRE });
s.addText("This also gives disputes a real evidence trail — trust you can verify, not just claim.", { x: M + 0.3, y: 6.35, w: 11.4, h: 0.6, fontFace: BODY, fontSize: 12.5, italic: true, color: OCHRE6, valign: "middle" });

// 10 — Step 7 · Paid & rated
s = p.addSlide(); contentBG(s);
eyebrow(s, "Step 7 · Paid & rated", SAGE7);
title(s, "Get paid, then build reputation.", { size: 28 });
const paid = [["💵", "Cash or EFT on completion", "Direct between the parties — no card needed to start earning."],
  ["🤝", "Payment handshake", "“I've paid” ⇄ “I've been paid” confirms it for both sides."],
  ["⭐", "Two-way ratings", "Both sides rate every job — reputation is earned, not bought."],
  ["📈", "Levels that compound", "Ratings, jobs done and badges unlock trust over time. Workers keep 100% at launch."]];
paid.forEach((c, i) => {
  const x = M + (i % 2) * 6.0, y = 2.4 + Math.floor(i / 2) * 1.95;
  card(s, x, y, 5.6, 1.65, { fill: PAPER, shadow: softShadow });
  s.addShape(p.ShapeType.roundRect, { x: x + 0.25, y: y + 0.25, w: 0.6, h: 0.6, rectRadius: 0.3, fill: { color: SAGE100 }, line: { type: "none" } });
  s.addText(c[0], { x: x + 0.25, y: y + 0.25, w: 0.6, h: 0.6, fontSize: 17, align: "center", valign: "middle" });
  s.addText(c[1], { x: x + 1.0, y: y + 0.26, w: 4.4, h: 0.4, fontFace: HEAD, fontSize: 15.5, bold: true, color: INK });
  s.addText(c[2], { x: x + 1.0, y: y + 0.66, w: 4.45, h: 0.9, fontFace: BODY, fontSize: 11.5, color: INKSOFT, lineSpacing: 15 });
});

// 11 — Crew jobs
s = p.addSlide(); contentBG(s);
eyebrow(s, "Differentiator");
title(s, "Crew jobs: hire a whole team in one post.", { size: 26 });
s.addText("Moving day, event staff, a queue-standing team — set how many workers you need and Workit keeps the post open until the crew is full.",
  { x: M, y: 1.9, w: 11.8, h: 0.8, fontFace: BODY, fontSize: 15, color: INKSOFT, lineSpacing: 21 });
const crew = [["Set a crew size", "Need 1 or need 20 — the job shows “1 of 3 hired” to everyone."],
  ["Per-worker lifecycle", "Each member has their own status and their own agreed price."],
  ["One group chat", "Employer + the whole crew coordinate in a single thread."],
  ["Slots auto-reopen", "If someone drops out, their spot reopens for new offers."]];
crew.forEach((c, i) => {
  const x = M + (i % 2) * 6.0, y = 3.0 + Math.floor(i / 2) * 1.75;
  card(s, x, y, 5.6, 1.55, { fill: PAPER, shadow: softShadow });
  s.addText(["①", "②", "③", "④"][i], { x: x + 0.25, y: y + 0.2, w: 0.6, h: 0.6, fontFace: HEAD, fontSize: 22, bold: true, color: OCHRE6 });
  s.addText(c[0], { x: x + 0.95, y: y + 0.24, w: 4.5, h: 0.4, fontFace: HEAD, fontSize: 16, bold: true, color: INK });
  s.addText(c[1], { x: x + 0.95, y: y + 0.66, w: 4.5, h: 0.8, fontFace: BODY, fontSize: 12, color: INKSOFT, lineSpacing: 15 });
});

// 12 — Trust & safety (foundation)
s = p.addSlide(); contentBG(s);
eyebrow(s, "Trust & safety", BRICK);
title(s, "Safety isn't a feature. It's the foundation.", { size: 26 });
const safety = [["🪪", "Human verification", "SA ID + selfie + proof of address, reviewed by a person. Verified & Gold tiers."],
  ["⭐", "Two-way ratings", "Both sides rate every job. Reputation badges. Bad actors don't last."],
  ["📍", "Live location", "Workers share live GPS on the day; employers watch them arrive."],
  ["🆘", "Emergency button", "One tap dials SAPS 10111 from inside any active job — logged."],
  ["⚖", "Disputes", "Either side can freeze a job; an admin reviews chat, photos, ratings."],
  ["🛡", "Moderation engine", "Auto image scanning, text screening, rate-limits, reports, auto-escalation."]];
safety.forEach((sf, i) => {
  const x = M + (i % 3) * 4.06, y = 2.45 + Math.floor(i / 3) * 2.12;
  card(s, x, y, 3.8, 1.95, { fill: PAPER, shadow: softShadow });
  s.addShape(p.ShapeType.roundRect, { x: x + 0.25, y: y + 0.25, w: 0.6, h: 0.6, rectRadius: 0.3, fill: { color: i >= 3 ? OCHRE50 : SAGE100 }, line: { type: "none" } });
  s.addText(sf[0], { x: x + 0.25, y: y + 0.25, w: 0.6, h: 0.6, fontSize: 17, align: "center", valign: "middle" });
  s.addText(sf[1], { x: x + 1.0, y: y + 0.28, w: 2.7, h: 0.55, fontFace: HEAD, fontSize: 14.5, bold: true, color: INK, lineSpacing: 16 });
  s.addText(sf[2], { x: x + 0.25, y: y + 0.95, w: 3.35, h: 0.9, fontFace: BODY, fontSize: 11, color: INKSOFT, lineSpacing: 14 });
});

// 13 — Admin & operations
s = p.addSlide(); contentBG(s);
eyebrow(s, "Operations");
title(s, "A real admin cockpit — not a spreadsheet.", { size: 26 });
s.addImage({ path: A("screen_admin.png"), x: M, y: 1.95, w: 7.4, h: 4.6, sizing: { type: "contain", w: 7.4, h: 4.6 } });
const ops = [["Overview & trends", "Live KPIs + 30-day sparklines for signups, jobs, completions."],
  ["Moderation queue", "Reports + auto-flags in one place; warn / remove / suspend / ban."],
  ["Heatmap + suburbs", "See where the work is, with a suburb drill-down."],
  ["Verification review", "Approve IDs, award the Gold badge, re-review re-submissions."],
  ["Audit log", "Every admin action recorded — accountability built in."]];
ops.forEach((o, i) => {
  const y = 2.05 + i * 0.97;
  s.addText("▸", { x: 8.35, y, w: 0.3, h: 0.3, fontFace: BODY, fontSize: 13, bold: true, color: OCHRE6 });
  s.addText(o[0], { x: 8.65, y: y - 0.02, w: 4.0, h: 0.35, fontFace: HEAD, fontSize: 14.5, bold: true, color: INK });
  s.addText(o[1], { x: 8.65, y: y + 0.34, w: 4.1, h: 0.6, fontFace: BODY, fontSize: 11, color: INKSOFT, lineSpacing: 14 });
});

// 14 — CLOSE
s = p.addSlide(); s.background = { color: INK };
beadwork(s, 0.0);
s.addText("BUILT · LIVE · READY", { x: M, y: 1.6, w: 9, h: 0.4, fontFace: BODY, fontSize: 14, bold: true, color: OCHRE, charSpacing: 5 });
s.addText("Dignified work,\none job at a time.", { x: M - 0.05, y: 2.1, w: 11.5, h: 2.0, fontFace: HEAD, fontSize: 50, bold: true, color: CREAM, lineSpacing: 48 });
s.addText("A South African platform that turns the country's biggest problem — joblessness — into its biggest marketplace. Trust-first, mobile-first, built for the people who need it most.",
  { x: M, y: 4.5, w: 9.6, h: 1.1, fontFace: BODY, fontSize: 16, color: "CDBBA8", lineSpacing: 23 });
card(s, M, 5.95, 11.93, 0.9, { fill: INK2, line: "3A2C22" });
s.addText([{ text: "Workit", options: { bold: true, color: OCHRE, fontFace: HEAD, fontSize: 16 } },
  { text: "   ·   workitsa.co.za   ·   Tshepo M   ·   Futhersky Solutions", options: { color: "CDBBA8", fontFace: BODY, fontSize: 13 } }],
  { x: M + 0.35, y: 5.95, w: 11.2, h: 0.9, valign: "middle" });

p.writeFile({ fileName: path.join(__dirname, "Workit-Showcase-Deck.pptx") }).then((f) => console.log("WROTE", f));
