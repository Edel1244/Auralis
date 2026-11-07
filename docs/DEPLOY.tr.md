# AURALIS'i sunucuya kurma rehberi

Bu rehber AURALIS'i internette, kendi alan adınla (örneğin `https://auralis.alanadin.com`) yayına almayı adım adım anlatır. Sonunda:

- Site **HTTPS** ile çalışır; sertifika otomatik alınır ve yenilenir (Caddy + Let's Encrypt).
- Veritabanı ve müzik dosyaları sunucuda kalıcı olarak saklanır.
- Her gece otomatik **yedek** alınır (14 gün saklanır).
- Yönetici hesabı yalnızca **senin e-postana** verilir.

Toplam süre: yaklaşık 30–45 dakika (çoğu bekleme).

---

## 1. Sunucu (VPS) kirala

| Özellik | Öneri |
|---|---|
| İşletim sistemi | **Ubuntu 24.04 LTS** (22.04 de olur) |
| İşlemci / bellek | En az 2 vCPU, **4 GB RAM** önerilir (2 GB'ta da çalışır; betik takas alanı ekler) |
| Disk | En az 40 GB. Müzikler yer kaplar: FLAC/WAV parça başına 30–60 MB, MP3 5–10 MB |

Sağlayıcı seçenekleri:
- **Hetzner**, **DigitalOcean**, **Contabo**, **Vultr**: uygun fiyatlı, yaygın.
- Kullanıcı verilerinin Türkiye'de kalmasını istiyorsan (KVKK açısından) yerli bir VPS sağlayıcısı seç.

Sunucuyu oluştururken **SSH anahtarı** eklemeni öneririm. Panelde sunucunun **IP adresini** not et.

## 2. Alan adını sunucuya yönlendir

Alan adını aldığın yerin (veya Cloudflare'in) **DNS** ayarlarında bir kayıt ekle:

| Tür | Ad | Değer |
|---|---|---|
| `A` | `auralis` (alt alan adı için) veya `@` (ana alan adı için) | sunucunun IPv4 adresi |

Sunucunun IPv6 adresi varsa aynı adla bir `AAAA` kaydı da ekleyebilirsin. Kaydın yayılması birkaç dakika sürebilir.

> Cloudflare kullanıyorsan ilk kurulumda kaydın turuncu bulutunu **kapalı** (yalnızca DNS) tut. Sertifika alındıktan sonra açabilirsin.

## 3. Sunucuya bağlan

Windows'ta PowerShell'i aç ve şunu çalıştır (IP'yi kendi adresinle değiştir):

```bash
ssh root@SUNUCU_IP
```

## 4. Kodu sunucuya indir

Depo özel (private) olduğu için sunucunun ona erişmesi gerekir. En güvenli yol, yalnızca okuma izni olan bir **deploy key**:

```bash
ssh-keygen -t ed25519 -C "auralis-server" -f ~/.ssh/auralis_deploy -N ""
```

```bash
cat ~/.ssh/auralis_deploy.pub
```

Çıkan satırı kopyala ve GitHub'da ekle: **Auralis deposu → Settings → Deploy keys → Add deploy key**. "Allow write access" kutusunu **işaretleme**.

Sonra sunucunun bu anahtarı GitHub için kullanmasını sağla ve depoyu indir:

```bash
printf 'Host github.com\n  IdentityFile ~/.ssh/auralis_deploy\n  IdentitiesOnly yes\n' >> ~/.ssh/config
```

```bash
git clone git@github.com:Edel1244/Auralis.git /opt/auralis
```

```bash
cd /opt/auralis
```

## 5. Kurulum betiğini çalıştır

```bash
sudo bash deploy/setup-server.sh
```

Betik iki şey sorar:
1. **Alan adı:** örneğin `auralis.alanadin.com`
2. **E-posta adresin:** yönetici hesabın bu adrese bağlanır; sertifika bildirimleri de buraya gelir.

Ardından otomatik olarak şunları yapar:
- Docker'ı ve güvenlik duvarını kurar (yalnızca SSH, HTTP ve HTTPS açık),
- Bellek azsa 2 GB takas alanı ekler,
- Rastgele, güçlü şifrelerle `.env` dosyasını oluşturur (dosyayı yalnızca root okuyabilir),
- Uygulamayı derleyip başlatır (ilk derleme birkaç dakika sürer),
- Günlük yedeği zamanlar.

DNS kaydı henüz bu sunucuyu göstermiyorsa betik seni uyarır.

## 6. Yönetici hesabını oluştur

1. Tarayıcıda `https://alan-adın` adresini aç ve **kurulumda verdiğin e-posta ile** kayıt ol.
2. E-postanı doğrula. Henüz e-posta servisi (SMTP) ayarlamadıysan doğrulama bağlantısını sunucudan al:

```bash
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml logs app | grep verify-email
```

Çıktıdaki `https://…/verify-email?token=…` bağlantısını tarayıcıda aç. **Doğrulama tamamlanınca hesabın yönetici olur.** Kenar çubuğunda "Yönetim" ve "Moderasyon" bölümleri görünür.

> Güvenlik: Senden önce biri kayıt olsa bile yönetici olamaz. Yöneticilik yalnızca `.env` içindeki `BOOTSTRAP_ADMIN_EMAIL` adresine, o adres doğrulandıktan sonra verilir.

## 7. E-posta gönderimini ayarla (önerilir)

Kullanıcıların doğrulama ve şifre sıfırlama e-postası alabilmesi için bir SMTP servisi gerekir. Brevo, Mailgun, Resend, Amazon SES gibi servislerin ücretsiz katmanları başlangıç için yeterlidir. Servisin verdiği bilgilerle `.env` dosyasını düzenle:

```bash
sudo nano /opt/auralis/.env
```

Şu satırları doldur:

```
SMTP_URL=smtp://KULLANICI:SIFRE@smtp.servis.com:587
MAIL_FROM="AURALIS <no-reply@alanadin.com>"
```

Kaydet (`Ctrl+O`, `Enter`, `Ctrl+X`) ve uygulamayı yeniden başlat:

```bash
sudo bash deploy/update.sh
```

> E-postaların spam'e düşmemesi için servisin söylediği **SPF/DKIM** DNS kayıtlarını alan adına eklemeyi unutma.

## 8. Yedekler

Her gece 03:30'da `/opt/auralis/backups/` klasörüne veritabanı dökümü ve tüm müzik dosyalarının arşivi alınır; 14 günden eski yedekler silinir. Elle yedek almak için:

```bash
cd /opt/auralis && ./scripts/backup.sh
```

**Yedekleri sunucu dışına da kopyala.** Sunucu bozulursa yedekler de gider. Kendi bilgisayarından şöyle indirebilirsin:

```bash
scp -r root@SUNUCU_IP:/opt/auralis/backups ./auralis-yedekler
```

Geri yükleme adımları `scripts/backup.sh` dosyasının başında yazıyor.

## 9. Güncelleme

GitHub'a yeni kod gönderdikten sonra sunucuda:

```bash
cd /opt/auralis && sudo bash deploy/update.sh
```

Bu komut önce yedek alır, en son kodu indirir, yeniden derler ve başlatır. Veritabanı değişiklikleri (migration) otomatik uygulanır.

## Sık kullanılan komutlar

Tümü `/opt/auralis` klasöründe çalıştırılır.

| Ne için | Komut |
|---|---|
| Durum | `docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml ps` |
| Uygulama logları | `docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml logs -f app` |
| Sertifika / proxy logları | `docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml logs caddy` |
| Sağlık kontrolü | `curl https://alan-adın/api/v1/health` |
| Kullanıcıya rol vermek | `docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml exec app node scripts/set-role.mjs KULLANICI_ADI MODERATOR` |
| Disk kullanımı | `df -h` ve `docker system df` |

## Sorun giderme

- **Site açılmıyor, sertifika hatası:** DNS kaydının sunucu IP'sini gösterdiğini kontrol et (`ping alan-adın`) ve Caddy loglarına bak. 80 ve 443 numaralı portlar açık olmalı; bazı sağlayıcıların panelinde ayrıca bir güvenlik duvarı bulunur.
- **İlk derleme sırasında "killed" veya bellek hatası:** sunucunun belleği yetmiyor. Daha büyük bir plana geç ya da takas alanının açık olduğunu kontrol et (`swapon --show`).
- **Yükleme "storage quota" hatası veriyor:** kullanıcı kotası doldu. Yönetim panelinden kullanıcının kotasını artırabilirsin.
- **Disk doluyor:** müzikler `media` Docker biriminde duruyor. Daha büyük disk ekleyebilir ya da S3 uyumlu depolamaya geçebilirsin (`STORAGE_DRIVER=s3`, ayrıntılar README'de).

## Yasal sorumluluklar (kısa not)

Sunucuyu işleten kişi olarak:
- Kullanıcıların kişisel verilerini (e-posta, dinleme geçmişi) işlediğin için KVKK'ya uymalısın. Bir gizlilik politikası ve kullanım koşulları sayfası yayımlamanı öneririm.
- Telif hakkı şikâyetleri **Moderasyon → Telif talepleri** ekranına düşer; bunları düzenli olarak kontrol et.
