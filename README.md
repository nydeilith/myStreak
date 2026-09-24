# myStreak 🔥

Alışkanlık / seri (streak) takip uygulaması. Tek bir `index.html` dosyası ve verileri
buluta kaydeden küçük bir Cloudflare Pages Function'dan oluşur.

## Özellikler
- Seri, işaretlediğin günlerden otomatik hesaplanır: bir gün atlarsan seri sıfırlanır,
  bugün henüz yapmadıysan dünkü serin korunur ("bugün yap!" uyarısı çıkar).
- Son 7 gün şeridi ve aylık takvim: unuttuğun günü işaretleyebilir, yanlışlıkla işaretlediğini geri alabilirsin.
- Mevcut seri, en iyi seri, toplam gün, son 30 günde tamamlama oranı.
- Emoji ve renk seçimi, sıralama, açık/koyu tema, JSON yedek alma/yükleme.
- Telefonda "Ana ekrana ekle" ile uygulama gibi açılır. İnternet yokken değişiklikler saklanır, bağlantı gelince gönderilir.

## Cloudflare Pages'e kurulum
1. Cloudflare panelinde **Workers & Pages → Create → Pages → Connect to Git** ile bu repoyu seç.
   Build komutu boş kalsın, çıktı klasörü `/` olsun.
2. **Settings → Variables and Secrets** kısmına şunları ekle (Production):
   - `JSONBIN_BIN_ID` = jsonbin kutu ID'n
   - `JSONBIN_KEY` = jsonbin X-Master-Key (**Secret** olarak ekle)
   - `APP_PASSWORD` = uygulamaya giriş şifresi (önerilir; yoksa linki bilen herkes verini değiştirebilir)
3. Yeniden deploy et. İstersen **Custom domains** kısmından Cloudflare'den aldığın alan adını bağla.

> ⚠️ Eski sürümde jsonbin anahtarı kodun içinde açıkça duruyordu ve git geçmişinde hâlâ görünüyor.
> jsonbin panelinden **yeni bir Master Key oluştur, eskisini sil** ve yenisini `JSONBIN_KEY` olarak gir.

Bulut ayarlanmamışsa (ör. dosyayı direkt açarsan) uygulama verileri sadece o tarayıcıda saklar.
