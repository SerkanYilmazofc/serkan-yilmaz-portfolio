<?php
declare(strict_types=1);

// Fail with readable JSON if PHP is too old (never / mixed need 8.1+)
if (PHP_VERSION_ID < 80100) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'ok' => false,
        'error' => 'PHP 8.1+ required. Set MultiPHP to 8.1 or 8.2 in cPanel.',
        'php' => PHP_VERSION,
    ]);
    exit;
}

require_once __DIR__ . '/lib/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = $_GET['path'] ?? '';
if ($path === '' && isset($_SERVER['PATH_INFO'])) {
    $path = ltrim((string) $_SERVER['PATH_INFO'], '/');
}
$path = trim((string) $path, '/');

try {
    route($method, $path);
} catch (Throwable $e) {
    $debug = Config::bool('APP_DEBUG', false);
    Response::error(
        $debug ? $e->getMessage() : 'Server error',
        500,
        $debug ? ['exception' => $e->getMessage()] : []
    );
}

function route(string $method, string $path): void
{
    if ($path === '' || $path === 'health') {
        Response::ok([
            'service' => 'serkan-analytics-api',
            'time' => gmdate('c'),
            'php' => PHP_VERSION,
        ]);
    }

    // Public analytics (fail-soft wrappers)
    if ($method === 'POST' && $path === 'analytics/visit') {
        softAnalytics(static fn () => Response::ok(Analytics::visit(Security::readJsonBody())));
    }
    if ($method === 'POST' && $path === 'analytics/pageview') {
        softAnalytics(static function () {
            Analytics::pageview(Security::readJsonBody());
            Response::ok();
        });
    }
    if ($method === 'POST' && $path === 'analytics/heartbeat') {
        softAnalytics(static function () {
            Analytics::heartbeat(Security::readJsonBody());
            Response::ok();
        });
    }

    // Auth
    if ($method === 'GET' && $path === 'auth/status') {
        $setup = false;
        try {
            Auth::ensureDefaultAdmin();
            $setup = Auth::setupComplete();
        } catch (Throwable) {
            Response::ok(['authenticated' => false, 'setup_complete' => false, 'db' => false]);
        }
        $session = null;
        try {
            $session = Auth::currentSession();
        } catch (Throwable) {
            $session = null;
        }
        Response::ok([
            'authenticated' => $session !== null,
            'setup_complete' => $setup,
            'csrf_token' => $session['csrf_token'] ?? null,
            'admin' => $session ? [
                'id' => (int) $session['admin_id'],
                'username' => $session['username'],
                'totp_enabled' => (int) $session['totp_enabled'] === 1,
            ] : null,
        ]);
    }

    if ($method === 'POST' && $path === 'auth/setup') {
        if (!Config::bool('ALLOW_SETUP', false)) {
            Response::error('Setup disabled', 403);
        }
        $body = Security::readJsonBody();
        try {
            if (Auth::setupComplete()) {
                Response::error('Setup already complete', 403);
            }
            $id = Auth::createAdmin((string) ($body['username'] ?? ''), (string) ($body['password'] ?? ''));
            $result = Auth::login((string) $body['username'], (string) $body['password'], null, null);
            Response::ok(array_merge($result, ['admin_id' => $id]));
        } catch (InvalidArgumentException $e) {
            Response::error($e->getMessage(), 400);
        } catch (Throwable $e) {
            Response::error(Config::bool('APP_DEBUG') ? $e->getMessage() : 'Setup failed', 500);
        }
    }

    if ($method === 'POST' && $path === 'auth/login') {
        Auth::ensureDefaultAdmin();
        $body = Security::readJsonBody();
        $result = Auth::login(
            (string) ($body['username'] ?? ''),
            (string) ($body['password'] ?? ''),
            isset($body['totp']) ? (string) $body['totp'] : null,
            isset($body['recovery_code']) ? (string) $body['recovery_code'] : null
        );
        Response::ok($result);
    }

    if ($method === 'POST' && $path === 'auth/logout') {
        $session = Auth::currentSession();
        if ($session) {
            Auth::requireCsrf($session);
        }
        Auth::logout();
        Response::ok();
    }

    if ($method === 'POST' && $path === 'auth/2fa/setup') {
        $session = Auth::requireAuth();
        Auth::requireCsrf($session);
        Response::ok(Auth::enableTotp((int) $session['admin_id']));
    }

    if ($method === 'POST' && $path === 'auth/2fa/confirm') {
        $session = Auth::requireAuth();
        Auth::requireCsrf($session);
        $body = Security::readJsonBody();
        Auth::confirmTotp((int) $session['admin_id'], (string) ($body['code'] ?? ''));
        Response::ok(['totp_enabled' => true]);
    }

    // Admin analytics
    if ($method === 'GET' && $path === 'admin/summary') {
        Auth::requireAuth();
        Response::ok(Analytics::summary());
    }
    if ($method === 'GET' && $path === 'admin/live') {
        Auth::requireAuth();
        Response::ok(Analytics::live());
    }
    if ($method === 'GET' && $path === 'admin/traffic') {
        Auth::requireAuth();
        Response::ok(Analytics::traffic());
    }
    if ($method === 'GET' && $path === 'admin/pages') {
        Auth::requireAuth();
        Response::ok(Analytics::pages());
    }
    if ($method === 'GET' && $path === 'admin/devices') {
        Auth::requireAuth();
        Response::ok(Analytics::devices());
    }
    if ($method === 'GET' && $path === 'admin/timeline') {
        Auth::requireAuth();
        Response::ok(Analytics::timeline());
    }
    if ($method === 'GET' && $path === 'admin/audit') {
        Auth::requireAuth();
        Response::ok(Analytics::auditRecent());
    }
    if ($method === 'POST' && $path === 'admin/cleanup') {
        $session = Auth::requireAuth();
        Auth::requireCsrf($session);
        $token = Config::get('CLEANUP_TOKEN', '');
        $body = Security::readJsonBody();
        if ($token === '' || !hash_equals($token, (string) ($body['token'] ?? ''))) {
            Response::error('Invalid cleanup token', 403);
        }
        Audit::log((int) $session['admin_id'], 'cleanup_ran', []);
        Response::ok(Analytics::cleanup());
    }

    // Cron-friendly cleanup with secret header (no session)
    if ($method === 'POST' && $path === 'cron/cleanup') {
        $token = Config::get('CLEANUP_TOKEN', '');
        $hdr = $_SERVER['HTTP_X_CLEANUP_TOKEN'] ?? '';
        if ($token === '' || !is_string($hdr) || !hash_equals($token, $hdr)) {
            Response::error('Forbidden', 403);
        }
        Response::ok(Analytics::cleanup());
    }

    Response::error('Not found', 404);
}

function softAnalytics(callable $fn): void
{
    try {
        $fn();
    } catch (Throwable $e) {
        // Never break the public site UX
        Response::ok(['accepted' => false, 'soft_fail' => true]);
    }
}
