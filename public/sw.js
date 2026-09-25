// myStreak service worker: çevrimdışı açılış + bildirimler
const CACHE = 'mystreak-v13';
const AUTH = 'mystreak-auth';
const ASSETS = ['/', '/manifest.webmanifest', '/icon-192.png', '/img/flame.webp', '/img/brain.webp', '/img/target.webp', '/img/sprout.webp', '/img/snowflake.webp'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== AUTH).map((k) => caches.delete(k))))
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
  let msg = { title: 'myStreak', body: 'Bugünkü alışkanlıklarını unutma.' };
  try { if (e.data) msg = { ...msg, ...e.data.json() }; } catch (err) {}
  e.waitUntil(self.registration.showNotification(msg.title, {
    body: msg.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: msg.tag || 'mystreak-daily',
    renotify: true,
    actions: Array.isArray(msg.actions) ? msg.actions.slice(0, 2) : [],
    data: { url: msg.url || '/', noteId: msg.noteId || null },
  }));
});

async function broadcast(message) {
  const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  list.forEach((c) => c.postMessage(message));
  return list;
}

// Bildirimdeki "Yaptım" / "1 saat ertele": uygulamayı açmadan API'ye gönder
async function noteAction(id, action) {
  const cache = await caches.open(AUTH);
  const auth = await cache.match('/__auth');
  const pass = auth ? await auth.text() : '';
  const r = await fetch('/api/notes/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-App-Password': pass },
    body: JSON.stringify({ id, action }),
  });
  if (!r.ok) return openApp('/#aklimda');
  await broadcast({ type: 'reload' });
}

async function openApp(url) {
  const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const tab = (url.split('#')[1] || '').trim();
  for (const c of list) {
    if ('focus' in c) {
      if (tab) c.postMessage({ type: 'tab', tab });
      return c.focus();
    }
  }
  return self.clients.openWindow(url);
}

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const { url = '/', noteId = null } = e.notification.data || {};
  if (noteId && (e.action === 'done' || e.action === 'snooze')) e.waitUntil(noteAction(noteId, e.action));
  else e.waitUntil(openApp(url));
});
