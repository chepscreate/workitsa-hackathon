/**
 * Scheduler heartbeats → the admin System-health card.
 *
 * Every scheduled function calls beat(name) at the top of its handler, so
 * opsHealth/{name} always carries the last time it actually ran. A silently
 * broken scheduler (disabled job, crashed deploy, quota) then shows up as an
 * overdue row on the admin Overview instead of being discovered days later
 * when its work is missing.
 *
 * Fire-and-forget by design: a heartbeat failure must never break the real
 * work, so callers don't await it and errors only log.
 */
import { logger } from "firebase-functions";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

export function beat(name: string): void {
  getFirestore()
    .doc(`opsHealth/${name}`)
    .set({ lastRunAt: Date.now(), at: FieldValue.serverTimestamp() }, { merge: true })
    .catch((err) => logger.warn("heartbeat failed", { name, err: String(err) }));
}
