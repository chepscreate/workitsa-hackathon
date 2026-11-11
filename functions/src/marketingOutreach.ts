/**
 * Automated B2B outreach — the delivery arm of the marketing pipeline.
 *
 * The workit-marketer agent produces TARGET LISTS + COPY; this function does
 * the daily SENDING so it runs even when the founder's laptop is off:
 *
 *   marketingLeads/{id}  { businessName, email, status: "pending" | ... }
 *        │  weekdays 08:30 SAST, up to `dailyCap` pending leads
 *        ▼
 *   scheduledMarketingOutreach ── SendGrid (from workitsa.co.za,
 *        │                        Reply-To = founder's Gmail)
 *        ▼
 *   lead.status → "sent" (+ a daily summary email to the founder)
 *
 * Guardrails (deliberate — this is outward-facing email):
 *  - MASTER SWITCH: no-ops until `marketing/config` has `enabled: true`.
 *    Ships OFF. Flip it in the Firestore console when ready.
 *  - Blast radius is bounded by the lead list: it only ever emails addresses
 *    an admin/the marketer agent explicitly queued, ≤ dailyCap per day
 *    (default 15 — modest volume also protects the SendGrid sender score).
 *  - POPIA §69 / CPA-conscious: sender identified (company + postal line),
 *    honest "why you're getting this" line, one-click opt-out link + mailto,
 *    List-Unsubscribe headers. Opt-outs are honoured across ALL leads with
 *    the same email address, forever (status "optout" is never re-queued).
 *  - Weekdays only — cold outreach on a Sunday reads as spam.
 *
 * Collections are server-only (no rules needed — the catch-all denies clients;
 * this file uses the Admin SDK).
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { createHmac } from "crypto";
import sgMail from "@sendgrid/mail";
import { SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, APP_URL, POSTAL_LINE } from "./mailer";
import { beat } from "./heartbeat";

const DEFAULT_DAILY_CAP = 15;
const DEFAULT_REPLY_TO = "tshepowayne2@gmail.com"; // founder's Gmail — replies land there
const FOUNDER_NAME = "Tshepo";
// v2 functions keep the classic cloudfunctions.net alias (same as jarvisWhatsApp).
const OPTOUT_URL = "https://africa-south1-workit-6a927.cloudfunctions.net/marketingOptOut";

type Lead = {
  businessName?: string;
  contactName?: string;
  email?: string;
  suburb?: string;
  category?: string;
  status?: "pending" | "sent" | "replied" | "optout" | "bounced" | "skipped";
};

type MarketingConfig = {
  enabled?: boolean;
  dailyCap?: number; // TOTAL per day across all runs (2 × batchCap by default)
  batchCap?: number; // max per single run (default 15)
  replyTo?: string;
  fromEmail?: string; // outreach-only sender (e.g. tshepo@workitsa.co.za);
                      // transactional mail keeps using SENDGRID_FROM_EMAIL
  subject?: string;   // {businessName} interpolated
  bodyHtml?: string;  // {businessName}/{contactName} interpolated; footer appended
  bodyText?: string;
};

/** Emails already sent in the current SAST day. Range on sentAt only (the
 *  field exists solely on sent leads), so no composite index is needed.
 *  Shared with marketingAdmin so the panel can show today's budget. */
export async function sentTodayCount(): Promise<number> {
  const SAST_OFFSET_MS = 2 * 60 * 60 * 1000; // no DST in South Africa
  const dayStartSast = Math.floor((Date.now() + SAST_OFFSET_MS) / 86400000) * 86400000 - SAST_OFFSET_MS;
  const agg = await getFirestore()
    .collection("marketingLeads")
    .where("sentAt", ">=", dayStartSast)
    .count()
    .get();
  return agg.data().count;
}

/** Opt-out link token — HMAC of the lead id keyed with the SendGrid API key
 *  (already a secret; avoids provisioning another one). Not guessable without
 *  the key, and a leaked link only opts THAT lead out — harmless. */
const optOutToken = (leadId: string) =>
  createHmac("sha256", SENDGRID_API_KEY.value()).update(`optout:${leadId}`).digest("hex").slice(0, 32);

const fill = (tpl: string, lead: Lead) =>
  tpl
    .replace(/\{businessName\}/g, lead.businessName ?? "your business")
    .replace(/\{contactName\}/g, lead.contactName || lead.businessName || "there");

const DEFAULT_SUBJECT = "Free local workers for {businessName} — Workit is live in Gauteng";

const DEFAULT_BODY_HTML = `
<p>Hi {contactName},</p>
<p>I'm ${FOUNDER_NAME}, founder of <b>Workit</b> (<a href="${APP_URL}">workitsa.co.za</a>) —
a South African app where businesses post everyday jobs (cleaning, deliveries, trades,
extra hands) and <b>ID-verified workers nearby</b> accept or counter-offer. You pay the
worker directly in cash or EFT when the job's done.</p>
<p>We're live in Gauteng and <b>free for businesses during launch</b>. Listing
{businessName} takes about two minutes, and you'd be one of the first businesses
in your area on the app.</p>
<p>If you'd like a hand setting up, just reply to this email — it comes straight to me.</p>
<p>Thanks for reading,<br>${FOUNDER_NAME} · Workit</p>`;

const DEFAULT_BODY_TEXT = `Hi {contactName},

I'm ${FOUNDER_NAME}, founder of Workit (workitsa.co.za) — a South African app where
businesses post everyday jobs (cleaning, deliveries, trades, extra hands) and
ID-verified workers nearby accept or counter-offer. You pay the worker directly
in cash or EFT when the job's done.

We're live in Gauteng and free for businesses during launch. Listing
{businessName} takes about two minutes.

If you'd like a hand setting up, just reply to this email — it comes straight to me.

Thanks for reading,
${FOUNDER_NAME} · Workit`;

/** Marketing footer — identification + honest source + opt-out (POPIA §69). */
function marketingFooter(unsubUrl: string): { html: string; text: string } {
  return {
    html: `
<hr style="border:none;border-top:1px solid #e5d9c4;margin:28px 0 12px;">
<p style="font-size:11px;color:#7a6a5e;margin:0 0 4px;">Workit · ${POSTAL_LINE} ·
<a href="${APP_URL}" style="color:#b85a2a;">workitsa.co.za</a></p>
<p style="font-size:11px;color:#7a6a5e;margin:0;">You're receiving this once-off
introduction because your business is publicly listed in Gauteng. We won't email
you again if you <a href="${unsubUrl}" style="color:#b85a2a;">unsubscribe with one
click</a>.</p>`,
    text: `\n\n--\nWorkit · ${POSTAL_LINE} · workitsa.co.za\nOnce-off introduction — your business is publicly listed in Gauteng.\nUnsubscribe: ${unsubUrl}`,
  };
}

/** Result of one outreach batch — shared by the scheduler and the admin
 *  panel's "Send batch now" button (marketingAdmin.ts). */
export type OutreachResult = {
  ran: boolean;
  reason?: string; // set when ran === false
  sent: number;
  skipped: number;
};

export async function runOutreachBatch(): Promise<OutreachResult> {
  {
    const db = getFirestore();

    // Master switch + config.
    const cfgSnap = await db.doc("marketing/config").get();
    const cfg = (cfgSnap.exists ? cfgSnap.data() : {}) as MarketingConfig;
    if (!cfg.enabled) {
      logger.info("Marketing outreach disabled (marketing/config.enabled != true) — skipping.");
      return { ran: false, reason: "Paused — marketing/config.enabled is not true.", sent: 0, skipped: 0 };
    }
    const key = SENDGRID_API_KEY.value();
    const from = SENDGRID_FROM_EMAIL.value();
    if (!key || !from) {
      logger.warn("SendGrid not configured — skipping outreach.");
      return { ran: false, reason: "SendGrid secrets not configured.", sent: 0, skipped: 0 };
    }
    sgMail.setApiKey(key);

    const cap = Math.max(1, Math.min(60, Number(cfg.dailyCap ?? DEFAULT_DAILY_CAP)));
    // Per-run size — with two runs a day (08:30 + 13:30), each sends at most
    // batchCap and the pair together never exceed dailyCap.
    const batchCap = Math.max(1, Math.min(50, Number(cfg.batchCap ?? DEFAULT_DAILY_CAP)));
    const replyTo = String(cfg.replyTo || DEFAULT_REPLY_TO);
    // Outreach may use a friendlier sender (marketing/config.fromEmail). If
    // SendGrid rejects it as an unverified identity, the batch falls back to
    // the always-verified transactional address mid-run — a bad config value
    // must never cost a day's sending.
    const configuredFrom = String(cfg.fromEmail || "").trim();
    let sendFrom = configuredFrom || from;

    // TRUE daily cap — the scheduler and the admin "send now" button share one
    // daily budget, so pressing the button twice can't double a day's volume
    // (protects the sender reputation).
    const alreadyToday = await sentTodayCount();
    const budget = cap - alreadyToday;
    if (budget <= 0) {
      logger.info(`Daily cap reached (${alreadyToday}/${cap}) — skipping.`);
      return {
        ran: false,
        reason: `Daily cap reached (${alreadyToday}/${cap} sent today) — next batch goes out on the next weekday at 08:30.`,
        sent: 0,
        skipped: 0,
      };
    }
    const subjectTpl = String(cfg.subject || DEFAULT_SUBJECT);
    const htmlTpl = String(cfg.bodyHtml || DEFAULT_BODY_HTML);
    const textTpl = String(cfg.bodyText || DEFAULT_BODY_TEXT);

    // Opt-out suppression set — honour an opt-out across every lead doc that
    // shares the address (someone may appear on two scouted lists).
    const optedOut = new Set<string>();
    const optSnap = await db.collection("marketingLeads").where("status", "==", "optout").get();
    optSnap.forEach((d) => {
      const e = String((d.data() as Lead).email ?? "").toLowerCase().trim();
      if (e) optedOut.add(e);
    });

    const pending = await db
      .collection("marketingLeads")
      .where("status", "==", "pending")
      .limit(Math.min(budget, batchCap))
      .get();
    if (pending.empty) {
      logger.info("Marketing outreach: no pending leads.");
      return { ran: false, reason: "No pending leads in the queue.", sent: 0, skipped: 0 };
    }

    const sent: string[] = [];
    const skipped: string[] = [];

    for (const doc of pending.docs) {
      const lead = doc.data() as Lead;
      const email = String(lead.email ?? "").toLowerCase().trim();
      const label = `${lead.businessName ?? "?"} <${email || "no-email"}>`;

      // Basic sanity + suppression.
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || optedOut.has(email)) {
        await doc.ref.update({
          status: optedOut.has(email) ? "optout" : "skipped",
          skippedReason: optedOut.has(email) ? "suppressed (opted out)" : "invalid email",
          updatedAt: Date.now(),
        });
        skipped.push(label);
        continue;
      }

      const unsubUrl = `${OPTOUT_URL}?id=${doc.id}&t=${optOutToken(doc.id)}`;
      const footer = marketingFooter(unsubUrl);
      const sendLead = () =>
        sgMail.send({
          to: email,
          // BCC the founder so every sent email lands in his Gmail as a copy
          // (BCC not CC — recipients shouldn't see the personal address).
          ...(email !== replyTo.toLowerCase() ? { bcc: replyTo } : {}),
          from: { email: sendFrom, name: `${FOUNDER_NAME} from Workit` },
          replyTo: { email: replyTo, name: `${FOUNDER_NAME} (Workit)` },
          subject: fill(subjectTpl, lead),
          html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f1612;font-size:15px;line-height:1.55;">${fill(htmlTpl, lead)}${footer.html}</div>`,
          text: fill(textTpl, lead) + footer.text,
          headers: {
            "List-Unsubscribe": `<mailto:${replyTo}?subject=unsubscribe>, <${unsubUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
          trackingSettings: {
            clickTracking: { enable: false, enableText: false },
            openTracking: { enable: false },
          },
        });
      try {
        try {
          await sendLead();
        } catch (err) {
          // Unverified-sender rejection → drop to the transactional address
          // for the rest of the batch and retry this lead once.
          const s = String(err);
          if (sendFrom !== from && /verified sender|sender identity|from address does not match/i.test(s)) {
            logger.warn(`SendGrid rejected sender ${sendFrom} — falling back to ${from}.`);
            sendFrom = from;
            await sendLead();
          } else {
            throw err;
          }
        }
        await doc.ref.update({ status: "sent", sentAt: Date.now(), updatedAt: Date.now() });
        sent.push(label);
      } catch (err) {
        logger.error("Outreach send failed", { lead: label, err: String(err) });
        await doc.ref.update({
          status: "bounced",
          skippedReason: `send failed: ${String(err).slice(0, 200)}`,
          updatedAt: Date.now(),
        });
        skipped.push(`${label} (failed)`);
      }
    }

    logger.info(`Marketing outreach: sent ${sent.length}, skipped ${skipped.length}.`);

    // Daily accountability summary → founder's inbox (the same reply-to Gmail),
    // so what went out is never invisible.
    if (sent.length + skipped.length > 0) {
      const rows = [
        ...sent.map((s) => `✅ ${s}`),
        ...skipped.map((s) => `⏭️ ${s}`),
      ].join("<br>");
      const senderNote =
        configuredFrom && sendFrom !== configuredFrom
          ? `<p style="color:#a93226;font-size:12px;">⚠ SendGrid rejected the configured sender <b>${configuredFrom}</b> — this batch went out from ${sendFrom} instead. Verify the address under SendGrid → Sender Authentication, or fix marketing/config.fromEmail.</p>`
          : "";
      try {
        await sgMail.send({
          to: replyTo,
          from: { email: sendFrom, name: "Workit" },
          subject: `Outreach today: ${sent.length} sent${skipped.length ? `, ${skipped.length} skipped` : ""}`,
          html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f1612;"><p>Daily outreach summary (sent from ${sendFrom}):</p><p>${rows}</p>${senderNote}<p style="color:#7a6a5e;font-size:12px;">Pause any time: set <code>marketing/config.enabled = false</code> in Firestore.</p></div>`,
          text: `Daily outreach summary (sent from ${sendFrom})\n${sent.map((s) => `sent: ${s}`).join("\n")}\n${skipped.map((s) => `skipped: ${s}`).join("\n")}`,
        });
      } catch (err) {
        logger.warn("Outreach summary email failed", { err: String(err) });
      }
    }

    return { ran: true, sent: sent.length, skipped: skipped.length };
  }
}

export const scheduledMarketingOutreach = onSchedule(
  {
    // Weekday mornings 08:30 SAST (no africa-south1 for Cloud Scheduler — same
    // note as retention.ts / deletionAlerts.ts; Firestore reads still hit the
    // africa-south1 db).
    schedule: "30 8 * * 1-5",
    timeZone: "Africa/Johannesburg",
    region: "europe-west1",
    retryCount: 0, // never retry a send batch — double-send is worse than a miss
    memory: "256MiB",
    secrets: [SENDGRID_API_KEY, SENDGRID_FROM_EMAIL],
  },
  async () => {
    beat("scheduledMarketingOutreach");
    await runOutreachBatch();
  },
);

export const scheduledMarketingOutreachAfternoon = onSchedule(
  {
    // Weekday 13:30 SAST — second batch of the day. Shares the same
    // sentTodayCount() budget, so morning + afternoon together never exceed
    // dailyCap (each run individually capped at batchCap).
    schedule: "30 13 * * 1-5",
    timeZone: "Africa/Johannesburg",
    region: "europe-west1",
    retryCount: 0,
    memory: "256MiB",
    secrets: [SENDGRID_API_KEY, SENDGRID_FROM_EMAIL],
  },
  async () => {
    beat("scheduledMarketingOutreachAfternoon");
    await runOutreachBatch();
  },
);

/** One-click unsubscribe landing — GET with the HMAC token from the email. */
export const marketingOptOut = onRequest(
  { region: "africa-south1", memory: "256MiB", secrets: [SENDGRID_API_KEY] },
  async (req, res) => {
    const id = String(req.query.id ?? "").trim();
    const t = String(req.query.t ?? "").trim();
    const page = (title: string, body: string) =>
      `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:Arial,sans-serif;background:#faf4ec;color:#1f1612;display:grid;place-items:center;min-height:90vh;margin:0;padding:24px;">
<div style="max-width:420px;text-align:center;"><h1 style="color:#b85a2a;font-size:22px;">${title}</h1><p style="color:#4a3a30;line-height:1.5;">${body}</p></div></body></html>`;

    if (!id || !t || t !== optOutToken(id)) {
      res.status(400).send(page("Link not valid", "This unsubscribe link is incomplete or expired. Reply to the email instead and we'll remove you manually."));
      return;
    }
    const db = getFirestore();
    const ref = db.collection("marketingLeads").doc(id);
    const snap = await ref.get();
    if (snap.exists) {
      await ref.update({ status: "optout", optedOutAt: Date.now(), updatedAt: Date.now() });
      // Suppress every other lead doc sharing this address.
      const email = String((snap.data() as Lead).email ?? "").toLowerCase().trim();
      if (email) {
        const dupes = await db.collection("marketingLeads").where("email", "==", email).get();
        for (const d of dupes.docs) {
          if (d.id !== id && (d.data() as Lead).status !== "optout") {
            await d.ref.update({ status: "optout", optedOutAt: Date.now(), updatedAt: Date.now() });
          }
        }
      }
    }
    res.status(200).send(page("You're unsubscribed", "Done — Workit won't email this address again. Sorry for the interruption, and thanks for your time."));
  },
);
