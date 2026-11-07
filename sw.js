// Sthira offline cache. Bump CACHE_VERSION whenever any site file changes.
const CACHE_VERSION = "sthira-v1";
const SITE_FILES = [
  "./", "index.html", "style.css", "data.js", "plan.js", "generator.js", "core.js", "ui.js", "views.js",
  "voice/clips.js", "voice.js", "player.js", "today.js", "planview.js", "flows.js", "nav.js", "app.js", "manifest.webmanifest", "icon.svg", "icon-180.png", "icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(SITE_FILES)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// The page asks a waiting worker to take over when the visitor taps the update toast.
self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});

// Cache first for speed offline. A new version arrives through a new CACHE_VERSION.
// Voice clips and pose figures are not precached: each one is saved the first time it loads.
function fromNetwork(req) {
  return fetch(req).then((res) => {
    if (res.ok && res.status === 200) {
      const copy = res.clone();
      caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
    }
    return res;
  });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin || req.headers.has("range")) return;
  event.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fromNetwork(req).catch(() => {
    if (req.mode === "navigate") return caches.match("./");
    return Response.error();
  })));
});
