/**
 * Provider-agnostic notification dispatcher.
 *
 * Each channel ("push", future: "sms", "whatsapp") is implemented as an
 * isolated function inside this file. The public `dispatchPush()` /
 * `dispatchSms()` / etc helpers take a uniform payload + a target user
 * UID, and the channel function is responsible for resolving the user's
 * recipient addresses (FCM tokens / phone number) and sending.
 *
 * To add a new channel later:
 *   1. Add the adapter function below.
 *   2. Export a `dispatchX()` helper that mirrors `dispatchPush()`.
 *   3. Call it from your event handler (e.g. functions/src/pushNotifications.ts).
 *
 * Cost note: only FCM is wired today (free). SMS / WhatsApp adapters are
 * intentionally not implemented — when budget allows, drop a Clickatell or
 * Meta WhatsApp Cloud API adapter here without touching the call sites.
 */

import { logger } from "firebase-functions";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

export type NotifyPayload = {
  /** Recipient user UID — we resolve their tokens / phone from Firestore. */
  toUid: string;
  /** Short headline shown on the notification. */
  title: string;
  /** Body text. Keep it under ~140 chars to survive SMS too. */
  body: string;
  /** Deep-link path within the app, e.g. `/jobs?id=abc`. */
  href?: string;
  /** Optional dedupe tag — same tag replaces a prior unread push. */
  tag?: string;
};

// ---------- FCM web push ----------

type FcmTokenDoc = { token?: string };

async function fcmTokensFor(uid: string): Promise<{ id: string; token: string }[]> {
  const snap = await getFirestore().collection(`users/${uid}/fcmTokens`).get();
  const list: { id: string; token: string }[] = [];
  snap.forEach((d) => {
    const t = (d.data() as FcmTokenDoc).token;
    if (t) list.push({ id: d.id, token: t });
  });
  return list;
}

/**
 * Send a push notification to every device the user has registered.
 * Invalid / expired tokens are pruned from Firestore on response.
 */
export async function dispatchPush(payload: NotifyPayload): Promise<void> {
  const tokens = await fcmTokensFor(payload.toUid);
  if (tokens.length === 0) return;

  const messaging = getMessaging();
  const message = {
    tokens: tokens.map((t) => t.token),
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: {
      ...(payload.href ? { href: payload.href } : {}),
      ...(payload.tag ? { tag: payload.tag } : {}),
    },
    webpush: {
      fcmOptions: payload.href ? { link: payload.href } : undefined,
      notification: {
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        ...(payload.tag ? { tag: payload.tag } : {}),
      },
    },
  };

  let response;
  try {
    response = await messaging.sendEachForMulticast(message);
  } catch (err) {
    logger.error("dispatchPush sendEachForMulticast failed", { uid: payload.toUid, err });
    return;
  }

  // Prune dead tokens — anything FCM rejected with a permanent error.
  const toDelete: string[] = [];
  response.responses.forEach((res, i) => {
    if (res.success) return;
    const code = res.error?.code ?? "";
    if (
      code === "messaging/invalid-registration-token"
      || code === "messaging/registration-token-not-registered"
      || code === "messaging/invalid-argument"
    ) {
      toDelete.push(tokens[i].id);
    }
  });
  if (toDelete.length > 0) {
    const batch = getFirestore().batch();
    for (const id of toDelete) {
      batch.delete(getFirestore().doc(`users/${payload.toUid}/fcmTokens/${id}`));
    }
    try {
      await batch.commit();
      logger.info("dispatchPush pruned tokens", { uid: payload.toUid, count: toDelete.length });
    } catch (err) {
      logger.warn("dispatchPush prune failed", err);
    }
  }
  // Record last-pushed timestamp (best effort, useful for analytics later).
  try {
    await getFirestore().doc(`users/${payload.toUid}`).update({
      lastPushAt: FieldValue.serverTimestamp(),
    });
  } catch {
    /* ignore — user doc might not exist for service accounts */
  }
}

// ---------- SMS (not implemented) ----------
//
// When you add an SMS provider (Clickatell / Twilio / Vumatel), implement
// it here as:
//
//   export async function dispatchSms(payload: NotifyPayload): Promise<void> {
//     const userSnap = await getFirestore().doc(`users/${payload.toUid}`).get();
//     const phone = userSnap.data()?.phone;
//     if (!phone) return;
//     // ... call your provider's API
//   }
//
// Then call dispatchSms() from event handlers alongside dispatchPush().
// No changes needed to the existing handlers — just add the call.

// ---------- WhatsApp (not implemented) ----------
//
// Same shape as SMS. Meta WhatsApp Cloud API gives 1,000 free
// conversations / month; great for high-value events (offer accepted,
// dispute opened) once Meta Business verification is done.
