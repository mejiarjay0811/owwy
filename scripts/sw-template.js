/* Owwy service worker — generated at build time. Offline-first app shell. */
const VERSION = "__VERSION__";
const CACHE = `owwy-${VERSION}`;
const PRECACHE = __PRECACHE__;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("owwy-") && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Only handle Owwy's own files. Anything else (e.g. the optional AI API) goes straight to the network.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(navigate(url));
    return;
  }

  // Static assets: cache first (file names are content-hashed), then network.
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          // Hashed build assets and the OCR engine are kept once fetched, so scanning works offline next time.
          if (response.ok && (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/ocr/"))) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});

async function navigate(url) {
  const path = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
  const cache = await caches.open(CACHE);
  // Serve the cached page immediately so Owwy opens instantly, even offline.
  const cached = (await cache.match(path)) || (await cache.match(url.pathname));
  if (cached) return cached;
  try {
    return await fetch(url);
  } catch {
    return (await cache.match("/")) || new Response("Owwy is offline and this page isn't cached yet.", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}
