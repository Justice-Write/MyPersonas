/* Noo YouNiverse service worker
 *
 * Design note — read before changing the fetch strategy.
 *
 * Documents are NETWORK-FIRST, deliberately. This site publishes a corrections
 * log and a sources ledger, and its charter promises that corrections appear at
 * the same visibility as the mistake. A cache-first document strategy would let
 * an installed copy keep serving a page that has since been corrected. For most
 * sites that is a performance trade-off; here it would break the central promise.
 * Cache is the fallback for offline, never the preferred source for a document.
 *
 * Static assets (icons, images) are cache-first — they are content-addressed by
 * filename and change rarely.
 *
 * Bump CACHE_VERSION whenever the shell changes. Old caches are deleted on activate.
 */

const CACHE_VERSION = 'noo-v2-education-2026-10-01';
const CACHE_NAME = `noo-youniverse-${CACHE_VERSION}`;

// The shell: enough to render something honest while offline.
// Mission-log photographs are deliberately NOT precached — roughly 1 MB of
// imagery is not worth forcing onto someone's phone at install time.
const PRECACHE_URLS = [
  '/',
  '/log',
  '/sources',
  '/education',
  '/assets/education.css',
  '/corrections',
  '/404.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/assets/favicon.svg',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/icon-maskable-192.png',
  '/assets/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // addAll is atomic: one 404 would reject the whole install, so add
      // individually and tolerate misses rather than shipping a dead worker.
      .then((cache) => Promise.all(
        PRECACHE_URLS.map((url) => cache.add(url).catch(() => undefined))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('noo-youniverse-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never touch anything but same-origin GETs.
  // This matters: the waitlist POSTs to Supabase. Those must pass straight
  // through to the network, uncached and uninspected.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isDocument =
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html');

  if (isDocument) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;

    // Unknown route while offline: serve the dedicated offline page, then the
    // cached home page, then a last-resort inline message. Never pretend to
    // have content — an offline shell that looks like an article would be the
    // one lie this project cannot afford.
    const offline = await cache.match('/offline.html');
    if (offline) {
      return new Response(offline.body, {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    return (
      (await cache.match('/')) ||
      new Response(
        '<!DOCTYPE html><meta charset="utf-8"><title>Offline — Noo YouNiverse</title>' +
          '<body style="background:#0b0e24;color:#e9ebf7;font-family:system-ui,sans-serif;' +
          'display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px">' +
          '<div><p style="letter-spacing:.22em;font-size:.75rem;color:#8f7dff;font-weight:700">SIGNAL LOST</p>' +
          '<h1 style="font-size:1.5rem;margin:.3em 0">You are offline.</h1>' +
          '<p style="color:#a7add0;max-width:44ch">This page has not been saved to the ship. ' +
          'Reconnect and try again.</p></div></body>',
        { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      )
    );
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}
