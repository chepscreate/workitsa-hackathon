"use client";

/**
 * Firebase Cloud Messaging (web push) client integration.
 *
 * Flow:
 *   1. User taps "Enable push" — we ask the browser for Notification
 *      permission.
 *   2. We register `public/firebase-messaging-sw.js` (generated at build
 *      time by `scripts/gen-firebase-messaging-sw.mjs`).
 *   3. We request an FCM token using the VAPID key, then save it to
 *      `users/{uid}/fcmTokens/{token}` for the dispatcher Cloud Function
 *      to look up.
 *   4. Foreground messages are surfaced via the existing in-app toast
 *      stack from NotificationsContext.
 *
 * Costs: zero. Firebase Cloud Messaging is free. Only works for users on
 * Chromium-based browsers + iOS Safari 16.4+ that have allowed
 * notifications. Will silently no-op otherwise.
 */

import {
  deleteToken,
  getMessaging,
  getToken,
  onMessage,
  isSupported as isMessagingSupported,
  type Messaging,
} from "firebase/messaging";
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDb, getFirebaseAuth } from "./firebase";

let messagingInstance: Messaging | null = null;

async function getMessagingSafe(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance;
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;
  try {
    const supported = await isMessagingSupported();
    if (!supported) return null;
  } catch {
    return null;
  }
  const auth = getFirebaseAuth();
  // getMessaging uses the same FirebaseApp instance auth/db live on.
  messagingInstance = getMessaging(auth.app);
  return messagingInstance;
}

/** Register the service worker we generated at build time. */
async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  } catch (err) {
    console.error("[messaging] SW register failed", err);
    return null;
  }
}

/**
 * Fetch the current FCM token and upsert it under the signed-in user, so the
 * dispatcher functions (offers, SOS alerts, broadcasts) can target this device.
 * The sub-doc id IS the (trimmed) token, so it's idempotent across reloads and
 * token rotation. Returns the token, or null if one couldn't be obtained.
 */
async function fetchAndSaveToken(
  messaging: Messaging,
  swReg: ServiceWorkerRegistration,
  uid: string,
  vapid: string,
): Promise<string | null> {
  const token = await getToken(messaging, { vapidKey: vapid, serviceWorkerRegistration: swReg });
  if (!token) return null;
  const tokenId = token.slice(-64);
  await setDoc(
    doc(getDb(), "users", uid, "fcmTokens", tokenId),
    {
      token,
      userAgent: navigator.userAgent,
      createdAt: Date.now(),
      createdAtServer: serverTimestamp(),
    },
    { merge: true },
  );
  return token;
}

/**
 * Silently (re)register this device's push token IF the user has ALREADY granted
 * notification permission. Never prompts. Call it on every authenticated app
 * load: tokens rotate and are only otherwise written when someone manually taps
 * "Enable push", so without this a granted user silently drifts to zero live
 * devices — which is exactly why broadcasts/SOS reach "0 devices".
 */
export async function registerPushTokenIfGranted(): Promise<"saved" | "skipped"> {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return "skipped";
  const vapid = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapid) return "skipped";
  const user = getFirebaseAuth().currentUser;
  if (!user) return "skipped";
  const messaging = await getMessagingSafe();
  if (!messaging) return "skipped";
  const swReg = await registerServiceWorker();
  if (!swReg) return "skipped";
  try {
    const token = await fetchAndSaveToken(messaging, swReg, user.uid, vapid);
    return token ? "saved" : "skipped";
  } catch (err) {
    console.error("[messaging] silent token register failed", err);
    return "skipped";
  }
}

/**
 * Ask the browser for notification permission and exchange it for an FCM
 * token. Saves the token to Firestore under the signed-in user so the
 * dispatcher Cloud Function can target it.
 *
 * Returns:
 *   - "granted"  → token saved, push will work
 *   - "denied"   → user blocked notifications (browser-level)
 *   - "unsupported" → this device / browser can't do push
 *   - "no-vapid" → NEXT_PUBLIC_FIREBASE_VAPID_KEY isn't set
 *   - "no-user"  → not signed in
 */
export async function enablePushNotifications(): Promise<
  "granted" | "denied" | "unsupported" | "no-vapid" | "no-user" | "error"
> {
  if (typeof Notification === "undefined") return "unsupported";
  const vapid = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapid) return "no-vapid";

  const user = getFirebaseAuth().currentUser;
  if (!user) return "no-user";

  const messaging = await getMessagingSafe();
  if (!messaging) return "unsupported";

  const permission =
    Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;
  if (permission !== "granted") return permission === "denied" ? "denied" : "error";

  const swReg = await registerServiceWorker();
  if (!swReg) return "unsupported";

  try {
    const token = await fetchAndSaveToken(messaging, swReg, user.uid, vapid);
    return token ? "granted" : "error";
  } catch (err) {
    console.error("[messaging] getToken failed", err);
    return "error";
  }
}

/**
 * Remove the current device's token from Firestore + tell FCM to forget it.
 * Use when the user toggles push off on this device.
 */
export async function disablePushNotifications(): Promise<void> {
  const user = getFirebaseAuth().currentUser;
  const messaging = await getMessagingSafe();
  if (!messaging) return;
  try {
    const vapid = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (vapid) {
      const swReg = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js");
      const token = await getToken(messaging, {
        vapidKey: vapid,
        serviceWorkerRegistration: swReg ?? undefined,
      });
      if (token && user) {
        try {
          await deleteDoc(doc(getDb(), "users", user.uid, "fcmTokens", token.slice(-64)));
        } catch {
          /* ignore */
        }
      }
      if (token) await deleteToken(messaging);
    }
  } catch (err) {
    console.error("[messaging] disable failed", err);
  }
}

/**
 * Subscribe to foreground push messages (when the tab is open + focused).
 * Background messages are handled by the service worker itself. Returns an
 * unsubscribe function.
 */
export async function subscribeForegroundPush(
  onPayload: (payload: {
    title: string;
    body: string;
    href?: string;
  }) => void,
): Promise<() => void> {
  const messaging = await getMessagingSafe();
  if (!messaging) return () => {};
  const unsub = onMessage(messaging, (payload) => {
    const title = payload.notification?.title ?? "Workit";
    const body = payload.notification?.body ?? "";
    const href = (payload.data as { href?: string } | undefined)?.href;
    onPayload({ title, body, ...(href ? { href } : {}) });
  });
  return unsub;
}

/** Quick check used by UI to decide whether to even show the prompt. */
export function pushIsSupportedSync(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof Notification === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;
  if (!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) return false;
  return true;
}

/** Current browser permission state, as known. */
export function currentPushPermission(): NotificationPermission | "unsupported" {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}
