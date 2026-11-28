<?php

namespace App\Services\Push;

use Illuminate\Support\Facades\Cache;

/**
 * Лічильники доставки пушів за днями: канал (app — FCM, web — браузери), результат (sent, failed, gone, expired)
 * і вид сповіщення. Зберігаємо в кеші 35 днів — для звіту в адмінці, без окремої таблиці.
 */
class PushStats
{
    public const CHANNELS = ['app', 'web'];

    public const RESULTS = ['sent', 'failed', 'gone', 'expired'];

    private const TTL_DAYS = 35;

    public static function hit(string $channel, string $result, ?string $kind = null): void
    {
        $day = now()->format('Y-m-d');
        foreach (array_filter(["push_stats:{$day}:{$channel}:{$result}", $kind !== null && $result === 'sent' ? "push_stats:{$day}:kind:{$kind}" : null]) as $key) {
            Cache::add($key, 0, now()->addDays(self::TTL_DAYS));
            Cache::increment($key);
        }
        if ($kind !== null && $result === 'sent') {
            $kinds = Cache::get("push_stats:{$day}:kinds", []);
            if (! in_array($kind, $kinds, true)) {
                Cache::put("push_stats:{$day}:kinds", [...$kinds, $kind], now()->addDays(self::TTL_DAYS));
            }
        }
    }

    /**
     * @return array{days: list<array<string, mixed>>, kinds: array<string, int>, totals: array<string, int>}
     */
    public static function report(int $days = 14): array
    {
        $rows = [];
        $kinds = [];
        $totals = array_fill_keys(self::RESULTS, 0);
        for ($i = $days - 1; $i >= 0; $i--) {
            $day = now()->subDays($i)->format('Y-m-d');
            $row = ['day' => $day];
            foreach (self::CHANNELS as $channel) {
                foreach (self::RESULTS as $result) {
                    $n = (int) Cache::get("push_stats:{$day}:{$channel}:{$result}", 0);
                    $row[$channel][$result] = $n;
                    $totals[$result] += $n;
                }
            }
            foreach ((array) Cache::get("push_stats:{$day}:kinds", []) as $kind) {
                $kinds[$kind] = ($kinds[$kind] ?? 0) + (int) Cache::get("push_stats:{$day}:kind:{$kind}", 0);
            }
            $rows[] = $row;
        }
        arsort($kinds);

        return ['days' => $rows, 'kinds' => array_slice($kinds, 0, 15, true), 'totals' => $totals];
    }
}
