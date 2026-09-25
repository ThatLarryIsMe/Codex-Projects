// Offline support for dead zones: the app shell is cached up front; map tiles
// and bird photos are cached as you drive so they still show without signal.
const SHELL = "bd-shell-v7";
const MEDIA = "bd-media-v1";
const MEDIA_LIMIT = 800;

const SHELL_FILES = [
  "./",
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "icons/icon.svg",
  "js/app.js",
  "js/birds.js",
  "js/sources.js",
  "js/store.js",
  "js/sketch.js",
  "js/fx.js",
  "js/leaderboard.js",
  "js/share.js",
  "vendor/leaflet/leaflet.js",
  "vendor/leaflet/leaflet.css",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== MEDIA).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MEDIA_LIMIT; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Leaderboard and bird APIs are cached by the app itself; never serve stale here.
  if (url.pathname.includes("/api/") || url.hostname.startsWith("api.")) return;

  if (url.origin === location.origin) {
    // Network first so updates land quickly, falling back to the cached shell.
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(SHELL).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("index.html")))
    );
    return;
  }

  // Audio uses range requests (206), which the Cache API can't store.
  if (req.destination === "audio" || req.headers.has("range")) return;

  const isMedia =
    req.destination === "image" ||
    /tile\.openstreetmap\.org|arcgisonline\.com|inaturalist|wikimedia|fonts\.(googleapis|gstatic)\.com/.test(url.hostname);
  if (!isMedia) return;
  e.respondWith(
    caches.open(MEDIA).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === "opaque") {
        cache.put(req, res.clone()).then(() => trim(cache));
      }
      return res;
    })
  );
});
