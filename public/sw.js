// Workit service worker — minimal offline support.
// Strategy:
//   - HTML pages: network-first, fall back to cached page, then /offline.html.
//   - Static assets (JS/CSS/fonts/images): cache-first, refresh in background.
//   - Don't touch Firebase / Sentry / API calls — they need fresh network.
//
// Bumping CACHE_VERSION discards the old cache on the next activate.

// Bump this on any deploy you suspect of stale-cache issues — the activate
// handler deletes every cache that isn't the current version, so a device
// holding a poisoned/mismatched bundle (seen on older iOS Safari) self-heals
// on its next visit.
const CACHE_VERSION = "workit-v2-2026-05-27";
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const PAGE_CACHE = `pages-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";

// Pages we always want available offline.
const SHELL_URLS = [
  "/",
  "/offline.html",
  "/manifest.webmanifest",
  "/apple-icon.png",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll(SHELL_URLS)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== PAGE_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

const SKIP_HOSTS = [
  "firestore.googleapis.com",
  "firebasestorage.googleapis.com",
  "identitytoolkit.googleapis.com",
  "securetoken.googleapis.com",
  "sentry.io",
  "ingest.sentry.io",
  "sendgrid",
];

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (SKIP_HOSTS.some((h) => url.hostname.includes(h))) return;

  // HTML navigations → network-first, fallback to cached, fallback to offline page
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(PAGE_CACHE);
          cache.put(req, fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          const cached = await caches.match(req);
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL);
          return offline ?? new Response("Offline", { status: 503 });
        }
      })(),
    );
    return;
  }

  // Static assets → cache-first, background refresh
  if (
    req.destination === "script"
    || req.destination === "style"
    || req.destination === "font"
    || req.destination === "image"
  ) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        const fetchPromise = fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(req, copy).catch(() => {}));
            return res;
          })
          .catch(() => cached || Response.error());
        return cached || fetchPromise;
      })(),
    );
  }
});
