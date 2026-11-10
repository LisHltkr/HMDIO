// Service Worker der Web-App: hält eine Kopie der App für den Offline-Betrieb.
// Strategie „erst Netz, dann Kopie“: online gibt es immer die neueste Version,
// offline die zuletzt geladene. Anfragen an andere Server (z. B. den Sync-Server)
// fasst er nicht an, und deine Daten liegen nicht hier, sondern im Speicher der App.
const CACHE = 'finanz-cockpit-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) if (name !== CACHE) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const anfrage = event.request;
  if (anfrage.method !== 'GET' || new URL(anfrage.url).origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const antwort = await fetch(anfrage);
        if (antwort.ok) await cache.put(anfrage, antwort.clone());
        return antwort;
      } catch (fehler) {
        const kopie =
          (await cache.match(anfrage)) ??
          (anfrage.mode === 'navigate' ? await cache.match(self.registration.scope) : undefined);
        if (kopie) return kopie;
        throw fehler;
      }
    })(),
  );
});
