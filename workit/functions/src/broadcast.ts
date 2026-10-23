/**
 * Admin broadcast — send a push notification to a segment of users.
 *
 * Powerful, so it's gated hard: admin role + a two-step-verified session (same
 * bar as erasure / viewing ID docs), a daily cap to prevent notification
 * fatigue/abuse, and every send is recorded in `broadcasts` + the audit log.
 *
 * Fan-out: collects every target device token (collectionGroup over
 * users/{uid}/fcmTokens, filtered to the segment's uids) and sends via FCM
 * multicast in 500-token chunks, pruning dead tokens on the way. Fine at
 * launch volume; the scale path is FCM topics (subscribe tokens to
 * all/workers/employers topics at registration and send to the topic once).
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { requireCan } from "./perms";

type AnyDoc = Record<string, unknown>;

const DAILY_CAP = 5;
const SEGMENTS = ["all", "workers", "employers", "available"] as const;
type Segment = (typeof SEGMENTS)[number];

export const sendBroadcast = onCall({ timeoutSeconds: 300, memory: "512MiB" }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in.");
  // RBAC phase 2: broadcast.send is owner-only in the role matrix.
  await requireCan(req.auth, "broadcast.send");
  const db = getFirestore();
  const me = await db.collection("users").doc(req.auth.uid).get();
  if (!req.auth.token.firebase?.sign_in_second_factor) {
    throw new HttpsError(
      "permission-denied",
      "Set up two-step verification and sign in again to send a broadcast.",
    );
  }
  const adminName = String((me.data() as AnyDoc | undefined)?.displayName ?? "Admin");

  const title = String(req.data?.title ?? "").trim();
  const body = String(req.data?.body ?? "").trim();
  const segment = String(req.data?.segment ?? "all") as Segment;
  const href = req.data?.href ? String(req.data.href).trim() : undefined;
  if (title.length < 1 || title.length > 80) throw new HttpsError("invalid-argument", "Title must be 1–80 characters.");
  if (body.length < 1 || body.length > 300) throw new HttpsError("invalid-argument", "Message must be 1–300 characters.");
  if (!SEGMENTS.includes(segment)) throw new HttpsError("invalid-argument", "Unknown audience.");
  if (href && !href.startsWith("/")) throw new HttpsError("invalid-argument", "Link must be an in-app path starting with /.");

  // Daily cap — count broadcasts in the last 24h.
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const recent = await db.collection("broadcasts").where("createdAt", ">", dayAgo).get();
  if (recent.size >= DAILY_CAP) {
    throw new HttpsError("resource-exhausted", `Daily broadcast limit (${DAILY_CAP}) reached — try again tomorrow.`);
  }

  // Resolve the segment to a set of target uids (never includes admins).
  const usersSnap = await db.collection("users").get();
  const targetUids = new Set<string>();
  usersSnap.forEach((d) => {
    const u = d.data() as AnyDoc;
    const role = u.role;
    if (role === "admin") return;
    if (segment === "all") targetUids.add(d.id);
    else if (segment === "workers" && role === "worker") targetUids.add(d.id);
    else if (segment === "employers" && (role === "employer" || role === "business")) targetUids.add(d.id);
    else if (
      segment === "available"
      && role === "worker"
      && u.availableNow === true
      && Number(u.availableNowAt ?? 0) >= now - 8 * 60 * 60 * 1000
    ) {
      targetUids.add(d.id);
    }
  });

  // Collect device tokens for those uids.
  const tokensSnap = await db.collectionGroup("fcmTokens").get();
  const tokens: { token: string; ref: FirebaseFirestore.DocumentReference }[] = [];
  tokensSnap.forEach((d) => {
    const uid = d.ref.parent.parent?.id;
    if (!uid || !targetUids.has(uid)) return;
    const t = (d.data() as AnyDoc).token;
    if (typeof t === "string" && t) tokens.push({ token: t, ref: d.ref });
  });

  let sent = 0;
  let failed = 0;
  const dead: FirebaseFirestore.DocumentReference[] = [];

  if (tokens.length > 0) {
    const messaging = getMessaging();
    for (let i = 0; i < tokens.length; i += 500) {
      const chunk = tokens.slice(i, i + 500);
      let res;
      try {
        res = await messaging.sendEachForMulticast({
          tokens: chunk.map((t) => t.token),
          notification: { title, body },
          data: { broadcast: "1", ...(href ? { href } : {}) },
          webpush: {
            fcmOptions: href ? { link: href } : undefined,
            notification: { icon: "/icon-192.png", badge: "/icon-192.png" },
          },
        });
      } catch (err) {
        logger.error("broadcast: multicast chunk failed", { err: String(err) });
        failed += chunk.length;
        continue;
      }
      res.responses.forEach((r, j) => {
        if (r.success) {
          sent += 1;
          return;
        }
        failed += 1;
        const code = r.error?.code ?? "";
        if (
          code === "messaging/invalid-registration-token"
          || code === "messaging/registration-token-not-registered"
          || code === "messaging/invalid-argument"
        ) {
          dead.push(chunk[j].ref);
        }
      });
    }
    // Prune dead tokens.
    for (let i = 0; i < dead.length; i += 450) {
      const batch = db.batch();
      dead.slice(i, i + 450).forEach((ref) => batch.delete(ref));
      try {
        await batch.commit();
      } catch (err) {
        logger.warn("broadcast: token prune failed", { err: String(err) });
      }
    }
  }

  // Record + audit (admin SDK bypasses rules).
  await db.collection("broadcasts").add({
    title, body, segment, href: href ?? null,
    recipients: targetUids.size, devices: tokens.length, sent, failed,
    adminUid: req.auth.uid, adminName, createdAt: now,
  });
  await db.collection("auditLog").add({
    adminUid: req.auth.uid, adminName,
    action: "broadcast_sent",
    note: `${segment}: "${title}" → ${sent}/${tokens.length} devices`,
    at: now, atServer: FieldValue.serverTimestamp(),
  });

  logger.info("broadcast sent", { segment, recipients: targetUids.size, devices: tokens.length, sent, failed });
  return { recipients: targetUids.size, devices: tokens.length, sent, failed };
});
