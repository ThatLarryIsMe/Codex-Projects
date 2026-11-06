// Tellwell service worker: keeps the app itself available offline.
// Audio lives in IndexedDB, so only the app shell is cached here.
const CACHE = "tellwell-v1";
const SHELL = ["./", "index.html", "styles.css", "manifest.webmanifest", "icons/icon.svg", "js/app.js", "js/api.js", "js/audio.js", "js/chunker.js", "js/db.js", "js/generator.js", "js/player.js", "js/pdf-extract.js", "js/structure.js", "js/voices.js", "vendor/pdfjs/pdf.min.mjs", "vendor/pdfjs/pdf.worker.min.mjs"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first (so updates arrive), cache as the offline fallback. Never touch /api.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.includes("/api/")) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html")))
  );
});
