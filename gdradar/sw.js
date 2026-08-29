/* ============================================================
   GdRadar — service worker
   Il prototipo non ha rete da interrogare: tutto quello che serve
   sta nel guscio, quindi la strategia è cache-first con
   aggiornamento in sottofondo. Cambiando VERSIONE si invalida
   tutto il vecchio.
   ============================================================ */
const VERSIONE = 'gdradar-v1';
const GUSCIO = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/base.css',
  './assets/css/components.css',
  './assets/css/app.css',
  './assets/js/util.js',
  './assets/js/geo.js',
  './assets/js/data.js',
  './assets/js/match.js',
  './assets/js/store.js',
  './assets/js/ui.js',
  './assets/js/view-public.js',
  './assets/js/view-onboarding.js',
  './assets/js/view-radar.js',
  './assets/js/view-listings.js',
  './assets/js/view-messages.js',
  './assets/js/view-fairness.js',
  './assets/js/view-profile.js',
  './assets/js/view-moderation.js',
  './assets/js/app.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(VERSIONE).then((c) => c.addAll(GUSCIO)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((chiavi) => Promise.all(chiavi.filter((k) => k !== VERSIONE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;

  /* una navigazione fuori linea deve comunque aprire l'app */
  if (req.mode === 'navigate') {
    ev.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }

  ev.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      /* i caratteri arrivano da Google Fonts: li teniamo per la volta dopo */
      if (res.ok && (req.url.startsWith(self.location.origin) || req.url.includes('fonts.g'))) {
        const copia = res.clone();
        caches.open(VERSIONE).then((c) => c.put(req, copia));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
