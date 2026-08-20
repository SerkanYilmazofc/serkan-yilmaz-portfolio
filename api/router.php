<?php
declare(strict_types=1);

// php -S 127.0.0.1:8080 router.php  (from api/ directory)
$uri = urldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
$file = __DIR__ . $uri;
if ($uri !== '/' && is_file($file)) {
    return false;
}
$path = ltrim($uri, '/');
if (str_starts_with($path, 'index.php')) {
    $path = '';
}
$_GET['path'] = $path;
require __DIR__ . '/index.php';
