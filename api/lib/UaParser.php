<?php
declare(strict_types=1);

final class UaParser
{
    public static function parse(?string $ua): array
    {
        $ua = $ua ?? '';
        $bot = self::isBot($ua);
        return [
            'browser' => self::browser($ua),
            'os' => self::os($ua),
            'device_type' => self::device($ua),
            'is_bot' => $bot,
        ];
    }

    public static function isBot(string $ua): bool
    {
        if ($ua === '') {
            return true;
        }
        return (bool) preg_match(
            '/bot|crawl|spider|slurp|facebookexternalhit|preview|wget|curl|python-requests|headless|phantom|selenium/i',
            $ua
        );
    }

    private static function browser(string $ua): string
    {
        if (preg_match('/Edg\//i', $ua)) return 'Edge';
        if (preg_match('/OPR\/|Opera/i', $ua)) return 'Opera';
        if (preg_match('/Chrome\//i', $ua) && !preg_match('/Chromium/i', $ua)) return 'Chrome';
        if (preg_match('/Safari\//i', $ua) && !preg_match('/Chrome/i', $ua)) return 'Safari';
        if (preg_match('/Firefox\//i', $ua)) return 'Firefox';
        if (preg_match('/MSIE|Trident/i', $ua)) return 'IE';
        return 'Other';
    }

    private static function os(string $ua): string
    {
        if (preg_match('/Windows NT/i', $ua)) return 'Windows';
        if (preg_match('/Mac OS X|Macintosh/i', $ua)) return 'macOS';
        if (preg_match('/Android/i', $ua)) return 'Android';
        if (preg_match('/iPhone|iPad|iOS/i', $ua)) return 'iOS';
        if (preg_match('/Linux/i', $ua)) return 'Linux';
        return 'Other';
    }

    private static function device(string $ua): string
    {
        if (preg_match('/iPad|Tablet|Android(?!.*Mobile)/i', $ua)) return 'Tablet';
        if (preg_match('/Mobile|iPhone|Android.*Mobile/i', $ua)) return 'Mobile';
        return 'Desktop';
    }
}
