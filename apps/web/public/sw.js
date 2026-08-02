// Service worker PWA — installation réelle + cache offline des projets consultés (MOB-1).
//
// Stratégie volontairement prudente : seuls 3 types de requêtes sont mis en cache (voir le
// handler `fetch` plus bas), tout le reste passe en réseau direct, non intercepté. Écrit à la
// main plutôt qu'avec workbox/serwist : ce fichier est petit, s'audite d'un coup d'œil, et évite
// une étape de génération au build pour un premier périmètre PWA.
//
// Les noms de caches ci-dessous sont dupliqués en dur dans AuthContext.tsx (`clearOfflineCaches`)
// car ce fichier n'est pas un module TS importable par l'app. Si `SW_VERSION` change ici, mettre
// à jour AuthContext.tsx en conséquence.
const SW_VERSION = 'v1';
const SHELL_CACHE = `chiffreo-shell-${SW_VERSION}`;
const STATIC_CACHE = `chiffreo-static-${SW_VERSION}`;
const PAGES_CACHE = `chiffreo-pages-${SW_VERSION}`;
const API_CACHE = `chiffreo-api-${SW_VERSION}`;
const CURRENT_CACHES = [SHELL_CACHE, STATIC_CACHE, PAGES_CACHE, API_CACHE];

const OFFLINE_URL = '/offline.html';
const API_CACHE_LIMIT = 80;

const PRECACHE_URLS = [OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png', '/favicon.ico'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => !CURRENT_CACHES.includes(name)).map((name) => caches.delete(name))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Jamais intercepter les mutations : toujours réseau direct, jamais de cache.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, PAGES_CACHE, { fallbackUrl: OFFLINE_URL }));
    return;
  }

  if (sameOrigin && url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Les appels API projet sont toujours cross-origin (l'app web n'a aucune route /api locale) —
  // on les repère par ce critère plutôt que par un hôte codé en dur, pour que ça marche pareil en
  // dev (localhost:3001) et en prod sans étape de build spécifique. Ne matche pas les requêtes
  // same-origin vers /projects/... (navigations internes Next / flight fetches), qui ne sont pas
  // des appels API et suivent une autre branche (navigate ci-dessus, ou passthrough plus bas).
  if (!sameOrigin && url.pathname.includes('/projects')) {
    event.respondWith(networkFirst(request, API_CACHE, { limit: API_CACHE_LIMIT }));
    return;
  }

  // Tout le reste (auth, Sentry, Firebase, autres endpoints API, /_next/image, polices...) :
  // aucune interception, réseau natif, jamais mis en cache.
});

async function networkFirst(request, cacheName, { fallbackUrl, limit } = {}) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
      if (limit) trimCache(cacheName, limit);
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) {
      await reportOfflineView(request.url);
      return cached;
    }

    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) {
        await reportOfflineView(request.url);
        return fallback;
      }
    }

    throw err;
  }
}

// Signale aux onglets qu'une réponse a été servie hors ligne (MOB-1 : mesurer si le
// cache offline sert réellement). Le SW ne poste pas l'événement lui-même : il n'a
// pas de réseau à cet instant. Le client le met en file et l'envoie au retour de la
// connexion — voir lib/pwa-analytics.ts.
async function reportOfflineView(url) {
  const clients = await self.clients.matchAll({ type: 'window' });
  for (const client of clients) {
    client.postMessage({ type: 'offline-view', url });
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

// L'ordre de `cache.keys()` suit l'ordre d'insertion en pratique sur Chromium/Firefox, mais ce
// n'est pas garanti par la spec Cache API — ça reste une approximation "plutôt les plus anciennes
// d'abord" suffisante pour borner la croissance du cache, pas une vraie LRU.
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;

  await cache.delete(keys[0]);
  await trimCache(cacheName, maxEntries);
}
