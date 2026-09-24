// Zamanlayıcı bu adresi ~15 dakikada bir çağırır: /api/cron?key=CRON_SECRET
// Hatırlatma saati gelmiş ve bugün bitmemiş alışkanlığı olan cihazlara bildirim gönderir.
import { json, sameSecret } from '../../lib/http.js';
import { readData, readSubs, writeSubs } from '../../lib/store.js';
import { sendPush } from '../../lib/webpush.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function localNow(now, tz) {
  let fmt;
  try {
    fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' });
  } catch {
    return localNow(now, 'Europe/Istanbul');
  }
  const p = Object.fromEntries(fmt.formatToParts(now).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, dow: WEEKDAYS.indexOf(p.weekday) };
}

function pendingFor(habits, { date, dow }) {
  return habits.filter((h) => {
    const days = Array.isArray(h.days) && h.days.length ? h.days : [0, 1, 2, 3, 4, 5, 6];
    return days.includes(dow) && !(h.history || []).includes(date) && !(h.skips || []).includes(date);
  });
}

function messageFor(pending) {
  const names = pending.slice(0, 3).map((h) => `${h.emoji || '🔥'} ${h.name}`).join(' · ');
  const more = pending.length > 3 ? ` +${pending.length - 3}` : '';
  return {
    title: pending.length === 1 ? '🔥 Serini bozma! 1 alışkanlık kaldı' : `🔥 Serini bozma! ${pending.length} alışkanlık kaldı`,
    body: names + more,
  };
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  if (!env.CRON_SECRET || !sameSecret(url.searchParams.get('key') || '', env.CRON_SECRET)) {
    return json({ error: 'unauthorized' }, 401);
  }
  const subs = await readSubs(env);
  if (!subs.length) return json({ sent: 0 });

  const habits = (await readData(env)).habits || [];
  const now = new Date();
  const keep = [];
  let sent = 0, changed = false;

  for (const s of subs) {
    const local = localNow(now, s.tz);
    if (local.time >= s.time && s.lastSent !== local.date) {
      s.lastSent = local.date;
      changed = true;
      const pending = pendingFor(habits, local);
      if (pending.length) {
        const status = await sendPush(env.DB, s.subscription, messageFor(pending), url.origin);
        if (status === 404 || status === 410) continue; // abonelik iptal edilmiş
        if (status >= 200 && status < 300) sent++;
      }
    }
    keep.push(s);
  }
  if (changed) await writeSubs(env, keep);
  return json({ sent, subscribers: keep.length });
}
