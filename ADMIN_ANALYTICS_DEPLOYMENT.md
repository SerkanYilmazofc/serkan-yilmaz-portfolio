# Admin Analytics — cPanel Deployment

Bu proje statik Vite/React SPA + cPanel uyumlu **PHP + MySQL** analytics API kullanır.

## Ne deploy edilir?

GitHub Actions `main` push sonrası `deploy` branch’ine şunları yazar:

- `dist/` çıktısı (SPA)
- `api/` klasörü (PHP API, `.env` hariç)
- Kök `.htaccess` (SPA fallback + `/api` istisnası)

Document root: genelde `kisisel.serkanylmz.com.tr` (veya apex) klasörü — `deploy` branch içeriği.

## 1) MySQL

1. cPanel → MySQL Databases: database + user oluştur, tüm yetkileri ver.
2. phpMyAdmin veya CLI ile `api/schema.sql` içeriğini çalıştır.

## 2) `.env`

Sunucuda `api/.env` oluştur (`api/.env.example` şablonu):

- `APP_KEY`, `IP_HASH_PEPPER`, `CLEANUP_TOKEN` → uzun rastgele stringler
- `DB_*` → cPanel MySQL bilgileri
- `ALLOWED_ORIGIN` → sitenin tam origin’i (`https://kisisel.serkanylmz.com.tr`)
- `TRUSTED_PROXY=true` (Cloudflare / reverse proxy varsa)
- `ALLOW_SETUP=false` (kurulum bitince mutlaka false)
- `FORCE_SECURE_COOKIES=true` (HTTPS)

`.env` URL ile indirilememeli (`api/.htaccess` + kök `.htaccess` korur).

## 3) İlk admin

Geçici varsayılan (`.env` / `.env.example`):

- Kullanıcı: `admin`
- Şifre: `Admin123!temp`

DB boşken API ilk `auth/status` veya `auth/login` çağrısında bu hesabı otomatik oluşturur. Canlıya aldktan sonra şifreyi değiştir ve `DEFAULT_ADMIN_*` satırlarını `.env`’den sil.

**CLI (önerilen, alternatif):**

```bash
cd ~/kisisel.serkanylmz.com.tr/api
php scripts/create_admin.php yourname 'VeryStrongPassword12'
```

**HTTP setup (geçici):**

1. `.env` içinde `ALLOW_SETUP=true`
2. `https://.../admin/login` → kurulum formu
3. Hemen `ALLOW_SETUP=false`

## 4) Deploy notları

- cPanel Git “remote contact” hatası alıyorsan: Actions’tan `deploy` zip indir → File Manager ile document root’a çıkar.
- Mevcut site dosyalarının üzerine yaz; eski `hakkimda.html` vb. kalmamalı.
- `api/.env` zip ile gelmez — her sunucuda elle oluştur / koru.

## 5) Doğrulama

- `GET /api/health` → `ok: true`
- Ana sayfa açılınca Network’te `POST /api/analytics/visit` (hata olsa bile site bozulmaz)
- `/admin/login` → giriş → `/admin/analytics` metrikler
- Çıkış sonrası admin API `401`

## 6) Retention / cron

cPanel Cron (ör. günde 1):

```bash
curl -sS -X POST -H "X-Cleanup-Token: YOUR_CLEANUP_TOKEN" https://YOUR_DOMAIN/api/cron/cleanup
```

veya:

```bash
php ~/.../api/scripts/cleanup.php
```

## 7) Lokal geliştirme

```bash
npm run dev
# ayrı terminal — gerçek ziyaret verisini api/.data/store.json içinde tutar:
npm run dev:api
```

Vite `/api` isteklerini bu local API’ye proxy eder. Panelde stub yok; ana siteyi gezdikçe metrikler artar.

Canlı cPanel’de PHP + MySQL kullanılır (`api/index.php`), `dev-server.mjs` production’da çalışmaz.

## 2FA (opsiyonel)

Giriş sonrası (CSRF’li) API:

- `POST /api/auth/2fa/setup` → secret + recovery codes
- `POST /api/auth/2fa/confirm` `{ "code": "123456" }`

Panel UI’da ileride buton eklenebilir; endpoint’ler hazır.
