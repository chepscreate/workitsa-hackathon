/**
 * Global Cloud Functions configuration.
 *
 * IMPORTANT: this module must be imported BEFORE any function-defining module
 * (email.ts, moderation.ts, …). firebase-functions v2 reads the global options
 * at the moment each function is defined, so the region has to be set first.
 * index.ts imports this as its very first line to guarantee that ordering.
 *
 * Every Workit function (and the Storage bucket) lives in africa-south1 — the
 * closest region to our users. Without this, functions default to us-central1,
 * which both adds latency and breaks the Storage trigger (a storage function
 * must share its bucket's region).
 */
import { setGlobalOptions } from "firebase-functions/v2";

setGlobalOptions({ region: "africa-south1" });
