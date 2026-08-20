<?php
declare(strict_types=1);

final class RateLimit
{
    public static function tooManyLoginAttempts(string $username, string $ip): bool
    {
        $pdo = Db::pdo();
        $window = Config::int('LOGIN_RATE_WINDOW_SEC', 900);
        $maxIp = Config::int('LOGIN_RATE_MAX_IP', 20);
        $maxUser = Config::int('LOGIN_RATE_MAX_USER', 10);
        $since = gmdate('Y-m-d H:i:s', time() - $window);
        $ipHash = Security::hashIp($ip);
        $userHash = Security::hashUsername($username);

        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM auth_attempts WHERE ip_hash = ? AND attempted_at >= ? AND success = 0'
        );
        $stmt->execute([$ipHash, $since]);
        if ((int) $stmt->fetchColumn() >= $maxIp) {
            return true;
        }

        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM auth_attempts WHERE username_hash = ? AND attempted_at >= ? AND success = 0'
        );
        $stmt->execute([$userHash, $since]);
        return (int) $stmt->fetchColumn() >= $maxUser;
    }

    public static function recordLoginAttempt(string $username, string $ip, bool $success): void
    {
        $pdo = Db::pdo();
        $stmt = $pdo->prepare(
            'INSERT INTO auth_attempts (username_hash, ip_hash, success, attempted_at) VALUES (?, ?, ?, ?)'
        );
        $stmt->execute([
            Security::hashUsername($username),
            Security::hashIp($ip),
            $success ? 1 : 0,
            gmdate('Y-m-d H:i:s'),
        ]);
    }

    public static function analyticsLimited(string $visitorId, string $ip): bool
    {
        // Soft limit via recent pageviews / heartbeats in short window
        $pdo = Db::tryPdo();
        if (!$pdo) {
            return true;
        }
        $max = Config::int('ANALYTICS_RATE_MAX_PER_MIN', 120);
        $since = gmdate('Y-m-d H:i:s', time() - 60);
        try {
            $stmt = $pdo->prepare(
                'SELECT COUNT(*) FROM analytics_pageviews WHERE visitor_id = ? AND viewed_at >= ?'
            );
            $stmt->execute([$visitorId, $since]);
            return (int) $stmt->fetchColumn() >= $max;
        } catch (Throwable) {
            return false;
        }
    }
}
