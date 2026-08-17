<?php
declare(strict_types=1);

/**
 * CLI: php scripts/create_admin.php username 'StrongPasswordHere'
 * Requires ALLOW_SETUP=true in .env OR empty admin_users table.
 */
if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "CLI only\n");
    exit(1);
}

require_once dirname(__DIR__) . '/lib/bootstrap.php';

$username = $argv[1] ?? '';
$password = $argv[2] ?? '';
if ($username === '' || $password === '') {
    fwrite(STDERR, "Usage: php create_admin.php <username> <password>\n");
    exit(1);
}

try {
    // Temporarily allow setup via CLI even if ALLOW_SETUP is false,
    // but only when no admin exists yet.
    if (Auth::setupComplete()) {
        fwrite(STDERR, "Setup already complete. Refusing to create another admin via this script.\n");
        exit(1);
    }
    $id = Auth::createAdmin($username, $password);
    echo "Admin created id={$id} username={$username}\n";
    echo "Disable public setup: set ALLOW_SETUP=false in .env\n";
} catch (Throwable $e) {
    fwrite(STDERR, $e->getMessage() . "\n");
    exit(1);
}
