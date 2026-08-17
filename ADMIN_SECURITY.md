# Admin Analytics — Security Notes

## Model

- Public site: anonymous first-party `analytics_vid` cookie (UUID). No fingerprinting.
- Analytics DB: **no raw IP storage**. Geo uses CF-IPCountry / optional GeoLite; IP only in-memory for lookup.
- Security tables may store **hashed** IP (`IP_HASH_PEPPER`) for brute-force / audit — not analytics identity.
- Admin auth: Argon2id (fallback bcrypt), HttpOnly + Secure + SameSite=Strict session cookie, idle + absolute expiry, CSRF on state-changing admin routes, login rate limits, optional TOTP + recovery codes.

## Hard rules

1. Never commit `api/.env` or real passwords.
2. After first admin: `ALLOW_SETUP=false`.
3. Admin API without session → `401`. CSRF mismatch → `403`.
4. Public analytics endpoints fail-soft (soft `ok` on DB errors) so the portfolio never blanks.
5. Do not log passwords, TOTP secrets, or full session IDs in application logs.
6. Prefer same-origin `/api` (no wide CORS). Set `ALLOWED_ORIGIN` explicitly in production.

## Threat notes

- Knowing `/admin/analytics` is not access — authorization is server-side.
- Session fixation mitigated by new session id on login; cookie not readable by JS.
- Brute-force: per-IP and per-username attempt windows.
- WAF: keep JSON bodies simple; do not disable security to bypass WAF.

## Privacy

- No GPS / browser geolocation permission.
- Paths stored without query strings.
- Bots filtered via UA heuristics (`is_bot`).
- Retention defaults: pageviews 90d, sessions 180d, auth attempts 30d, audit 180d (`.env` overrides).

## Checklist before go-live

- [ ] Schema imported
- [ ] Strong `APP_KEY` / peppers / `CLEANUP_TOKEN`
- [ ] Admin created; setup disabled
- [ ] HTTPS + Secure cookies
- [ ] `/api/.env` not downloadable
- [ ] Cron cleanup scheduled
- [ ] Unauthorized admin API returns 401
- [ ] Portfolio still loads if MySQL is down
