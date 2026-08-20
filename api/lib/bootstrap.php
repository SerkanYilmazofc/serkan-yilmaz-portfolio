<?php
declare(strict_types=1);

$apiRoot = dirname(__DIR__);
require_once __DIR__ . '/Config.php';
require_once __DIR__ . '/Db.php';
require_once __DIR__ . '/Response.php';
require_once __DIR__ . '/Security.php';
require_once __DIR__ . '/RateLimit.php';
require_once __DIR__ . '/Audit.php';
require_once __DIR__ . '/Totp.php';
require_once __DIR__ . '/Auth.php';
require_once __DIR__ . '/Geo.php';
require_once __DIR__ . '/UaParser.php';
require_once __DIR__ . '/Analytics.php';

Config::load($apiRoot);

date_default_timezone_set('UTC');

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');

Security::corsHeaders();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}
