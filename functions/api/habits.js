import { json, readJson, HttpError } from '../../lib/http.js';
import { readData, writeData } from '../../lib/store.js';

export async function onRequestGet({ env }) {
  return json(await readData(env));
}

export async function onRequestPut({ request, env }) {
  const body = await readJson(request);
  if (!body || !Array.isArray(body.habits)) throw new HttpError(400, 'habits array required');
  await writeData(env, body);
  return json({ ok: true });
}
