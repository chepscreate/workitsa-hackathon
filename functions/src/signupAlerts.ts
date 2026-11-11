/**
 * New sign-up alert for the founder.
 *
 * Fires once when a users/{uid} doc is CREATED (email signups create it at
 * signup; Google/phone signups create it at finish-signup). Emails the
 * founder's business address with the who/what and whether verification
 * documents are in yet, BCC'ing his personal Gmail as the backup copy.
 *
 * Docs are almost never submitted at creation time (the welcome flow sends
 * users to /profile then /verification) — the docs line tells the founder
 * what to expect: "not yet" means watch the missing-docs filter.
 */
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, APP_URL, SUPPORT_EMAIL, send, shell } from "./mailer";

const FOUNDER_COPY = "tshepowayne2@gmail.com";

type UserDoc = {
  role?: string;
  displayName?: string;
  email?: string;
  phone?: string;
  city?: string;
  suburb?: string;
  createdAt?: number;
  verification?: { submittedAt?: number };
};

export const onUserCreatedNotifyFounder = onDocumentCreated(
  { document: "users/{uid}", secrets: [SENDGRID_API_KEY, SENDGRID_FROM_EMAIL] },
  async (event) => {
    const u = event.data?.data() as UserDoc | undefined;
    if (!u) return;
    if (u.role === "admin") return; // founder creating admins isn't a sign-up

    const name = u.displayName || "Unnamed user";
    const role = u.role ?? "unknown role";
    const docsIn = !!u.verification?.submittedAt;
    const docsLine = docsIn
      ? "✅ Docs submitted — ready for review"
      : "⏳ No docs yet — they'll show under the missing-docs filter until they upload";
    const where = [u.suburb, u.city].filter(Boolean).join(", ");

    const subject = `New ${role} sign-up: ${name} · ${docsIn ? "docs submitted" : "no docs yet"}`;
    const bodyHtml = `
      <p><b>${name}</b> just joined Workit as a <b>${role}</b>.</p>
      <ul style="padding-left:18px;line-height:1.7;">
        <li>Email: ${u.email || "—"}</li>
        <li>Phone: ${u.phone || "—"}</li>
        ${where ? `<li>Area: ${where}</li>` : ""}
        <li>Documents: ${docsLine}</li>
      </ul>
      <p>They're pending until you approve them.</p>`;

    try {
      await send({
        to: SUPPORT_EMAIL,
        bcc: FOUNDER_COPY,
        subject,
        text: `${name} joined as ${role}. Email: ${u.email || "-"} · Phone: ${u.phone || "-"} · ${docsLine}\n\n${APP_URL}/admin`,
        html: shell("New Workit sign-up", bodyHtml, { href: `${APP_URL}/admin`, label: "Open admin approvals" }),
      });
      logger.info("Founder notified of new sign-up", { uid: event.params.uid, role, docsIn });
    } catch (err) {
      logger.error("Sign-up alert email failed", { uid: event.params.uid, err: String(err) });
    }
  },
);
