// Cloudflare'de ayrı, küçük bir Worker olarak oluştur ve Cron Trigger ekle (*/15 * * * *).
// Settings -> Variables kısmına CRON_URL ekle: https://SENIN-SITEN/api/cron?key=CRON_SECRET
export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(fetch(env.CRON_URL));
  },
};
