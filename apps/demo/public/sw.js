/*
 * Minimal dependency-free service worker for the Pore.js demo.
 *
 *  - app shell + build assets: stale-while-revalidate (instant load, refresh in bg)
 *  - /fixtures/** and the pdf.js worker: cache-first (immutable content)
 *
 * Bump CACHE_VERSION to roll all caches.
 */
const CACHE_VERSION = 'pore-demo-v3';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const MEDIA_CACHE = `${CACHE_VERSION}-media`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(['/', '/index.html']);
      // The build assets are content-hashed, so their names aren't known here —
      // pull them out of index.html and precache them, otherwise the very first
      // page load (which happens before this SW controls the page) is the only
      // time they're fetched and they never land in the cache for offline use.
      try {
        const html = await (await fetch('/index.html', { cache: 'reload' })).text();
        const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
        if (assets.length) await cache.addAll(assets);
      } catch {
        // offline install, or no /assets/ — stale-while-revalidate fills the
        // cache on the next online load instead
      }
    })(),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

const isMedia = (url) =>
  url.pathname.startsWith('/fixtures/') ||
  url.pathname.includes('pdf.worker') ||
  url.pathname.includes('search-worker');

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // SPA navigations: the URL carries a `?book=` query the exact-match cache
  // never stored, so fall back to the app shell when the network is gone.
  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request));
    return;
  }
  if (isMedia(url)) {
    event.respondWith(cacheFirst(request, MEDIA_CACHE));
    return;
  }
  event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
});

async function navigationHandler(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    return (
      (await cache.match(request)) ||
      (await cache.match('/index.html')) ||
      (await cache.match('/')) ||
      Response.error()
    );
  }
}

// `ignoreVary` so a `Vary: Origin` on the built assets (which the preview
// server sends, but the SW's own precache fetch has no Origin to match)
// doesn't hide an otherwise-valid cache hit when we're offline.
const MATCH_OPTS = { ignoreVary: true };

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request, MATCH_OPTS);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request, MATCH_OPTS);
  const network = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || network || Response.error();
}
