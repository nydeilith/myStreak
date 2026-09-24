// Tüm /api isteklerinde şifre kontrolü (/api/cron kendi anahtarını kullanır) ve hata yakalama.
import { json, sameSecret } from '../../lib/http.js';

export async function onRequest({ request, env, next }) {
  const { pathname } = new URL(request.url);
  if (pathname !== '/api/cron' && env.APP_PASSWORD
      && !sameSecret(request.headers.get('X-App-Password') || '', env.APP_PASSWORD)) {
    return json({ error: 'unauthorized' }, 401);
  }
  try {
    return await next();
  } catch (e) {
    console.error(e);
    return json({ error: e.message }, e.status || 500);
  }
}
