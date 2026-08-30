const STATIC_CACHE_NAME = "railcommand-static-v10";
const RAILCOMMAND_CACHE_PREFIX = "railcommand-";

// Only public, user-neutral files belong in Cache Storage. Project data and
// authenticated Next.js/RSC responses are intentionally excluded.
const PUBLIC_APP_SHELL = [
  "/offline.html",
  "/offline-data.js",
  "/favicon-16x16.png",
  "/favicon-32x32.png",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/manifest.json",
];

const PUBLIC_APP_SHELL_PATHS = new Set(PUBLIC_APP_SHELL);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE_NAME)
      .then((cache) => cache.addAll(PUBLIC_APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith(RAILCOMMAND_CACHE_PREFIX) && key !== STATIC_CACHE_NAME
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (event.data?.type === "CLEAR_PRIVATE_DATA") {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith(RAILCOMMAND_CACHE_PREFIX) && key !== STATIC_CACHE_NAME
            )
            .map((key) => caches.delete(key))
        )
      )
    );
  }
});

function isPublicStaticRequest(request, url) {
  if (url.origin !== self.location.origin) return false;
  return (
    PUBLIC_APP_SHELL_PATHS.has(url.pathname) ||
    url.pathname.startsWith("/_next/static/")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Navigations always go to the network. Their authenticated HTML/RSC payloads
  // must never enter Cache Storage. The neutral page is the only offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" }).catch(() => caches.match("/offline.html"))
    );
    return;
  }

  if (!isPublicStaticRequest(request, url)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          event.waitUntil(
            caches.open(STATIC_CACHE_NAME).then((cache) => cache.put(request, copy))
          );
        }
        return response;
      });
    })
  );
});
