// Hatırlatma saati gelmiş ve bugün bitmemiş alışkanlığı olan cihazlara bildirim gönderir.
import { readData, readSubs, writeSubs } from './store.js';
import { sendPush } from './webpush.js';

const IMAGE_ICONS = { books: '📚', 'book-heart': '📖', sprout: '🌱', scroll: '📜', snowflake: '❄️' };
const iconText = (e) => (typeof e === 'string' && e.startsWith('img:') ? IMAGE_ICONS[e.slice(4)] || '✨' : e || '🔥');

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
  const names = pending.slice(0, 3).map((h) => `${iconText(h.emoji)} ${h.name}`).join(' · ');
  const more = pending.length > 3 ? ` +${pending.length - 3}` : '';
  return { title: `🔥 Serini bozma! ${pending.length} alışkanlık kaldı`, body: names + more };
}

export async function runReminders(env, now = new Date()) {
  if (!env.DB) return { sent: 0, error: 'no KV' };
  const subs = await readSubs(env);
  if (!subs.length) return { sent: 0 };

  const habits = (await readData(env)).habits || [];
  const keep = [];
  let sent = 0, changed = false;

  for (const s of subs) {
    const local = localNow(now, s.tz);
    if (local.time >= s.time && s.lastSent !== local.date) {
      s.lastSent = local.date;
      changed = true;
      const pending = pendingFor(habits, local);
      if (pending.length) {
        try {
          const status = await sendPush(env.DB, s.subscription, messageFor(pending), s.origin || 'mailto:mystreak@example.com');
          if (status === 404 || status === 410) continue; // abonelik iptal edilmiş
          if (status >= 200 && status < 300) sent++;
        } catch (e) {
          console.error(e);
        }
      }
    }
    keep.push(s);
  }
  if (changed) await writeSubs(env, keep);
  return { sent, subscribers: keep.length };
}
