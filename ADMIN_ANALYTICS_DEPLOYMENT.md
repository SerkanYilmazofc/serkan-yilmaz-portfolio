# Admin Analytics — cPanel Deployment

Bu proje statik Vite/React SPA + cPanel uyumlu **PHP + MySQL** analytics API kullanır.

## Ne deploy edilir?

GitHub Actions `main` push sonrası `deploy` branch’ine şunları yazar:

- `dist/` çıktısı (SPA)
- `api/` klasörü (PHP API, `.env` hariç)
- Kök `.htaccess` (SPA fallback + `/api` istisnası)

Document root: genelde `kisisel.serkanylmz.com.tr` (veya apex) klasörü — `deploy` branch içeriği.

## HTTP 500 checklist (cPanel)

1. Tarayıcıda aç: `https://SENIN_DOMAIN/api/ping.php`
   - JSON gelmeli. `php_ok: false` ise **MultiPHP → 8.1 veya 8.2** seç.
   - `env_file: false` ise `api/.env` yok / yanlış yerde.
   - `pdo_mysql: false` ise hosting’e PDO MySQL açtır.
2. `https://SENIN_DOMAIN/api/health` → `ok: true` olmalı.
3. MySQL database + user oluştur, `api/schema.sql` import et.
4. `api/.env` doldur (`DB_*`, `APP_KEY`, `DEFAULT_ADMIN_*`, `ALLOWED_ORIGIN`).
5. Geçici teşhis: `.env` içinde `APP_DEBUG=true` → login/API hata mesajı JSON’da görünür; bitince `false`.
6. Hâlâ 500: cPanel → Errors / Metrics → Errors (son PHP fatal log).

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
