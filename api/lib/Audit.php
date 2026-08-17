<?php
declare(strict_types=1);

final class Audit
{
    public static function log(?int $adminId, string $action, ?array $meta = null): void
    {
        try {
            $pdo = Db::pdo();
            $stmt = $pdo->prepare(
                'INSERT INTO admin_audit_logs (admin_id, action, created_at, security_ip_hash, metadata_json)
                 VALUES (?, ?, ?, ?, ?)'
            );
            $stmt->execute([
                $adminId,
                $action,
                gmdate('Y-m-d H:i:s'),
                Security::hashIp(Security::clientIp()),
                $meta === null ? null : json_encode($meta, JSON_UNESCAPED_UNICODE),
            ]);
        } catch (Throwable) {
            // fail-soft for audit
        }
    }
}
