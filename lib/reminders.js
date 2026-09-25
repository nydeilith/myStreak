// Zamanlanmış bildirimler:
//  - Günlük alışkanlık hatırlatması (cihazın seçtiği saatte, bitmemiş alışkanlık varsa)
//  - Aklımda notları (hatırlatma zamanı gelince, tüm cihazlara bir kez)
//  - Pazar 20:00 haftalık özet
import { readData, readSubs, writeSubs } from './store.js';
import { sendPush } from './webpush.js';

const IMAGE_ICONS = { books: '📚', 'book-heart': '📖', sprout: '🌱', scroll: '📜', snowflake: '❄️' };
const iconText = (e) => (typeof e === 'string' && e.startsWith('img:') ? IMAGE_ICONS[e.slice(4)] || '✨' : e || '🔥');
// Gizli alışkanlıkların adı bildirimde görünmez (kilit ekranında başkası görebilir)
const label = (h) => (h.private ? 'gizli bir alışkanlık' : h.name);
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const NOTE_MAX_DELAY = 6 * 3600e3; // bundan eski kaçmış hatırlatmaları gönderme

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

const shiftKey = (key, n) => { const d = new Date(`${key}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dowOf = (key) => new Date(`${key}T00:00:00Z`).getUTCDay();

// İstemcideki mantığın aynısı: yapıldı / nötr (izinli ya da plan dışı) / kaçırıldı
function habitView(h) {
  const done = new Set(h.history || []), skip = new Set(h.skips || []);
  const days = new Set(Array.isArray(h.days) && h.days.length ? h.days : ALL_DAYS);
  const firsts = [(h.history || [])[0], (h.skips || [])[0], h.createdAt ? new Date(h.createdAt).toISOString().slice(0, 10) : null].filter(Boolean).sort();
  const state = (k) => (done.has(k) ? 'on' : skip.has(k) || !days.has(dowOf(k)) ? 'off' : 'miss');
  return { state, start: firsts[0] || '9999-12-31' };
}

function currentStreak(h, today) {
  const { state, start } = habitView(h);
  let n = 0;
  for (let k = state(today) === 'miss' ? shiftKey(today, -1) : today; k >= start; k = shiftKey(k, -1)) {
    const s = state(k);
    if (s === 'on') n++;
    else if (s === 'miss') break;
  }
  return n;
}

// İstemcideki seri koruyucu ile aynı kural: aktif seri varken kaçırılan planlı gün, ayda 2 güne kadar korunur
function frozenOn(h, settings, key) {
  if (!settings || settings.freezeOn === false || !settings.freezeFrom) return false;
  const { state, start } = habitView(h);
  let alive = false, month = '', used = 0;
  for (let k = start; k <= key; k = shiftKey(k, 1)) {
    if (k.slice(0, 7) !== month) { month = k.slice(0, 7); used = 0; }
    const s = state(k);
    if (s === 'on') { alive = true; continue; }
    if (s === 'off') continue;
    const frz = alive && k >= settings.freezeFrom && used < 2;
    if (frz) used++; else alive = false;
    if (k === key) return frz;
  }
  return false;
}

function dailyMessage(habits, local, settings) {
  const yesterday = shiftKey(local.date, -1);
  const saved = habits.filter((h) => habitView(h).state(yesterday) === 'miss' && frozenOn(h, settings, yesterday));
  const note = saved.length ? `Dün ${saved.map(label).join(', ')} kaçtı; seri koruyucu serini korudu. ` : '';
  const pending = habits.filter((h) => habitView(h).state(local.date) === 'miss');
  if (!pending.length) return note ? { title: 'Seri koruyucu devrede', body: note.trim() } : null;
  const names = pending.slice(0, 3).map((h) => (h.private ? '🔒 gizli' : `${iconText(h.emoji)} ${h.name}`)).join(' · ');
  const more = pending.length > 3 ? ` +${pending.length - 3}` : '';
  return { title: `Serini bozma: ${pending.length} alışkanlık kaldı`, body: note + names + more };
}

function weeklyMessage(habits, goals, local) {
  if (!habits.length) return null;
  let hit = 0, due = 0;
  const back = (local.dow + 6) % 7; // Pazartesiden bugüne
  for (let i = 0; i <= back; i++) {
    const k = shiftKey(local.date, -i);
    for (const h of habits) {
      const v = habitView(h);
      if (k < v.start) continue;
      const s = v.state(k);
      if (s === 'on') { hit++; due++; } else if (s === 'miss' && i > 0) due++;
    }
  }
  const best = habits.filter((h) => !h.private).map((h) => [h, currentStreak(h, local.date)]).sort((a, b) => b[1] - a[1])[0];
  const parts = [due ? `Bu hafta %${Math.round((hit / due) * 100)} tamamladın.` : 'Bu hafta sakin geçti.'];
  if (best && best[1] > 1) parts.push(`En uzun serin: ${iconText(best[0].emoji)} ${best[0].name}, ${best[1]} gün.`);
  const active = (goals || []).filter((g) => !g.doneAt).length;
  if (active) parts.push(`${active} aktif hedefin var.`);
  return { title: 'Haftalık özet', body: parts.join(' '), tag: 'mystreak-weekly' };
}

export async function runReminders(env, now = new Date()) {
  if (!env.DB) return { sent: 0, error: 'no KV' };
  const subs = await readSubs(env);
  if (!subs.length) return { sent: 0 };

  const data = await readData(env);
  const habits = data.habits || [], notes = data.notes || [], goals = data.goals || [];
  const dead = new Set();
  let sent = 0, subsChanged = false;

  const deliver = async (s, message) => {
    try {
      const status = await sendPush(env.DB, s.subscription, message, s.origin || 'mailto:mystreak@example.com');
      if (status === 404 || status === 410) dead.add(s.subscription.endpoint);
      else if (status >= 200 && status < 300) sent++;
    } catch (e) {
      console.error(e);
    }
  };

  for (const s of subs) {
    const local = localNow(now, s.tz);
    if (local.time >= s.time && s.lastSent !== local.date) {
      s.lastSent = local.date;
      subsChanged = true;
      const msg = dailyMessage(habits, local, data.settings);
      if (msg) await deliver(s, msg);
    }
    if (local.dow === 0 && local.time >= '20:00' && s.lastWeekly !== local.date) {
      s.lastWeekly = local.date;
      subsChanged = true;
      const msg = weeklyMessage(habits, goals, local);
      if (msg) await deliver(s, msg);
    }
  }

  // Aklımda: zamanı gelen notlar. Gönderilenleri ayrı tutuyoruz ki istemcinin kaydı bunu ezmesin.
  const sentNotes = (await env.DB.get('notes_sent', 'json')) || {};
  const nowMs = now.getTime();
  let notesChanged = false;
  for (const n of notes) {
    if (!n.remindAt || n.doneAt || n.remindAt > nowMs || sentNotes[n.id] === n.remindAt) continue;
    sentNotes[n.id] = n.remindAt;
    notesChanged = true;
    if (nowMs - n.remindAt > NOTE_MAX_DELAY) continue;
    const message = {
      title: 'Aklındaydı',
      body: n.text,
      tag: `note-${n.id}`,
      url: '/#aklimda',
      noteId: n.id,
      actions: [{ action: 'done', title: 'Yaptım' }, { action: 'snooze', title: '1 saat ertele' }],
    };
    for (const s of subs) if (!dead.has(s.subscription.endpoint)) await deliver(s, message);
  }
  const ids = new Set(notes.map((n) => String(n.id)));
  for (const id of Object.keys(sentNotes)) if (!ids.has(id)) { delete sentNotes[id]; notesChanged = true; }
  if (notesChanged) await env.DB.put('notes_sent', JSON.stringify(sentNotes));

  const keep = subs.filter((s) => !dead.has(s.subscription.endpoint));
  if (subsChanged || keep.length !== subs.length) await writeSubs(env, keep);
  return { sent, subscribers: keep.length };
}
