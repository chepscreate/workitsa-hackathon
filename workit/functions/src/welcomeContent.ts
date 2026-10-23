/**
 * Welcome-email content — the "how to use Workit" manual + social links sent
 * to a user when their account is approved (verificationAlerts.ts) or on
 * demand from the admin panel (sendWelcomeEmail). Role-aware: workers get an
 * earning guide, employers/businesses a hiring guide.
 *
 * Social links are read from `marketing/config` (keys socialFacebook /
 * socialInstagram / socialTiktok / socialWhatsapp) so the founder edits them
 * without a redeploy; only the ones set are shown.
 */
import { getFirestore } from "firebase-admin/firestore";
import { APP_URL, shell } from "./mailer";

export type SocialLinks = {
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  whatsapp?: string;
};

/** Load social URLs from marketing/config (empty object if none set). */
export async function loadSocialLinks(): Promise<SocialLinks> {
  try {
    const snap = await getFirestore().doc("marketing/config").get();
    const c = (snap.exists ? snap.data() : {}) as Record<string, unknown>;
    const pick = (k: string) => {
      const v = c[k];
      return typeof v === "string" && v.trim() ? v.trim() : undefined;
    };
    return {
      facebook: pick("socialFacebook"),
      instagram: pick("socialInstagram"),
      tiktok: pick("socialTiktok"),
      whatsapp: pick("socialWhatsapp"),
    };
  } catch {
    return {};
  }
}

function socialBlock(s: SocialLinks): string {
  const links: string[] = [];
  if (s.facebook) links.push(`<a href="${s.facebook}" style="color:#b85a2a;text-decoration:none;">Facebook</a>`);
  if (s.instagram) links.push(`<a href="${s.instagram}" style="color:#b85a2a;text-decoration:none;">Instagram</a>`);
  if (s.tiktok) links.push(`<a href="${s.tiktok}" style="color:#b85a2a;text-decoration:none;">TikTok</a>`);
  if (s.whatsapp) links.push(`<a href="${s.whatsapp}" style="color:#b85a2a;text-decoration:none;">WhatsApp</a>`);
  if (links.length === 0) return "";
  return `<p style="margin-top:20px;padding-top:16px;border-top:1px solid #e5d9c4;"><b>Follow Workit &amp; get updates:</b><br>${links.join(" &nbsp;·&nbsp; ")}</p>`;
}

const WORKER_STEPS: { h: string; b: string }[] = [
  { h: "Go available", b: "Turn on “Available now” so employers see you’re ready to work." },
  { h: "Find work near you", b: "Browse open jobs, filter by category or distance, and search by keyword (e.g. “garden”, “leaking tap”)." },
  { h: "Send an offer", b: "Accept the employer’s price, or send your own counter-offer. You keep 100% of what you earn — no commission." },
  { h: "Do the job safely", b: "Once hired, chat in-app to agree details. At the door, enter the employer’s start code to begin. Share your live location with a trusted contact, and there’s an SOS button on every job." },
  { h: "Get paid &amp; rated", b: "Payment is cash or EFT on completion. Rate each other afterwards to build your reputation." },
];

const EMPLOYER_STEPS: { h: string; b: string }[] = [
  { h: "Post a job", b: "Describe what you need, set a fair price, add photos and pin the location. It takes about two minutes." },
  { h: "Review offers", b: "ID-verified workers nearby accept your price or send counter-offers — you’ll see their ratings and badges." },
  { h: "Hire", b: "Pick a worker. Workit generates a start code for the job." },
  { h: "When they arrive", b: "Read them the start code to confirm the right person is at your door, then chat in-app to coordinate." },
  { h: "Pay on completion", b: "Cash or EFT once the work’s done — then rate each other." },
];

export function buildWelcomeEmail(opts: {
  role?: string;
  name: string;
  social: SocialLinks;
}): { subject: string; html: string; text: string } {
  const { role, name, social } = opts;
  const isWorker = role === "worker";
  const subject = isWorker
    ? "Welcome to Workit — here’s how to start earning"
    : "Welcome to Workit — here’s how to hire";
  const steps = isWorker ? WORKER_STEPS : EMPLOYER_STEPS;
  const cta = isWorker
    ? { href: `${APP_URL}/find-work`, label: "Find work near me" }
    : { href: `${APP_URL}/post-a-job`, label: "Post your first job" };
  const tip = isWorker
    ? "Add your skills and a profile photo to get picked faster — and a SAPS police clearance earns you the green Gold safety badge employers can filter for."
    : "A ✓ ID-verified badge gets you faster responses from workers. Clear photos and a fair price help too. Mark a job urgent only when it really is.";

  const stepsHtml = `<ol style="padding-left:20px;margin:16px 0;">${steps
    .map((s) => `<li style="margin-bottom:10px;line-height:1.5;"><b>${s.h}</b> — ${s.b}</li>`)
    .join("")}</ol>`;

  const body = `
    <p>Hi ${name},</p>
    <p>Welcome to Workit — your account is verified and active. 🎉 Here’s a quick guide to get you going:</p>
    ${stepsHtml}
    <p style="padding:12px 16px;background:#f6e8cf;border:1px solid #ecd9b0;border-radius:8px;line-height:1.5;">💡 <b>Tip:</b> ${tip}</p>
    <p>Workit is <b>free during launch</b>, and every worker is ID-verified — you’re joining a community built on trust.</p>
    ${socialBlock(social)}
    <p style="color:#7a6a5e;font-size:13px;margin-top:20px;">Any questions? Just reply to this email — it comes straight to me.<br>Tshepo · Founder, Workit</p>
  `;

  const text =
    `Hi ${name},\n\nWelcome to Workit — your account is verified and active!\n\n` +
    steps.map((s, i) => `${i + 1}. ${s.h}: ${s.b.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&")}`).join("\n") +
    `\n\n${cta.label}: ${cta.href}\n\nQuestions? Reply to this email.\nTshepo · Workit`;

  return { subject, html: shell(subject, body, cta), text };
}
