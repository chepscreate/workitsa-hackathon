/**
 * Automated Facebook posting — the social arm of the marketing pipeline.
 *
 * The marketer agent produces GRAPHICS + CAPTIONS; the founder stages them with
 * `node functions/scripts/import-posts.mjs <file.json>` (that import is the
 * human approval step — same pattern as the email outreach). This scheduler
 * then publishes ONE queued post per day to the Workitsa Facebook Page:
 *
 *   marketingPosts/{id}  { caption, storagePath?, status: "queued" | ... }
 *        │  daily 17:30 SAST (evening scroll), oldest queued first
 *        ▼
 *   scheduledFacebookPost ── Graph API /photos (signed image URL) or /feed
 *        ▼
 *   status → "posted" (+ fbPostId), founder emailed only on problems
 *
 * Guardrails:
 *  - Only ever posts content that was explicitly staged (nothing generated
 *    or published on its own authority). Pause any time:
 *    marketing/config.fbEnabled = false.
 *  - Token health-checked (GET page name) before any write; failures email
 *    the founder rather than failing silently.
 *  - Queue-empty nudge emails ONCE (flag in marketing/state), not daily spam.
 *
 * Secrets: META_PAGE_TOKEN (never-expiring Page token, founder-created),
 * META_PAGE_ID. Collections are server-only (catch-all deny; Admin SDK here).
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import sgMail from "@sendgrid/mail";
import { SENDGRID_API_KEY, SENDGRID_FROM_EMAIL } from "./mailer";
import { beat } from "./heartbeat";

export const META_PAGE_TOKEN = defineSecret("META_PAGE_TOKEN");
export const META_PAGE_ID = defineSecret("META_PAGE_ID");

const GRAPH = "https://graph.facebook.com/v25.0";
const FOUNDER_FALLBACK_EMAIL = "tshepowayne2@gmail.com";

type QueuedPost = {
  caption?: string;
  storagePath?: string; // e.g. marketing/posts/1720000000-categories.png
  mediaType?: string; // "video" → 08:00 clip slot; anything else → 17:30 image slot
  status?: "queued" | "posted" | "failed";
  createdAt?: number;
};

type MarketingConfig = { fbEnabled?: boolean; replyTo?: string };

async function alertFounder(to: string, subject: string, body: string): Promise<void> {
  const key = SENDGRID_API_KEY.value();
  const from = SENDGRID_FROM_EMAIL.value();
  if (!key || !from) return;
  sgMail.setApiKey(key);
  try {
    await sgMail.send({
      to,
      from: { email: from, name: "Workit" },
      subject,
      text: body,
      html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f1612;">${body.replace(/\n/g, "<br>")}</div>`,
    });
  } catch (err) {
    logger.warn("Founder alert email failed", { err: String(err) });
  }
}

/** Result of one posting attempt — shared by the scheduler and the admin
 *  panel's "Post now" button (marketingAdmin.ts). */
export type FbPostResult = {
  ran: boolean; // true = a post was attempted
  reason?: string; // set when ran === false
  fbPostId?: string;
  remaining?: number;
  error?: string; // set when the attempt failed
};

/**
 * @param slot "morning" posts only VIDEO clips (08:00), "evening" only
 * images/text (17:30), undefined (admin button) takes the oldest of any kind.
 */
export async function runFacebookPost(slot?: "morning" | "evening"): Promise<FbPostResult> {
  {
    const db = getFirestore();
    const cfgSnap = await db.doc("marketing/config").get();
    const cfg = (cfgSnap.exists ? cfgSnap.data() : {}) as MarketingConfig;
    // Staging a post IS the founder's approval, so this defaults ON — the
    // explicit kill switch is fbEnabled: false.
    if (cfg.fbEnabled === false) {
      logger.info("Facebook posting paused (marketing/config.fbEnabled = false).");
      return { ran: false, reason: "Paused — marketing/config.fbEnabled is false." };
    }
    const founderEmail = String(cfg.replyTo || FOUNDER_FALLBACK_EMAIL);

    const token = META_PAGE_TOKEN.value();
    const pageId = META_PAGE_ID.value();
    if (!token || !pageId) {
      logger.warn("META_PAGE_TOKEN / META_PAGE_ID not set — skipping.");
      return { ran: false, reason: "META_PAGE_TOKEN / META_PAGE_ID secrets not set." };
    }

    // Token health check before touching the queue (also what the first
    // post-deploy verification run exercises).
    const check = await fetch(`${GRAPH}/${pageId}?fields=name&access_token=${encodeURIComponent(token)}`);
    const checkBody = (await check.json()) as { name?: string; error?: { message?: string } };
    if (!check.ok || checkBody.error) {
      const msg = checkBody.error?.message ?? `HTTP ${check.status}`;
      logger.error("Facebook token check FAILED", { msg });
      await alertFounder(
        founderEmail,
        "⚠ Workit Facebook posting broken — token problem",
        `The daily Facebook poster couldn't authenticate with the Page.\nGraph API said: ${msg}\n\nFix: regenerate the Page token (Graph Explorer → me/accounts) and re-run:\nnpx firebase functions:secrets:set META_PAGE_TOKEN\nthen redeploy scheduledFacebookPost.`,
      );
      return { ran: false, reason: `Token check failed: ${msg}` };
    }
    logger.info(`Facebook token OK — Page: ${checkBody.name} (${pageId})`);

    // Oldest queued post for this slot. (where + in-memory filter/sort — the
    // queue stays small, and this avoids a composite index.)
    const queueSnap = await db.collection("marketingPosts").where("status", "==", "queued").limit(50).get();
    const stateRef = db.doc("marketing/state");
    const wantVideo = slot === "morning";
    const slotLabel = slot === "morning" ? "08:00 clip" : slot === "evening" ? "17:30 image" : "manual";
    const emptyFlag = slot === "morning" ? "queueEmptyNotifiedMorning" : "queueEmptyNotified";
    const docs = queueSnap.docs
      .map((d) => ({ id: d.id, ref: d.ref, data: d.data() as QueuedPost }))
      .filter((d) =>
        slot === undefined ? true : wantVideo ? d.data.mediaType === "video" : d.data.mediaType !== "video",
      )
      .sort((a, b) => (a.data.createdAt ?? 0) - (b.data.createdAt ?? 0));
    if (docs.length === 0) {
      logger.info(`Facebook queue empty for the ${slotLabel} slot — nothing to post.`);
      const state = await stateRef.get();
      if (!(state.exists && state.data()?.[emptyFlag])) {
        await stateRef.set({ [emptyFlag]: true, updatedAt: Date.now() }, { merge: true });
        await alertFounder(
          founderEmail,
          `Workit Facebook queue is empty (${slotLabel} slot)`,
          `The ${slotLabel} slot has nothing staged${wantVideo ? " — it only posts VIDEO clips (videoPath entries)" : ""}. Ask the marketer agent for a content batch, then:\nnode functions/scripts/import-posts.mjs <batch.json>\n(One-time notice — you won't get this email again until after the next successful ${slotLabel} post.)`,
        );
      }
      return { ran: false, reason: `No ${wantVideo ? "clips" : "posts"} queued for the ${slotLabel} slot.` };
    }
    const next = docs[0];
    const caption = String(next.data.caption ?? "").trim();
    if (!caption) {
      await next.ref.update({ status: "failed", error: "empty caption", updatedAt: Date.now() });
      logger.warn(`Post ${next.id} has no caption — marked failed.`);
      return { ran: false, reason: `Post ${next.id} had an empty caption — marked failed.` };
    }

    try {
      let endpoint: string;
      const params = new URLSearchParams({ access_token: token });
      if (next.data.storagePath) {
        // Facebook fetches the media from a short-lived signed URL
        // (functions SA already has signBlob from the docUrls setup).
        const [signedUrl] = await getStorage()
          .bucket()
          .file(next.data.storagePath)
          .getSignedUrl({ action: "read", expires: Date.now() + 6 * 60 * 60 * 1000 });
        if (next.data.mediaType === "video") {
          endpoint = `${GRAPH}/${pageId}/videos`;
          params.set("file_url", signedUrl);
          params.set("description", caption);
        } else {
          endpoint = `${GRAPH}/${pageId}/photos`;
          params.set("url", signedUrl);
          params.set("caption", caption);
        }
      } else {
        endpoint = `${GRAPH}/${pageId}/feed`;
        params.set("message", caption);
      }

      const res = await fetch(endpoint, { method: "POST", body: params });
      const body = (await res.json()) as { id?: string; post_id?: string; error?: { message?: string } };
      if (!res.ok || body.error) throw new Error(body.error?.message ?? `HTTP ${res.status}`);

      const fbPostId = body.post_id ?? body.id ?? "";
      await next.ref.update({ status: "posted", fbPostId, postedAt: Date.now(), updatedAt: Date.now() });
      await stateRef.set({ [emptyFlag]: false, updatedAt: Date.now() }, { merge: true });
      const remaining = docs.length - 1;
      logger.info(`Posted to Facebook ✅ ${fbPostId} — ${remaining} still queued.`);
      if (remaining === 0) {
        await alertFounder(
          founderEmail,
          "Workit posted to Facebook — queue now empty",
          `Today's post went out (post id ${fbPostId}). That was the last one staged — top up the queue:\nnode functions/scripts/import-posts.mjs <batch.json>`,
        );
      }
      return { ran: true, fbPostId, remaining };
    } catch (err) {
      logger.error("Facebook post FAILED", { post: next.id, err: String(err) });
      await next.ref.update({ status: "failed", error: String(err).slice(0, 300), updatedAt: Date.now() });
      await alertFounder(
        founderEmail,
        "⚠ Workit Facebook post failed",
        `Post ${next.id} failed: ${String(err)}\nIt's marked "failed" in marketingPosts and won't retry on its own. The next queued post goes out tomorrow 17:30.`,
      );
      return { ran: true, error: String(err).slice(0, 300) };
    }
  }
}

export const scheduledFacebookPost = onSchedule(
  {
    // 17:30 SAST daily — the IMAGE slot (evening-scroll engagement window;
    // weekends included — social posts, unlike cold email, do fine on
    // weekends). Cloud Scheduler has no africa-south1 — same note as the
    // other schedulers.
    schedule: "30 17 * * *",
    timeZone: "Africa/Johannesburg",
    region: "europe-west1",
    retryCount: 0, // a retried run must never double-post
    memory: "256MiB",
    secrets: [META_PAGE_TOKEN, META_PAGE_ID, SENDGRID_API_KEY, SENDGRID_FROM_EMAIL],
  },
  async () => {
    beat("scheduledFacebookPost");
    await runFacebookPost("evening");
  },
);

export const scheduledFacebookPostMorning = onSchedule(
  {
    // 08:00 SAST daily — the VIDEO-CLIP slot (morning commute scroll).
    schedule: "0 8 * * *",
    timeZone: "Africa/Johannesburg",
    region: "europe-west1",
    retryCount: 0,
    memory: "256MiB",
    secrets: [META_PAGE_TOKEN, META_PAGE_ID, SENDGRID_API_KEY, SENDGRID_FROM_EMAIL],
  },
  async () => {
    beat("scheduledFacebookPostMorning");
    await runFacebookPost("morning");
  },
);
