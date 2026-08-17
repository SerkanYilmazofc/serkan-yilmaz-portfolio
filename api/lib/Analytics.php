<?php
declare(strict_types=1);

final class Analytics
{
    public static function classifySource(?string $referrer, array $utm): string
    {
        if (!empty($utm['utm_source']) || !empty($utm['utm_campaign'])) {
            return 'UTM Campaign';
        }
        if ($referrer === null || $referrer === '') {
            return 'Direct';
        }
        $host = strtolower((string) (parse_url($referrer, PHP_URL_HOST) ?? ''));
        $host = preg_replace('/^www\./', '', $host) ?? $host;
        $map = [
            'google.' => 'Google',
            'bing.com' => 'Bing',
            'youtube.com' => 'YouTube',
            'youtu.be' => 'YouTube',
            'instagram.com' => 'Instagram',
            'facebook.com' => 'Facebook',
            'fb.com' => 'Facebook',
            'linkedin.com' => 'LinkedIn',
            'twitter.com' => 'X / Twitter',
            'x.com' => 'X / Twitter',
            'github.com' => 'GitHub',
            't.co' => 'X / Twitter',
        ];
        foreach ($map as $needle => $label) {
            if (str_contains($host, $needle) || str_ends_with($host, rtrim($needle, '.'))) {
                return $label;
            }
        }
        if ($host === '') {
            return 'Direct';
        }
        return 'Referral';
    }

    public static function referrerDomain(?string $referrer): ?string
    {
        if ($referrer === null || $referrer === '') {
            return null;
        }
        $host = parse_url($referrer, PHP_URL_HOST);
        if (!is_string($host) || $host === '') {
            return null;
        }
        return preg_replace('/^www\./', '', strtolower($host));
    }

    public static function sanitizePath(string $path): string
    {
        $path = trim($path);
        if ($path === '') {
            return '/';
        }
        if (!str_starts_with($path, '/')) {
            $path = '/' . $path;
        }
        $path = preg_replace('/[^\x20-\x7E]/', '', $path) ?? '/';
        if (strlen($path) > 255) {
            $path = substr($path, 0, 255);
        }
        // strip query/hash for privacy
        $q = strpos($path, '?');
        if ($q !== false) {
            $path = substr($path, 0, $q);
        }
        $h = strpos($path, '#');
        if ($h !== false) {
            $path = substr($path, 0, $h);
        }
        return $path === '' ? '/' : $path;
    }

    public static function visit(array $body): array
    {
        $pdo = Db::pdo();
        $visitorId = self::validUuid($body['visitor_id'] ?? null);
        $sessionId = self::validUuid($body['session_id'] ?? null);
        if (!$visitorId || !$sessionId) {
            Response::error('Invalid visitor or session id', 400);
        }
        if (RateLimit::analyticsLimited($visitorId, Security::clientIp())) {
            Response::ok(['throttled' => true]);
        }

        $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
        $parsed = UaParser::parse($ua);
        $path = self::sanitizePath((string) ($body['path'] ?? '/'));
        $title = self::clamp((string) ($body['title'] ?? ''), 255);
        $referrer = self::clamp((string) ($body['referrer'] ?? ''), 512);
        $utm = [
            'utm_source' => self::clamp((string) ($body['utm_source'] ?? ''), 120),
            'utm_medium' => self::clamp((string) ($body['utm_medium'] ?? ''), 120),
            'utm_campaign' => self::clamp((string) ($body['utm_campaign'] ?? ''), 160),
            'utm_content' => self::clamp((string) ($body['utm_content'] ?? ''), 160),
            'utm_term' => self::clamp((string) ($body['utm_term'] ?? ''), 160),
        ];
        $source = self::classifySource($referrer !== '' ? $referrer : null, $utm);
        $refDomain = self::referrerDomain($referrer !== '' ? $referrer : null);
        $geo = Geo::lookup(Security::clientIp());
        $now = gmdate('Y-m-d H:i:s');

        $stmt = $pdo->prepare('SELECT id, first_seen FROM analytics_visitors WHERE visitor_id = ?');
        $stmt->execute([$visitorId]);
        $existing = $stmt->fetch();
        $isNew = !$existing;
        if ($isNew) {
            $pdo->prepare(
                'INSERT INTO analytics_visitors
                (visitor_id, first_seen, last_seen, first_country, first_city, is_bot, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)'
            )->execute([
                $visitorId, $now, $now, $geo['country'], $geo['city'], $parsed['is_bot'] ? 1 : 0, $now,
            ]);
        } else {
            $pdo->prepare('UPDATE analytics_visitors SET last_seen = ?, is_bot = ? WHERE visitor_id = ?')
                ->execute([$now, $parsed['is_bot'] ? 1 : 0, $visitorId]);
        }

        $sess = $pdo->prepare('SELECT id FROM analytics_sessions WHERE session_id = ?');
        $sess->execute([$sessionId]);
        if (!$sess->fetch()) {
            $pdo->prepare(
                'INSERT INTO analytics_sessions
                (visitor_id, session_id, started_at, last_seen, landing_page, referrer_domain, source,
                 utm_source, utm_medium, utm_campaign, utm_content, utm_term,
                 country, region, city, device_type, browser, os,
                 screen_width, screen_height, viewport_width, viewport_height, is_bot)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
            )->execute([
                $visitorId, $sessionId, $now, $now, $path, $refDomain, $source,
                $utm['utm_source'] ?: null, $utm['utm_medium'] ?: null, $utm['utm_campaign'] ?: null,
                $utm['utm_content'] ?: null, $utm['utm_term'] ?: null,
                $geo['country'], $geo['region'], $geo['city'],
                $parsed['device_type'], $parsed['browser'], $parsed['os'],
                self::dim($body['screen_width'] ?? null),
                self::dim($body['screen_height'] ?? null),
                self::dim($body['viewport_width'] ?? null),
                self::dim($body['viewport_height'] ?? null),
                $parsed['is_bot'] ? 1 : 0,
            ]);
        } else {
            $pdo->prepare('UPDATE analytics_sessions SET last_seen = ? WHERE session_id = ?')
                ->execute([$now, $sessionId]);
        }

        $pdo->prepare(
            'INSERT INTO analytics_pageviews (session_id, visitor_id, path, title, viewed_at) VALUES (?,?,?,?,?)'
        )->execute([$sessionId, $visitorId, $path, $title ?: null, $now]);

        return [
            'is_new_visitor' => $isNew,
            'is_bot' => $parsed['is_bot'],
        ];
    }

    public static function pageview(array $body): void
    {
        $pdo = Db::pdo();
        $visitorId = self::validUuid($body['visitor_id'] ?? null);
        $sessionId = self::validUuid($body['session_id'] ?? null);
        if (!$visitorId || !$sessionId) {
            Response::error('Invalid ids', 400);
        }
        if (RateLimit::analyticsLimited($visitorId, Security::clientIp())) {
            Response::ok(['throttled' => true]);
        }
        $path = self::sanitizePath((string) ($body['path'] ?? '/'));
        $title = self::clamp((string) ($body['title'] ?? ''), 255);
        $now = gmdate('Y-m-d H:i:s');
        $pdo->prepare(
            'UPDATE analytics_sessions SET last_seen = ?, exit_page = ? WHERE session_id = ?'
        )->execute([$now, $path, $sessionId]);
        $pdo->prepare('UPDATE analytics_visitors SET last_seen = ? WHERE visitor_id = ?')
            ->execute([$now, $visitorId]);
        $pdo->prepare(
            'INSERT INTO analytics_pageviews (session_id, visitor_id, path, title, viewed_at) VALUES (?,?,?,?,?)'
        )->execute([$sessionId, $visitorId, $path, $title ?: null, $now]);
    }

    public static function heartbeat(array $body): void
    {
        $pdo = Db::pdo();
        $visitorId = self::validUuid($body['visitor_id'] ?? null);
        $sessionId = self::validUuid($body['session_id'] ?? null);
        if (!$visitorId || !$sessionId) {
            Response::error('Invalid ids', 400);
        }
        $path = isset($body['path']) ? self::sanitizePath((string) $body['path']) : null;
        $now = gmdate('Y-m-d H:i:s');
        if ($path) {
            $pdo->prepare(
                'UPDATE analytics_sessions SET last_seen = ?, exit_page = ? WHERE session_id = ?'
            )->execute([$now, $path, $sessionId]);
        } else {
            $pdo->prepare('UPDATE analytics_sessions SET last_seen = ? WHERE session_id = ?')
                ->execute([$now, $sessionId]);
        }
        $pdo->prepare('UPDATE analytics_visitors SET last_seen = ? WHERE visitor_id = ?')
            ->execute([$now, $visitorId]);
    }

    public static function summary(): array
    {
        $pdo = Db::pdo();
        $onlineSec = Config::int('ONLINE_WINDOW_SEC', 60);
        $sinceOnline = gmdate('Y-m-d H:i:s', time() - $onlineSec);
        $today = gmdate('Y-m-d 00:00:00');
        $week = gmdate('Y-m-d 00:00:00', strtotime('-6 days'));
        $month = gmdate('Y-m-01 00:00:00');

        $q = $pdo->prepare(
            'SELECT COUNT(DISTINCT visitor_id) FROM analytics_sessions WHERE last_seen >= ? AND is_bot = 0'
        );
        $q->execute([$sinceOnline]);
        $online = (int) $q->fetchColumn();

        $uniq = static function (string $since) use ($pdo): int {
            $s = $pdo->prepare(
                'SELECT COUNT(DISTINCT visitor_id) FROM analytics_sessions WHERE started_at >= ? AND is_bot = 0'
            );
            $s->execute([$since]);
            return (int) $s->fetchColumn();
        };

        $pv = (int) $pdo->query(
            'SELECT COUNT(*) FROM analytics_pageviews pv
             JOIN analytics_sessions s ON s.session_id = pv.session_id
             WHERE s.is_bot = 0'
        )->fetchColumn();

        $totalVisitors = (int) $pdo->query(
            'SELECT COUNT(*) FROM analytics_visitors WHERE is_bot = 0'
        )->fetchColumn();

        $as = $pdo->prepare(
            'SELECT COUNT(*) FROM analytics_sessions WHERE last_seen >= ? AND is_bot = 0'
        );
        $as->execute([$sinceOnline]);
        $activeSessions = (int) $as->fetchColumn();

        return [
            'online' => $online,
            'today' => $uniq($today),
            'week' => $uniq($week),
            'week_note' => 'Rolling last 7 days (including today)',
            'month' => $uniq($month),
            'total_visitors' => $totalVisitors,
            'pageviews' => $pv,
            'active_sessions' => $activeSessions,
            'online_window_sec' => $onlineSec,
            'server_time' => gmdate('c'),
        ];
    }

    public static function live(): array
    {
        $pdo = Db::pdo();
        $onlineSec = Config::int('ONLINE_WINDOW_SEC', 60);
        $since = gmdate('Y-m-d H:i:s', time() - $onlineSec);
        $stmt = $pdo->prepare(
            'SELECT s.session_id, s.visitor_id, s.country, s.city, s.region, s.browser, s.os,
                    s.device_type, s.source, s.started_at, s.last_seen,
                    COALESCE(s.exit_page, s.landing_page) AS path,
                    CASE WHEN v.first_seen >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY)
                         AND v.first_seen = (
                           SELECT MIN(v2.first_seen) FROM analytics_visitors v2 WHERE v2.visitor_id = s.visitor_id
                         ) THEN 1 ELSE 0 END AS is_newish
             FROM analytics_sessions s
             JOIN analytics_visitors v ON v.visitor_id = s.visitor_id
             WHERE s.last_seen >= ? AND s.is_bot = 0
             ORDER BY s.last_seen DESC
             LIMIT 100'
        );
        $stmt->execute([$since]);
        $rows = $stmt->fetchAll();
        $clusters = [];
        $list = [];
        foreach ($rows as $r) {
            [$lat, $lon] = Geo::approxCoords($r['country'] ?? null, $r['city'] ?? null);
            $duration = max(0, strtotime($r['last_seen'] . ' UTC') - strtotime($r['started_at'] . ' UTC'));
            $item = [
                'session_id' => $r['session_id'],
                'country' => $r['country'] ?: 'Unknown',
                'city' => $r['city'],
                'region' => $r['region'],
                'browser' => $r['browser'],
                'os' => $r['os'],
                'device' => $r['device_type'],
                'source' => $r['source'],
                'path' => $r['path'],
                'duration_sec' => $duration,
                'lat' => $lat,
                'lon' => $lon,
                'returning' => self::isReturning($pdo, (string) $r['visitor_id']),
            ];
            $list[] = $item;
            $ck = ($r['country'] ?: 'Unknown') . '|' . ($r['city'] ?: 'Unknown');
            if (!isset($clusters[$ck])) {
                $clusters[$ck] = [
                    'country' => $r['country'] ?: 'Unknown',
                    'city' => $r['city'],
                    'count' => 0,
                    'lat' => $lat,
                    'lon' => $lon,
                ];
            }
            $clusters[$ck]['count']++;
        }
        return [
            'visitors' => $list,
            'map_clusters' => array_values($clusters),
            'online_window_sec' => $onlineSec,
        ];
    }

    private static function isReturning(PDO $pdo, string $visitorId): bool
    {
        $s = $pdo->prepare('SELECT COUNT(*) FROM analytics_sessions WHERE visitor_id = ?');
        $s->execute([$visitorId]);
        return (int) $s->fetchColumn() > 1;
    }

    public static function traffic(): array
    {
        $pdo = Db::pdo();
        $since = gmdate('Y-m-d 00:00:00', strtotime('-29 days'));
        $sources = $pdo->prepare(
            'SELECT source, COUNT(*) AS sessions, COUNT(DISTINCT visitor_id) AS visitors
             FROM analytics_sessions WHERE started_at >= ? AND is_bot = 0
             GROUP BY source ORDER BY sessions DESC'
        );
        $sources->execute([$since]);
        $refs = $pdo->prepare(
            'SELECT referrer_domain AS domain, COUNT(*) AS sessions
             FROM analytics_sessions
             WHERE started_at >= ? AND is_bot = 0 AND referrer_domain IS NOT NULL
             GROUP BY referrer_domain ORDER BY sessions DESC LIMIT 20'
        );
        $refs->execute([$since]);
        $utm = $pdo->prepare(
            'SELECT utm_source, utm_medium, utm_campaign, COUNT(*) AS sessions
             FROM analytics_sessions
             WHERE started_at >= ? AND is_bot = 0 AND (utm_source IS NOT NULL OR utm_campaign IS NOT NULL)
             GROUP BY utm_source, utm_medium, utm_campaign ORDER BY sessions DESC LIMIT 20'
        );
        $utm->execute([$since]);
        return [
            'range' => 'Last 30 days',
            'sources' => $sources->fetchAll(),
            'referrers' => $refs->fetchAll(),
            'utm' => $utm->fetchAll(),
        ];
    }

    public static function pages(): array
    {
        $pdo = Db::pdo();
        $since = gmdate('Y-m-d 00:00:00', strtotime('-29 days'));
        $stmt = $pdo->prepare(
            'SELECT pv.path, COUNT(*) AS views, COUNT(DISTINCT pv.visitor_id) AS unique_visitors
             FROM analytics_pageviews pv
             JOIN analytics_sessions s ON s.session_id = pv.session_id
             WHERE pv.viewed_at >= ? AND s.is_bot = 0
             GROUP BY pv.path ORDER BY views DESC LIMIT 50'
        );
        $stmt->execute([$since]);
        return ['range' => 'Last 30 days', 'pages' => $stmt->fetchAll()];
    }

    public static function devices(): array
    {
        $pdo = Db::pdo();
        $since = gmdate('Y-m-d 00:00:00', strtotime('-29 days'));
        $group = static function (string $col) use ($pdo, $since): array {
            $s = $pdo->prepare(
                "SELECT {$col} AS name, COUNT(*) AS sessions
                 FROM analytics_sessions WHERE started_at >= ? AND is_bot = 0
                 GROUP BY {$col} ORDER BY sessions DESC"
            );
            $s->execute([$since]);
            return $s->fetchAll();
        };
        return [
            'range' => 'Last 30 days',
            'devices' => $group('device_type'),
            'browsers' => $group('browser'),
            'os' => $group('os'),
        ];
    }

    public static function timeline(): array
    {
        $pdo = Db::pdo();
        $since = gmdate('Y-m-d 00:00:00', strtotime('-13 days'));
        $stmt = $pdo->prepare(
            'SELECT DATE(started_at) AS day,
                    COUNT(DISTINCT visitor_id) AS visitors,
                    COUNT(*) AS sessions
             FROM analytics_sessions
             WHERE started_at >= ? AND is_bot = 0
             GROUP BY DATE(started_at) ORDER BY day ASC'
        );
        $stmt->execute([$since]);
        $pv = $pdo->prepare(
            'SELECT DATE(pv.viewed_at) AS day, COUNT(*) AS pageviews
             FROM analytics_pageviews pv
             JOIN analytics_sessions s ON s.session_id = pv.session_id
             WHERE pv.viewed_at >= ? AND s.is_bot = 0
             GROUP BY DATE(pv.viewed_at) ORDER BY day ASC'
        );
        $pv->execute([$since]);
        return [
            'range' => 'Last 14 days',
            'visitors' => $stmt->fetchAll(),
            'pageviews' => $pv->fetchAll(),
        ];
    }

    public static function auditRecent(): array
    {
        $pdo = Db::pdo();
        $rows = $pdo->query(
            'SELECT id, admin_id, action, created_at, security_ip_hash, metadata_json
             FROM admin_audit_logs ORDER BY id DESC LIMIT 50'
        )->fetchAll();
        return ['logs' => $rows];
    }

    public static function cleanup(): array
    {
        $pdo = Db::pdo();
        $pvDays = Config::int('RETENTION_PAGEVIEWS_DAYS', 90);
        $sessDays = Config::int('RETENTION_SESSIONS_DAYS', 180);
        $authDays = Config::int('RETENTION_AUTH_DAYS', 30);
        $auditDays = Config::int('RETENTION_AUDIT_DAYS', 180);
        $now = time();
        $deleted = [];

        $cut = gmdate('Y-m-d H:i:s', $now - $pvDays * 86400);
        $stmt = $pdo->prepare('DELETE FROM analytics_pageviews WHERE viewed_at < ?');
        $stmt->execute([$cut]);
        $deleted['pageviews'] = $stmt->rowCount();

        $cut = gmdate('Y-m-d H:i:s', $now - $sessDays * 86400);
        $stmt = $pdo->prepare('DELETE FROM analytics_sessions WHERE started_at < ?');
        $stmt->execute([$cut]);
        $deleted['sessions'] = $stmt->rowCount();

        $cut = gmdate('Y-m-d H:i:s', $now - $authDays * 86400);
        $stmt = $pdo->prepare('DELETE FROM auth_attempts WHERE attempted_at < ?');
        $stmt->execute([$cut]);
        $deleted['auth_attempts'] = $stmt->rowCount();

        $cut = gmdate('Y-m-d H:i:s', $now - $auditDays * 86400);
        $stmt = $pdo->prepare('DELETE FROM admin_audit_logs WHERE created_at < ?');
        $stmt->execute([$cut]);
        $deleted['audit_logs'] = $stmt->rowCount();

        // prune idle admin sessions
        $deleted['admin_sessions'] = $pdo->exec(
            'DELETE FROM admin_sessions WHERE absolute_expires_at < UTC_TIMESTAMP()'
        );
        return ['deleted' => $deleted, 'ran_at' => gmdate('c')];
    }

    private static function validUuid(mixed $v): ?string
    {
        if (!is_string($v)) {
            return null;
        }
        $v = trim($v);
        if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $v)) {
            return null;
        }
        return strtolower($v);
    }

    private static function clamp(string $s, int $max): string
    {
        $s = trim($s);
        if (strlen($s) > $max) {
            return substr($s, 0, $max);
        }
        return $s;
    }

    private static function dim(mixed $v): ?int
    {
        if (!is_numeric($v)) {
            return null;
        }
        $n = (int) $v;
        if ($n < 0 || $n > 10000) {
            return null;
        }
        return $n;
    }
}
