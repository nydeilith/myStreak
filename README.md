# myStreak 🔥

Alışkanlık / seri (streak) takip uygulaması. Cloudflare Pages üzerinde çalışır, veriler Cloudflare KV'de saklanır.

## Özellikler
- **Doğru seri mantığı:** Seri, işaretlediğin günlerden hesaplanır. Bir gün kaçırırsan sıfırlanır; bugün henüz yapmadıysan dünkü serin korunur ("bugün yap!" uyarısı çıkar).
- **Haftanın günleri:** Her alışkanlık için hangi günler yapılacağını seç (ör. spor Pzt/Çar/Cum). Plan dışı günler seriyi bozmaz.
- **İzin günü:** Hastalık, tatil gibi günleri takvimden "izinli" işaretle; serin bozulmaz.
- **Günlük hatırlatma bildirimi:** Belirlediğin saatte, bitmemiş alışkanlıkların varsa telefona bildirim gelir.
- **Genel görünüm:** Son 18 haftanın ısı haritası, bu haftanın başarı oranı ve tamamlanan gün sayıları.
- **Rozetler:** 3, 7, 14, 30, 60, 100, 200 ve 365 günlük seriler için rozet; tüm alışkanlıklar bitince konfeti 🎉.
- **Diğer:** Takvimden geçmiş günleri düzeltme, emoji/renk seçimi, sıralama, açık/koyu tema, JSON yedek alma/yükleme, çevrimdışı çalışma, "Ana ekrana ekle" ile uygulama gibi kullanım.

## Dosyalar
```
public/          -> site (index.html, service worker, ikonlar)
functions/api/   -> sunucu tarafı: /api/habits, /api/push, /api/cron
lib/             -> ortak kod (depolama, web push şifreleme)
cron-worker.js   -> hatırlatmaları tetikleyen küçük zamanlayıcı Worker
```

## Kurulum (Cloudflare)

### 1) KV (veritabanı) oluştur
Cloudflare paneli → **Storage & Databases → KV → Create** → adı `mystreak` olsun.

### 2) Pages projesini oluştur
**Workers & Pages → Create → Pages → Connect to Git** → bu repoyu seç.
- Production branch: `main`
- Build command: *(boş)*
- Build output directory: `public`

### 3) Ayarlar (Pages projesi → Settings)
**Bindings → Add → KV namespace**: Variable name `DB`, namespace `mystreak`.

**Variables and Secrets** (hepsini *Secret* olarak ekle):
| İsim | Değer |
|---|---|
| `APP_PASSWORD` | Uygulamaya giriş şifren (koymazsan linki bilen herkes verini değiştirebilir) |
| `CRON_SECRET` | Rastgele uzun bir metin (ör. `k3Jd9...`), hatırlatma adresini korur |
| `JSONBIN_BIN_ID` | *(sadece taşıma için)* `69751843d0ea881f4082844a` |
| `JSONBIN_KEY` | *(sadece taşıma için)* jsonbin'den aldığın **yeni** Master Key |

Sonra **Deployments → Retry deployment** ile yeniden yayınla.

İlk açılışta eski verilerin jsonbin'den KV'ye otomatik aktarılır. Sonrasında jsonbin'e hiç istek gitmez;
iki `JSONBIN_` değişkenini silebilirsin.

> ⚠️ **Güvenlik:** Eski sürümde jsonbin anahtarı kodun içinde açıkça duruyordu ve git geçmişinde hâlâ görünüyor.
> jsonbin.io → sol menü **API KEYS** → yeni bir Master Key oluştur → eskisini sil.

### 4) Hatırlatma zamanlayıcısı (bildirimler için)
Pages kendi başına zamanlanmış görev çalıştıramaz, bu yüzden küçük bir Worker onu 15 dakikada bir dürter:
1. **Workers & Pages → Create → Worker** → adı `mystreak-cron` → Deploy → **Edit code**, içine `cron-worker.js` dosyasının içeriğini yapıştır → Deploy.
2. Worker → **Settings → Variables**: `CRON_URL` = `https://SENIN-SITEN.pages.dev/api/cron?key=CRON_SECRET_DEĞERİN`
3. Worker → **Settings → Triggers → Cron Triggers → Add**: `*/15 * * * *`

Son olarak uygulamada ⚙️ **Ayarlar → Günlük hatırlatma**'yı aç, saati seç ve "Test bildirimi gönder" ile dene.

> 📱 **iPhone:** Bildirimler sadece iOS 16.4+ sürümünde ve uygulama Safari'den **Paylaş → Ana Ekrana Ekle** ile eklenip oradan açıldığında çalışır.

### 5) Alan adı (isteğe bağlı)
Pages projesi → **Custom domains** → Cloudflare'den aldığın alan adını bağla. Alan adını değiştirirsen `CRON_URL`'i de güncelle.

## Yerelde deneme
```
npx wrangler pages dev public --kv DB
```
