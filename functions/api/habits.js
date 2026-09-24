// Cloudflare Pages Function: /api/habits
// jsonbin anahtarı tarayıcıya hiç gitmez; Cloudflare ortam değişkenlerinde saklanır.
//   JSONBIN_BIN_ID  -> jsonbin kutusunun ID'si
//   JSONBIN_KEY     -> jsonbin X-Master-Key (Secret olarak ekle)
//   APP_PASSWORD    -> (opsiyonel ama önerilir) uygulamaya giriş şifresi

const MAX_BYTES = 512 * 1024;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

function sameSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function onRequest({ request, env }) {
  if (env.APP_PASSWORD && !sameSecret(request.headers.get('X-App-Password') || '', env.APP_PASSWORD)) {
    return json({ error: 'unauthorized' }, 401);
  }
  if (!env.JSONBIN_BIN_ID || !env.JSONBIN_KEY) {
    return json({ error: 'JSONBIN_BIN_ID / JSONBIN_KEY ayarlanmamış' }, 500);
  }

  const binUrl = `https://api.jsonbin.io/v3/b/${env.JSONBIN_BIN_ID}`;

  if (request.method === 'GET') {
    const r = await fetch(`${binUrl}/latest`, {
      headers: { 'X-Master-Key': env.JSONBIN_KEY, 'X-Bin-Meta': 'false' },
    });
    if (!r.ok) return json({ error: `jsonbin ${r.status}` }, 502);
    return json(await r.json());
  }

  if (request.method === 'PUT') {
    const text = await request.text();
    if (text.length > MAX_BYTES) return json({ error: 'too large' }, 413);
    let body;
    try { body = JSON.parse(text); } catch { return json({ error: 'invalid json' }, 400); }
    if (!body || !Array.isArray(body.habits)) return json({ error: 'habits array required' }, 400);

    const r = await fetch(binUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': env.JSONBIN_KEY },
      body: JSON.stringify(body),
    });
    if (!r.ok) return json({ error: `jsonbin ${r.status}` }, 502);
    return json({ ok: true });
  }

  return json({ error: 'method not allowed' }, 405);
}
