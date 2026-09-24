// Veri deposu: Cloudflare KV (binding adı: DB).
// KV boşsa ve jsonbin bilgileri tanımlıysa, eski veriler bir kereliğine jsonbin'den aktarılır.
import { HttpError } from './http.js';

const DATA_KEY = 'data';
const SUBS_KEY = 'push_subs';

const hasJsonbin = (env) => Boolean(env.JSONBIN_BIN_ID && env.JSONBIN_KEY);

async function readJsonbin(env) {
  const r = await fetch(`https://api.jsonbin.io/v3/b/${env.JSONBIN_BIN_ID}/latest`, {
    headers: { 'X-Master-Key': env.JSONBIN_KEY, 'X-Bin-Meta': 'false' },
  });
  if (!r.ok) throw new HttpError(502, `jsonbin ${r.status}`);
  return r.json();
}

export async function readData(env) {
  if (env.DB) {
    const data = await env.DB.get(DATA_KEY, 'json');
    if (data) return data;
    if (!hasJsonbin(env)) return { habits: [] };
    const old = await readJsonbin(env);
    await env.DB.put(DATA_KEY, JSON.stringify(old));
    return old;
  }
  if (hasJsonbin(env)) return readJsonbin(env);
  throw new HttpError(500, 'Depolama ayarlanmamış: Pages projesine "DB" adında bir KV namespace bağla');
}

export async function writeData(env, data) {
  if (env.DB) return env.DB.put(DATA_KEY, JSON.stringify(data));
  if (!hasJsonbin(env)) throw new HttpError(500, 'Depolama ayarlanmamış');
  const r = await fetch(`https://api.jsonbin.io/v3/b/${env.JSONBIN_BIN_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Master-Key': env.JSONBIN_KEY },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new HttpError(502, `jsonbin ${r.status}`);
}

export function requireKV(env) {
  if (!env.DB) throw new HttpError(501, 'Bildirimler için "DB" adında bir KV namespace bağlanmalı');
}

export async function readSubs(env) {
  requireKV(env);
  return (await env.DB.get(SUBS_KEY, 'json')) || [];
}

export async function writeSubs(env, subs) {
  requireKV(env);
  await env.DB.put(SUBS_KEY, JSON.stringify(subs));
}
