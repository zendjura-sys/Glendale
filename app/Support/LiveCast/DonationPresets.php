<?php

namespace App\Support\LiveCast;

/**
 * Готові пресети донат-майданчиків LiveCast: лише Donatik і Donatello.
 */
final class DonationPresets
{
    /**
     * @return list<array{key: string, name: string, placeholder: string, hosts: list<string>}>
     */
    public static function all(): array
    {
        return [
            [
                'key' => 'donatik',
                'name' => 'Donatik',
                'placeholder' => 'https://donatik.ua/…',
                'hosts' => ['donatik.ua'],
            ],
            [
                'key' => 'donatello',
                'name' => 'Donatello',
                'placeholder' => 'https://donatello.to/…',
                'hosts' => ['donatello.to'],
            ],
            // «Банка» monobank — лише посилання (відкритого API з донатами немає).
            [
                'key' => 'monobank',
                'name' => 'Банка monobank',
                'placeholder' => 'https://send.monobank.ua/jar/…',
                'hosts' => ['send.monobank.ua'],
            ],
        ];
    }

    /** @return array{key: string, name: string, placeholder: string, hosts: list<string>}|null */
    public static function find(string $key): ?array
    {
        foreach (self::all() as $preset) {
            if ($preset['key'] === $key) {
                return $preset;
            }
        }

        return null;
    }

    /**
     * Перевірити й нормалізувати лінки від ведучого (макс. по одному на майданчик).
     *
     * @return list<array{provider: string, name: string, url: string}>
     */
    public static function sanitize(mixed $raw): array
    {
        if (! is_array($raw)) {
            return [];
        }
        $out = [];
        $seen = [];
        foreach (array_slice($raw, 0, 4) as $row) {
            if (! is_array($row)) {
                continue;
            }
            $key = (string) ($row['provider'] ?? $row['key'] ?? '');
            $url = trim((string) ($row['url'] ?? ''));
            $preset = self::find($key);
            if ($preset === null || isset($seen[$key]) || $url === '' || ! filter_var($url, FILTER_VALIDATE_URL)) {
                continue;
            }
            $host = strtolower((string) parse_url($url, PHP_URL_HOST));
            if (! self::hostMatches($host, $preset['hosts'])) {
                continue;
            }
            if (! in_array(strtolower((string) parse_url($url, PHP_URL_SCHEME)), ['https', 'http'], true)) {
                continue;
            }
            $seen[$key] = true;
            $out[] = [
                'provider' => $preset['key'],
                'name' => $preset['name'],
                'url' => $url,
            ];
        }

        return $out;
    }

    /** @param  list<string>  $allowed */
    private static function hostMatches(string $host, array $allowed): bool
    {
        foreach ($allowed as $base) {
            if ($host === $base || str_ends_with($host, '.'.$base)) {
                return true;
            }
        }

        return false;
    }
}
