/* SAVE AS: sw.js · LOCATION: C:/MarvelApps/cmmgsite/app/sw.js
 * CMMG app service worker (scope /app/). Caches ONLY this site's own files (pages, css, js, images) so the app opens
 * fast and shows its frame offline. Picks, sign-in and My Tracker always go live to the CMMG relay (another origin,
 * POST) and are never cached - a member never sees an old board from the cache. Only successful responses are stored.
 * Bump VERSION on every release of the frame. */
const VERSION = "cmmg-app-v9";
const CORE = ["/app/", "/app/dashboard/", "/app/results/", "/app/scores/", "/app/tracker/", "/app/account/", "/app/tools/", "/app/community/", "/app/soon/",
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
  // pages: network first (fresh code), cache as the offline fallback; files: cache first, refreshed in the background
  const page = e.request.mode === "navigate";
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: page });
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; });
    if (page) return net.catch(() => hit || c.match("/app/"));
    return hit ? (net.catch(() => {}), hit) : net;
  }));
});
