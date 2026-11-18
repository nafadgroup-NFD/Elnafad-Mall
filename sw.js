// NFD service worker: the app opens fast and offline, but prices/products are always fetched live.
const V = "nfd-shell-v1", IMG = "nfd-img-v1";
const SHELL = ["./", "index.html", "manifest.json", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== IMG).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET") return;
  // product data and prices come straight from the network (never cached)
  if (u.hostname.endsWith("google.com") || u.hostname.endsWith("googleusercontent.com")) return;
  // product photos: show the cached copy instantly, refresh it in the background
  if (u.origin === location.origin && u.pathname.includes("/img/")) {
    e.respondWith(caches.open(IMG).then(async c => {
      const hit = await c.match(r);
      const net = fetch(r).then(res => { if (res.ok) c.put(r, res.clone()); return res; }).catch(() => null);
      return hit || (await net) || Response.error();
    }));
    return;
  }
  // the app itself: network first so updates arrive, cache as an offline fallback
  if (u.origin === location.origin) {
    e.respondWith(fetch(r).then(res => {
      const cp = res.clone();
      caches.open(V).then(c => c.put(r, cp));
      return res;
    }).catch(() => caches.match(r).then(h => h || caches.match("index.html"))));
  }
});
