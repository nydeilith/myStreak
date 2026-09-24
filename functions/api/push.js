// Bildirim aboneliği: GET -> VAPID public key, POST {action: subscribe|unsubscribe|test}
import { json, readJson, HttpError } from '../../lib/http.js';
import { readSubs, writeSubs, requireKV } from '../../lib/store.js';
import { getVapid, sendPush } from '../../lib/webpush.js';

export async function onRequestGet({ env }) {
  requireKV(env);
  return json({ publicKey: (await getVapid(env.DB)).publicKey });
}

function validSubscription(s) {
  return s && typeof s.endpoint === 'string' && s.endpoint.startsWith('https://')
    && s.keys && typeof s.keys.p256dh === 'string' && typeof s.keys.auth === 'string';
}

export async function onRequestPost({ request, env }) {
  requireKV(env);
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
