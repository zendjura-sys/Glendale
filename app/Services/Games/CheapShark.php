<?php

namespace App\Services\Games;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Ціни в цифрових магазинах (Steam, GOG, Humble, Fanatical…) — публічний API CheapShark, без ключа.
 * Ціни в доларах США; посилання на покупку — через їхній redirect (так просять умови API).
 */
class CheapShark
{
    public const API = 'https://www.cheapshark.com/api/1.0';

    /**
     * Найкращі пропозиції для гри Steam: від найдешевшої. Кеш 3 год.
     *
     * @return array{deals: list<array{store: string, price: float, retail: float, savings: int, url: string}>, lowest_ever: float|null}|null
     */
    public function forSteam(int $appId): ?array
    {
        // Порожній масив у кеші — «нічого не знайшли», щоб не питати щоразу.
        $value = Cache::remember('cheapshark.steam.'.$appId, now()->addHours(3), fn () => $this->fetch($appId) ?? []);

        return $value === [] ? null : $value;
    }

    /**
     * @return array{deals: list<array{store: string, price: float, retail: float, savings: int, url: string}>, lowest_ever: float|null}|null
     */
    private function fetch(int $appId): ?array
    {
        $id = $this->gameId($appId);
        $info = $id === null ? null : $this->get('/games', ['id' => $id]);
        if (! is_array($info) || ! is_array($info['deals'] ?? null)) {
            return null;
        }
        $stores = $this->stores();
        $deals = [];
        foreach ($info['deals'] as $deal) {
            if (! is_array($deal) || ! isset($stores[(string) ($deal['storeID'] ?? '')])) {
                continue;
            }
            $deals[] = [
                'store' => $stores[(string) $deal['storeID']],
                'price' => round((float) ($deal['price'] ?? 0), 2),
                'retail' => round((float) ($deal['retailPrice'] ?? 0), 2),
                'savings' => (int) round((float) ($deal['savings'] ?? 0)),
                'url' => 'https://www.cheapshark.com/redirect?dealID='.rawurlencode((string) ($deal['dealID'] ?? '')),
            ];
        }
        usort($deals, fn (array $a, array $b) => $a['price'] <=> $b['price']);
        $lowest = is_array($info['cheapestPriceEver'] ?? null) ? ($info['cheapestPriceEver']['price'] ?? null) : null;

        return ['deals' => array_slice($deals, 0, 8), 'lowest_ever' => is_numeric($lowest) ? round((float) $lowest, 2) : null];
    }

    /**
     * Найкраща пропозиція зараз (для сповіщення про знижку).
     *
     * @return array{store: string, price: float, retail: float, savings: int, url: string}|null
     */
    public function best(int $appId): ?array
    {
        $deals = $this->forSteam($appId)['deals'] ?? [];

        return $deals[0] ?? null;
    }

    private function gameId(int $appId): ?string
    {
        return Cache::remember('cheapshark.id.'.$appId, now()->addDays(30), function () use ($appId) {
            $rows = $this->get('/games', ['steamAppID' => $appId]);
            $id = is_array($rows) && is_array($rows[0] ?? null) ? ($rows[0]['gameID'] ?? null) : null;

            return is_scalar($id) ? (string) $id : null;
        });
    }

    /**
     * Активні магазини: id → назва. Кеш доба.
     *
     * @return array<string, string>
     */
    private function stores(): array
    {
        $stores = Cache::get('cheapshark.stores');
        if (is_array($stores) && $stores !== []) {
            return $stores;
        }
        $stores = [];
        foreach ((array) $this->get('/stores') as $row) {
            if (is_array($row) && (int) ($row['isActive'] ?? 0) === 1 && isset($row['storeID'], $row['storeName'])) {
                $stores[(string) $row['storeID']] = (string) $row['storeName'];
            }
        }
        if ($stores !== []) {
            Cache::put('cheapshark.stores', $stores, now()->addDay());
        }

        return $stores;
    }

    /**
     * @param  array<string, mixed>  $query
     */
    private function get(string $path, array $query = []): mixed
    {
        try {
            $response = Http::timeout(8)->connectTimeout(4)->acceptJson()->get(self::API.$path, $query);
        } catch (ConnectionException) {
            return null;
        }

        return $response->successful() ? $response->json() : null;
    }
}
