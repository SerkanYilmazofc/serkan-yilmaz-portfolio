<?php
declare(strict_types=1);

final class Auth
{
    public const COOKIE = 'sy_admin_sid';

    public static function setupComplete(): bool
    {
        $pdo = Db::pdo();
        $stmt = $pdo->query("SELECT meta_value FROM app_meta WHERE meta_key = 'setup_complete' LIMIT 1");
        $row = $stmt->fetch();
        if ($row && (string) $row['meta_value'] === '1') {
            return true;
        }
        $count = (int) $pdo->query('SELECT COUNT(*) FROM admin_users')->fetchColumn();
        return $count > 0;
    }

    /**
     * One-time seed from .env when no admin exists yet.
     * Set DEFAULT_ADMIN_USER + DEFAULT_ADMIN_PASSWORD, then remove after first login.
     */
    public static function ensureDefaultAdmin(): void
    {
        try {
            if (self::setupComplete()) {
                return;
            }
            $user = Config::get('DEFAULT_ADMIN_USER');
            $pass = Config::get('DEFAULT_ADMIN_PASSWORD');
            if ($user === null || $user === '' || $pass === null || $pass === '') {
                return;
            }
            self::createAdmin($user, $pass);
        } catch (Throwable) {
            // fail-soft
        }
    }

    public static function createAdmin(string $username, string $password): int
    {
        $username = trim($username);
        if ($username === '' || strlen($password) < 12) {
            throw new InvalidArgumentException('Invalid username or password too short');
        }
        $pdo = Db::pdo();
        if (self::setupComplete()) {
            throw new RuntimeException('Setup already complete');
        }
        $hash = Security::passwordHash($password);
        $stmt = $pdo->prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)');
        $stmt->execute([$username, $hash]);
        $id = (int) $pdo->lastInsertId();
        $pdo->prepare("INSERT INTO app_meta (meta_key, meta_value) VALUES ('setup_complete', '1')
            ON DUPLICATE KEY UPDATE meta_value = '1'")->execute();
        Audit::log($id, 'admin_created', ['username' => $username]);
        return $id;
    }

    public static function login(string $username, string $password, ?string $totpCode, ?string $recoveryCode): array
    {
        $ip = Security::clientIp();
        if (RateLimit::tooManyLoginAttempts($username, $ip)) {
            Audit::log(null, 'login_rate_limited', ['username' => $username]);
            Response::error('Too many attempts. Try again later.', 429);
        }

        $pdo = Db::pdo();
        $stmt = $pdo->prepare('SELECT * FROM admin_users WHERE username = ? LIMIT 1');
        $stmt->execute([trim($username)]);
        $user = $stmt->fetch();

        $ok = $user && Security::passwordVerify($password, (string) $user['password_hash']);
        if (!$ok) {
            RateLimit::recordLoginAttempt($username, $ip, false);
            Audit::log(null, 'login_failed', ['username' => $username]);
            // Constant-ish delay
            usleep(random_int(200000, 400000));
            Response::error('Invalid credentials', 401);
        }

        $adminId = (int) $user['id'];
        if ((int) $user['totp_enabled'] === 1) {
            $verified = false;
            if ($totpCode !== null && $totpCode !== '') {
                try {
                    $secret = Totp::decryptSecret((string) $user['totp_secret_enc']);
                    $verified = Totp::verify($secret, $totpCode);
                } catch (Throwable) {
                    $verified = false;
                }
            }
            if (!$verified && $recoveryCode !== null && $recoveryCode !== '') {
                $verified = self::consumeRecoveryCode($adminId, $recoveryCode);
            }
            if (!$verified) {
                RateLimit::recordLoginAttempt($username, $ip, false);
                Audit::log($adminId, 'login_2fa_failed', []);
                Response::error('Two-factor authentication required', 401, ['need_2fa' => true]);
            }
        }

        RateLimit::recordLoginAttempt($username, $ip, true);
        $session = self::createSession($adminId);
        Audit::log($adminId, 'login_success', []);
        return [
            'admin' => [
                'id' => $adminId,
                'username' => (string) $user['username'],
                'totp_enabled' => (int) $user['totp_enabled'] === 1,
            ],
            'csrf_token' => $session['csrf_token'],
        ];
    }

    public static function createSession(int $adminId): array
    {
        $pdo = Db::pdo();
        $sid = Security::randomToken(32);
        $csrf = Security::randomToken(32);
        $now = time();
        $idle = Config::int('SESSION_IDLE_SEC', 1800);
        $absolute = Config::int('SESSION_ABSOLUTE_SEC', 28800);
        $stmt = $pdo->prepare(
            'INSERT INTO admin_sessions
            (id, admin_id, csrf_token, created_at, last_seen, absolute_expires_at, user_agent_hash, ip_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $sid,
            $adminId,
            $csrf,
            gmdate('Y-m-d H:i:s', $now),
            gmdate('Y-m-d H:i:s', $now),
            gmdate('Y-m-d H:i:s', $now + $absolute),
            Security::hashUa($_SERVER['HTTP_USER_AGENT'] ?? ''),
            Security::hashIp(Security::clientIp()),
        ]);
        Security::setSessionCookie(self::COOKIE, $sid, $now + $absolute);
        return ['id' => $sid, 'csrf_token' => $csrf, 'idle' => $idle];
    }

    public static function currentSession(): ?array
    {
        $sid = $_COOKIE[self::COOKIE] ?? '';
        if (!is_string($sid) || strlen($sid) < 32) {
            return null;
        }
        $pdo = Db::pdo();
        $stmt = $pdo->prepare(
            'SELECT s.*, u.username, u.totp_enabled
             FROM admin_sessions s
             JOIN admin_users u ON u.id = s.admin_id
             WHERE s.id = ? LIMIT 1'
        );
        $stmt->execute([$sid]);
        $row = $stmt->fetch();
        if (!$row) {
            return null;
        }
        $now = time();
        $absolute = strtotime($row['absolute_expires_at'] . ' UTC');
        $idle = Config::int('SESSION_IDLE_SEC', 1800);
        $lastSeen = strtotime($row['last_seen'] . ' UTC');
        if ($absolute === false || $lastSeen === false || $now > $absolute || ($now - $lastSeen) > $idle) {
            self::destroySession($sid);
            return null;
        }
        $pdo->prepare('UPDATE admin_sessions SET last_seen = ? WHERE id = ?')
            ->execute([gmdate('Y-m-d H:i:s', $now), $sid]);
        return $row;
    }

    public static function requireAuth(): array
    {
        $session = self::currentSession();
        if (!$session) {
            Response::error('Unauthorized', 401);
        }
        return $session;
    }

    public static function requireCsrf(array $session): void
    {
        $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        if (!is_string($token) || !hash_equals((string) $session['csrf_token'], $token)) {
            Response::error('Invalid CSRF token', 403);
        }
    }

    public static function logout(): void
    {
        $sid = $_COOKIE[self::COOKIE] ?? '';
        $session = self::currentSession();
        if (is_string($sid) && $sid !== '') {
            self::destroySession($sid);
        }
        Security::clearCookie(self::COOKIE);
        if ($session) {
            Audit::log((int) $session['admin_id'], 'logout', []);
        }
    }

    public static function destroySession(string $sid): void
    {
        try {
            Db::pdo()->prepare('DELETE FROM admin_sessions WHERE id = ?')->execute([$sid]);
        } catch (Throwable) {
        }
    }

    public static function enableTotp(int $adminId): array
    {
        $secret = Totp::generateSecret();
        $enc = Totp::encryptSecret($secret);
        $pdo = Db::pdo();
        $stmt = $pdo->prepare('SELECT username FROM admin_users WHERE id = ?');
        $stmt->execute([$adminId]);
        $user = $stmt->fetch();
        $pdo->prepare('UPDATE admin_users SET totp_secret_enc = ?, totp_enabled = 0 WHERE id = ?')
            ->execute([$enc, $adminId]);
        $codes = [];
        $pdo->prepare('DELETE FROM admin_recovery_codes WHERE admin_id = ?')->execute([$adminId]);
        for ($i = 0; $i < 8; $i++) {
            $plain = strtoupper(bin2hex(random_bytes(4)));
            $codes[] = $plain;
            $pdo->prepare(
                'INSERT INTO admin_recovery_codes (admin_id, code_hash, created_at) VALUES (?, ?, ?)'
            )->execute([$adminId, hash('sha256', $plain), gmdate('Y-m-d H:i:s')]);
        }
        Audit::log($adminId, 'totp_setup_started', []);
        return [
            'secret' => $secret,
            'otpauth_url' => Totp::otpauthUri(
                $secret,
                (string) ($user['username'] ?? 'admin'),
                Config::get('TOTP_ISSUER', 'SerkanYilmaz Analytics')
            ),
            'recovery_codes' => $codes,
        ];
    }

    public static function confirmTotp(int $adminId, string $code): void
    {
        $pdo = Db::pdo();
        $stmt = $pdo->prepare('SELECT totp_secret_enc FROM admin_users WHERE id = ?');
        $stmt->execute([$adminId]);
        $row = $stmt->fetch();
        if (!$row || empty($row['totp_secret_enc'])) {
            Response::error('2FA not initialized', 400);
        }
        $secret = Totp::decryptSecret((string) $row['totp_secret_enc']);
        if (!Totp::verify($secret, $code)) {
            Response::error('Invalid 2FA code', 400);
        }
        $pdo->prepare('UPDATE admin_users SET totp_enabled = 1 WHERE id = ?')->execute([$adminId]);
        Audit::log($adminId, 'totp_enabled', []);
    }

    private static function consumeRecoveryCode(int $adminId, string $code): bool
    {
        $pdo = Db::pdo();
        $hash = hash('sha256', strtoupper(trim($code)));
        $stmt = $pdo->prepare(
            'SELECT id FROM admin_recovery_codes WHERE admin_id = ? AND code_hash = ? AND used_at IS NULL LIMIT 1'
        );
        $stmt->execute([$adminId, $hash]);
        $row = $stmt->fetch();
        if (!$row) {
            return false;
        }
        $pdo->prepare('UPDATE admin_recovery_codes SET used_at = ? WHERE id = ?')
            ->execute([gmdate('Y-m-d H:i:s'), $row['id']]);
        Audit::log($adminId, 'recovery_code_used', []);
        return true;
    }
}
