<?php
declare(strict_types=1);

/**
 * Minimal probe — open https://YOUR_DOMAIN/api/ping.php
 * If this works but /api/health fails, the issue is in bootstrap/libs.
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$ext = [
    'pdo' => extension_loaded('pdo'),
    'pdo_mysql' => extension_loaded('pdo_mysql'),
    'openssl' => extension_loaded('openssl'),
    'json' => extension_loaded('json'),
];

echo json_encode([
    'ok' => true,
    'php' => PHP_VERSION,
    'php_ok' => PHP_VERSION_ID >= 80100,
    'sapi' => PHP_SAPI,
    'extensions' => $ext,
    'env_file' => is_readable(__DIR__ . '/.env'),
], JSON_UNESCAPED_SLASHES);
