<?php
declare(strict_types=1);

final class Security
{
    public static function clientIp(): string
    {
        $trusted = Config::bool('TRUSTED_PROXY', false);
        if ($trusted) {
            $cf = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? null;
            if (is_string($cf) && filter_var($cf, FILTER_VALIDATE_IP)) {
                return $cf;
            }
            $xff = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? null;
            if (is_string($xff) && $xff !== '') {
                $parts = array_map('trim', explode(',', $xff));
                if (isset($parts[0]) && filter_var($parts[0], FILTER_VALIDATE_IP)) {
                    return $parts[0];
                }
            }
        }
        $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '0.0.0.0';
    }

    public static function hashIp(string $ip): string
    {
        $pepper = Config::get('IP_HASH_PEPPER', Config::get('APP_KEY', 'change-me'));
        return hash('sha256', $pepper . '|' . $ip);
    }

    public static function hashUsername(string $username): string
    {
        $pepper = Config::get('IP_HASH_PEPPER', Config::get('APP_KEY', 'change-me'));
        return hash('sha256', $pepper . '|user|' . strtolower(trim($username)));
    }

    public static function hashUa(string $ua): string
    {
        $pepper = Config::get('IP_HASH_PEPPER', Config::get('APP_KEY', 'change-me'));
        return hash('sha256', $pepper . '|ua|' . $ua);
    }

    public static function randomToken(int $bytes = 32): string
    {
        return bin2hex(random_bytes($bytes));
    }

    public static function passwordHash(string $password): string
    {
        if (defined('PASSWORD_ARGON2ID')) {
            return password_hash($password, PASSWORD_ARGON2ID);
        }
        return password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    }

    public static function passwordVerify(string $password, string $hash): bool
    {
        return password_verify($password, $hash);
    }

    public static function isHttps(): bool
    {
        if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
            return true;
        }
        if (Config::bool('TRUSTED_PROXY', false) && ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https') {
            return true;
        }
        return false;
    }

    public static function setSessionCookie(string $name, string $value, int $expires): void
    {
        $secure = self::isHttps() || Config::bool('FORCE_SECURE_COOKIES', true);
        setcookie($name, $value, [
            'expires' => $expires,
            'path' => '/',
            'secure' => $secure,
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
    }

    public static function clearCookie(string $name): void
    {
        $secure = self::isHttps() || Config::bool('FORCE_SECURE_COOKIES', true);
        setcookie($name, '', [
            'expires' => time() - 3600,
            'path' => '/',
            'secure' => $secure,
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
    }

    public static function corsHeaders(): void
    {
        $origin = Config::get('ALLOWED_ORIGIN', '');
        if ($origin === '') {
            $scheme = self::isHttps() ? 'https' : 'http';
            $host = $_SERVER['HTTP_HOST'] ?? '';
            $origin = $host !== '' ? "{$scheme}://{$host}" : '*';
        }
        $reqOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
        if ($origin !== '*' && $reqOrigin !== '' && $reqOrigin === $origin) {
            header("Access-Control-Allow-Origin: {$origin}");
            header('Access-Control-Allow-Credentials: true');
        } elseif ($origin === '*') {
            header('Access-Control-Allow-Origin: *');
        }
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
        header('Vary: Origin');
    }

    public static function readJsonBody(): array
    {
        $raw = file_get_contents('php://input');
        if ($raw === false || trim($raw) === '') {
            return [];
        }
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }
}
