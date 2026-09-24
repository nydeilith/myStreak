# myStreak 🔥

Alışkanlık / seri (streak) takip uygulaması. Cloudflare Workers üzerinde çalışır, veriler Cloudflare KV'de saklanır.

## Özellikler
- **Doğru seri mantığı:** Seri, işaretlediğin günlerden hesaplanır. Bir gün kaçırırsan sıfırlanır; bugün henüz yapmadıysan dünkü serin korunur ("bugün yap!" uyarısı çıkar).
- **Haftanın günleri:** Her alışkanlık için hangi günler yapılacağını seç (ör. spor Pzt/Çar/Cum). Plan dışı günler seriyi bozmaz.
- **İzin günü:** Hastalık, tatil gibi günleri takvimden "izinli" işaretle; serin bozulmaz.
- **Aklımda:** Notların, nokta bulutundan oluşan ve parmakla 360° çevrilebilen 3D bir beynin etrafında durur (three.js, `public/vendor`). Aklına geleni tek satırla bırak, istersen saat ver. Zamanı gelince bildirim gelir; Android'de bildirimden "Yaptım" ya da "1 saat ertele" denebilir. Aklındaki şey arttıkça beyin görseli doygunlaşır.
- **Hedeflerim:** Uzun vadeli hedefler; elle (+/−) ya da bir alışkanlığa bağlı sayılır, bitiş tarihine göre "yolundasın / geridesin" hesabı.
- **Tanıtım:** İlk açılışta hazır alışkanlık şablonları, "kaç gündür yapıyorsun?", ilk hedef ve bildirim izni.
- **Bildirimler:** Günlük alışkanlık hatırlatması, Aklımda notları ve pazar 20:00 haftalık özet.
- **Son bir yıl:** GitHub tarzı aktivite grafiği (53 hafta, ay ve gün etiketleri), bu haftanın başarı oranı ve tamamlanan gün sayıları.
- **Rozetler:** 3, 7, 14, 30, 60, 100, 200 ve 365 günlük seriler için rozet; tüm alışkanlıklar bitince konfeti 🎉.
- **Diğer:** Takvimden geçmiş günleri düzeltme, emoji/renk seçimi, sıralama, açık/koyu tema, JSON yedek alma/yükleme, çevrimdışı çalışma, "Ana ekrana ekle" ile uygulama gibi kullanım.

## Dosyalar
```
public/          -> site (index.html, js/brain3d.js, vendor/three, service worker, ikonlar)
src/worker.js    -> Worker: /api/habits, /api/push ve zamanlanmış hatırlatmalar
lib/             -> ortak kod (depolama, web push şifreleme, hatırlatmalar)
wrangler.jsonc   -> Worker ayarları (KV, zamanlayıcı)
```

## Kurulum (Cloudflare Workers)
1. **KV oluştur:** Storage & Databases → KV → Create → adı `mystreak`. Listede görünen **ID**'yi
   `wrangler.jsonc` içindeki `"id"` alanına yaz.
2. **Worker'ı bağla:** Workers & Pages → Create → Import a repository → bu repo (Worker adı: `mystreak`).
   `main` dalına her push otomatik yayınlanır.
3. **Şifre:** Worker → Settings → en üstteki **Variables and Secrets** (Builds bölümündeki değil!) → `APP_PASSWORD` (Secret) ekle.
   Koymazsan linki bilen herkes verini değiştirebilir.

Hatırlatma zamanlayıcısı (`*/5 * * * *`) ayar dosyasında tanımlı; ayrıca bir şey kurmaya gerek yok.
Uygulamada ⚙️ **Ayarlar → Günlük hatırlatma**'yı aç ve "Test bildirimi gönder" ile dene.

> 📱 **iPhone:** Bildirimler iOS 16.4+ sürümünde ve uygulama Safari'den **Paylaş → Ana Ekrana Ekle** ile eklenip oradan açıldığında çalışır.

> ⚠️ Eski sürümde jsonbin anahtarı kodun içinde açıkça duruyordu. jsonbin.io → **API KEYS** → eski anahtarı sil.
> Eski verileri taşımak istersen `JSONBIN_BIN_ID` ve `JSONBIN_KEY` değişkenlerini ekle; KV boşsa ilk açılışta aktarılır.

## Yerelde deneme
```
npx wrangler dev
```
