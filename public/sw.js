// myStreak service worker: çevrimdışı açılış + bildirimler
const CACHE = 'mystreak-v3';
const ASSETS = ['/', '/manifest.webmanifest', '/icon.svg', '/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Önce ağ, olmazsa önbellek (API istekleri hiç önbelleğe alınmaz)
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('/'))),
  );
});

self.addEventListener('push', (e) => {
  let msg = { title: 'myStreak 🔥', body: 'Bugünkü alışkanlıklarını unutma!' };
  try { if (e.data) msg = { ...msg, ...e.data.json() }; } catch (err) {}
  e.waitUntil(self.registration.showNotification(msg.title, {
    body: msg.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'mystreak-daily',
    renotify: true,
    data: { url: '/' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.focus();
      return self.clients.openWindow(e.notification.data?.url || '/');
    }),
  );
});
