// Sthira offline cache. Bump CACHE_VERSION whenever any site file changes.
const CACHE_VERSION = "sthira-v7";
const SITE_FILES = [
  "./", "index.html", "style.css", "data.js", "align.js", "plan.js", "generator.js", "core.js", "stats.js", "ui.js", "media.js", "pose-photos.js", "views.js",
  "voice/clips.js", "voice.js", "music.js", "player.js", "today.js", "planview.js", "flows.js", "welcome.js", "progress.js", "nav.js", "app.js", "manifest.webmanifest", "icon.svg", "icon-180.png", "icon-512.png",
  // Photos on Today and the welcome page, so the first screens look right offline.
  "media/hero-sunrise-silhouette-poster.jpg", "media/practice-deck-by-sea-poster.jpg",
  "media/photo-senior-lunge-with-block-800.webp", "media/photo-senior-lunge-with-block-1600.webp",
  "media/photo-seated-breathing-wicker-chair-800.webp", "media/photo-seated-breathing-wicker-chair-1600.webp",
  "media/photo-props-cork-blocks-600.webp", "media/photo-props-cork-blocks-1200.webp",
  "photos/poses/virabhadrasana2-400.webp", "photos/poses/virabhadrasana2-800.webp",
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
// Voice clips, pose figures, pose photos, photos and videos are not precached. Each one is saved the first time it loads.
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
