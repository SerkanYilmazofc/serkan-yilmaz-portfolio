<?php
declare(strict_types=1);

final class Geo
{
    public static function lookup(string $ip): array
    {
        $unknown = [
            'country' => 'Unknown',
            'region' => null,
            'city' => null,
            'lat' => null,
            'lon' => null,
        ];

        // Cloudflare country header (no IP sent elsewhere)
        $cfCountry = $_SERVER['HTTP_CF_IPCOUNTRY'] ?? null;
        if (is_string($cfCountry) && $cfCountry !== '' && $cfCountry !== 'XX') {
            $name = self::countryName($cfCountry);
            $coords = self::countryCentroid($cfCountry);
            return [
                'country' => $name,
                'region' => null,
                'city' => null,
                'lat' => $coords[0],
                'lon' => $coords[1],
                'country_code' => strtoupper($cfCountry),
            ];
        }

        $dbPath = Config::get('GEOLITE2_PATH', '');
        if (
            $dbPath !== ''
            && is_readable($dbPath)
            && class_exists('\\MaxMind\\Db\\Reader')
        ) {
            try {
                // Optional MaxMind if extension/autoload + DB present
                $reader = new \MaxMind\Db\Reader($dbPath);
                $record = $reader->get($ip);
                $reader->close();
                if (is_array($record)) {
                    $country = $record['country']['names']['en']
                        ?? $record['country']['iso_code']
                        ?? 'Unknown';
                    $city = $record['city']['names']['en'] ?? null;
                    $region = $record['subdivisions'][0]['names']['en'] ?? null;
                    $lat = $record['location']['latitude'] ?? null;
                    $lon = $record['location']['longitude'] ?? null;
                    return [
                        'country' => is_string($country) ? $country : 'Unknown',
                        'region' => is_string($region) ? $region : null,
                        'city' => is_string($city) ? $city : null,
                        'lat' => is_numeric($lat) ? (float) $lat : null,
                        'lon' => is_numeric($lon) ? (float) $lon : null,
                    ];
                }
            } catch (Throwable) {
                // fall through
            }
        }

        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
            return array_merge($unknown, ['country' => 'Local']);
        }

        return $unknown;
    }

    public static function approxCoords(?string $country, ?string $city): array
    {
        $key = strtolower(trim(($country ?? '') . '|' . ($city ?? '')));
        $cities = self::cityCoords();
        if (isset($cities[$key])) {
            return $cities[$key];
        }
        // country-only
        foreach (self::countryCentroids() as $code => $coords) {
            if (strcasecmp(self::countryName($code), (string) $country) === 0) {
                return $coords;
            }
        }
        return [null, null];
    }

    private static function countryName(string $code): string
    {
        $map = [
            'TR' => 'Türkiye', 'US' => 'United States', 'DE' => 'Germany', 'GB' => 'United Kingdom',
            'FR' => 'France', 'NL' => 'Netherlands', 'IT' => 'Italy', 'ES' => 'Spain',
            'RU' => 'Russia', 'CN' => 'China', 'JP' => 'Japan', 'IN' => 'India',
            'BR' => 'Brazil', 'CA' => 'Canada', 'AU' => 'Australia', 'AE' => 'UAE',
            'SA' => 'Saudi Arabia', 'AZ' => 'Azerbaijan', 'KZ' => 'Kazakhstan',
        ];
        $c = strtoupper($code);
        return $map[$c] ?? $c;
    }

    private static function countryCentroid(string $code): array
    {
        $c = self::countryCentroids();
        return $c[strtoupper($code)] ?? [null, null];
    }

    private static function countryCentroids(): array
    {
        return [
            'TR' => [39.0, 35.0], 'US' => [39.8, -98.5], 'DE' => [51.2, 10.4], 'GB' => [54.0, -2.0],
            'FR' => [46.2, 2.2], 'NL' => [52.1, 5.3], 'IT' => [41.9, 12.6], 'ES' => [40.4, -3.7],
            'RU' => [61.5, 105.0], 'CN' => [35.9, 104.2], 'JP' => [36.2, 138.3], 'IN' => [20.6, 78.9],
            'BR' => [-14.2, -51.9], 'CA' => [56.1, -106.3], 'AU' => [-25.3, 133.8], 'AE' => [23.4, 53.8],
        ];
    }

    private static function cityCoords(): array
    {
        return [
            'türkiye|istanbul' => [41.01, 28.98],
            'türkiye|ankara' => [39.93, 32.86],
            'türkiye|izmir' => [38.42, 27.14],
            'türkiye|kayseri' => [38.73, 35.49],
            'türkiye|bursa' => [40.19, 29.06],
            'türkiye|antalya' => [36.90, 30.70],
            'germany|berlin' => [52.52, 13.40],
            'united states|new york' => [40.71, -74.00],
            'united kingdom|london' => [51.51, -0.13],
        ];
    }
}
