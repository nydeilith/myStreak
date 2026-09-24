// myStreak Worker: /api/* isteklerini karşılar, geri kalan her şeyi public/ klasöründen sunar.
// Zamanlanmış görev (wrangler.jsonc -> triggers.crons) günlük hatırlatmaları gönderir.
import { json, readJson, sameSecret, HttpError } from '../lib/http.js';
import { readData, writeData, readSubs, writeSubs, requireKV } from '../lib/store.js';
import { getVapid, sendPush } from '../lib/webpush.js';
import { runReminders } from '../lib/reminders.js';

function validSubscription(s) {
  return s && typeof s.endpoint === 'string' && s.endpoint.startsWith('https://')
    && s.keys && typeof s.keys.p256dh === 'string' && typeof s.keys.auth === 'string';
}

async function habitsApi(request, env) {
  if (request.method === 'GET') return json(await readData(env));
  if (request.method === 'PUT') {
    const body = await readJson(request);
    if (!body || !Array.isArray(body.habits)) throw new HttpError(400, 'habits array required');
    await writeData(env, body);
    return json({ ok: true });
  }
  throw new HttpError(405, 'method not allowed');
}

async function pushApi(request, env) {
  requireKV(env);
  if (request.method === 'GET') return json({ publicKey: (await getVapid(env.DB)).publicKey });
  if (request.method !== 'POST') throw new HttpError(405, 'method not allowed');

  const { action, subscription, time, tz } = await readJson(request, 8 * 1024);
  if (!validSubscription(subscription)) throw new HttpError(400, 'invalid subscription');
  const origin = new URL(request.url).origin;
  const subs = await readSubs(env);
  const existing = subs.find((s) => s.subscription.endpoint === subscription.endpoint);
  const others = subs.filter((s) => s !== existing);

  if (action === 'unsubscribe') {
    await writeSubs(env, others);
    return json({ ok: true });
  }
  if (action === 'subscribe') {
    const newTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : '21:00';
    others.push({
      subscription: { endpoint: subscription.endpoint, keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth } },
      time: newTime,
      tz: typeof tz === 'string' && tz.length < 64 ? tz : 'Europe/Istanbul',
      origin,
      // Saat değiştiyse bugünkü hatırlatma yeni saatte tekrar gelebilsin
      lastSent: existing && existing.time === newTime ? existing.lastSent : null,
    });
    await writeSubs(env, others.slice(-20));
    return json({ ok: true });
  }
  if (action === 'test') {
    const status = await sendPush(env.DB, subscription, { title: 'myStreak 🔥', body: 'Bildirimler çalışıyor! Hatırlatmalar bu şekilde gelecek.' }, origin);
    return json({ ok: status >= 200 && status < 300, status });
  }
  throw new HttpError(400, 'unknown action');
}

async function handleApi(request, env) {
  if (env.APP_PASSWORD && !sameSecret(request.headers.get('X-App-Password') || '', env.APP_PASSWORD)) {
    return json({ error: 'unauthorized' }, 401);
  }
  const { pathname } = new URL(request.url);
  try {
    if (pathname === '/api/habits') return await habitsApi(request, env);
    if (pathname === '/api/push') return await pushApi(request, env);
    return json({ error: 'not found' }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: e.message }, e.status || 500);
  }
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/api/')) return handleApi(request, env);
    return env.ASSETS.fetch(request);
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runReminders(env).then((r) => console.log('reminders', JSON.stringify(r))));
  },
};
