/* SAVE AS: sw.js · LOCATION: C:/MarvelApps/cmmgsite/app/sw.js
 * CMMG app service worker (scope /app/). Caches ONLY this site's own files (pages, css, js, images) so the app opens
 * fast and shows its frame offline. Picks, sign-in and My Tracker always go live to the CMMG relay (another origin,
 * POST) and are never cached - a member never sees an old board from the cache. Only successful responses are stored.
 * Bump VERSION on every release of the frame. */
const VERSION = "cmmg-app-v34";
const CORE = ["/app/", "/app/welcome/", "/app/dashboard/", "/app/results/", "/app/scores/", "/app/game/", "/app/schedule/", "/app/team/", "/app/standings/", "/app/player/", "/app/alerts/", "/app/learn/", "/app/sport/", "/app/tracker/", "/app/account/", "/app/tools/", "/app/community/", "/app/soon/",
  "/css/app.css", "/js/cmmg.js", "/js/shell.js", "/js/icons.js", "/img/splash.jpg", "/img/lion_64.png", "/img/icon_192.png", "/img/crest.jpg"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(CORE.map(u => fetch(u).then(r => r.ok && c.put(u, r)).catch(() => {})))));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;          // relay / Discord / anything else: untouched
  // pages, scripts and styles: NETWORK FIRST so members always run the newest release; the cache is only the offline
  // fallback. Images: cache first (they don't change between releases).
  const page = e.request.mode === "navigate", img = /\.(png|jpe?g|webp|svg)$/i.test(u.pathname);
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: page });
    const net = fetch(e.request, img ? {} : { cache: "no-cache" }).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; });   // no-cache = ask the server (ETag), never a stale 10-min copy
    if (img && hit) { net.catch(() => {}); return hit; }
    return net.catch(() => hit || (page ? c.match("/app/") : Response.error()));
  }));
});
