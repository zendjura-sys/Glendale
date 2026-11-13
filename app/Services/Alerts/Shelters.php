<?php

namespace App\Services\Alerts;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Укриття й пункти незламності поруч — відкриті дані OpenStreetMap (Overpass API).
 * Без координат людини шукаємо навколо обраного місця тривог: його центр бере Nominatim (кеш назавжди).
 * Дані з мапи можуть бути неповні — на сторінці про це прямо сказано.
 */
class Shelters
{
    public const OVERPASS = 'https://overpass-api.de/api/interpreter';

    public const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

    /** Радіус пошуку, м. */
    public const RADIUS = 2500;

    public function __construct(private UkraineAlarm $api) {}

    /**
     * @return list<array{id: string, kind: 'shelter'|'invincibility', name: string|null, address: string|null, lat: float, lng: float, distance: int}>
     */
    public function near(float $lat, float $lng): array
    {
        // Округлення ~500 м: сусіди ділять кеш, Overpass не смикаємо на кожен рух.
        $key = sprintf('alerts:shelters:%.3f:%.3f', round($lat * 200) / 200, round($lng * 200) / 200);
        $items = Cache::remember($key, now()->addDay(), fn () => $this->fetch($lat, $lng) ?? []);
        foreach ($items as &$item) {
            $item['distance'] = self::distance($lat, $lng, $item['lat'], $item['lng']);
        }
        unset($item);
        usort($items, fn ($a, $b) => $a['distance'] <=> $b['distance']);

        return array_slice($items, 0, 40);
    }

    /** Центр місця з довідника UkraineAlarm (місто, громада, район чи область). @return array{lat: float, lng: float}|null */
    public function centerOf(string $id): ?array
    {
        $node = $this->api->regions()[$id] ?? null;
        if ($node === null) {
            return null;
        }
        $cached = Cache::get('alerts:center:'.$id);
        if (is_array($cached)) {
            return $cached;
        }
        // «м. Житомир, Житомирська область» — без «громада/район», Nominatim так шукає надійніше.
        $name = preg_replace('/^(м\.|с\.|смт|сел\.)\s*/u', '', $node['name']) ?? $node['name'];
        $state = $node['state'] !== $id ? ($this->api->regions()[$node['state']]['name'] ?? '') : '';
        try {
            $hit = Http::timeout(8)->withHeaders(['User-Agent' => 'GameCon/1.0 (+https://gamecon.online)'])
                ->get(self::NOMINATIM, ['q' => trim($name.', '.$state, ', '), 'countrycodes' => 'ua', 'format' => 'json', 'limit' => 1])
                ->json('0');
        } catch (Throwable) {
            return null;
        }
        if (! is_array($hit) || ! is_numeric($hit['lat'] ?? null) || ! is_numeric($hit['lon'] ?? null)) {
            return null;
        }
        $center = ['lat' => (float) $hit['lat'], 'lng' => (float) $hit['lon']];
        Cache::forever('alerts:center:'.$id, $center);

        return $center;
    }

    /** @return list<array{id: string, kind: 'shelter'|'invincibility', name: string|null, address: string|null, lat: float, lng: float, distance: int}>|null */
    private function fetch(float $lat, float $lng): ?array
    {
        $around = sprintf('(around:%d,%F,%F)', self::RADIUS, $lat, $lng);
        $query = '[out:json][timeout:20];('
            .'nwr["amenity"="shelter"]["shelter_type"~"bomb|air_raid|civil"]'.$around.';'
            .'nwr["building"="bunker"]'.$around.';'
            .'nwr["military"="bunker"]["access"!="private"]'.$around.';'
            .'nwr["name"~"[Нн]езламн"]'.$around.';'
            .');out center 80;';
        try {
            $json = Http::timeout(25)->asForm()->withHeaders(['User-Agent' => 'GameCon/1.0 (+https://gamecon.online)'])
                ->post(self::OVERPASS, ['data' => $query])->json('elements');
        } catch (Throwable) {
            return null;
        }
        if (! is_array($json)) {
            return null;
        }
        $out = [];
        foreach ($json as $el) {
            $plat = $el['lat'] ?? $el['center']['lat'] ?? null;
            $plng = $el['lon'] ?? $el['center']['lon'] ?? null;
            if (! is_numeric($plat) || ! is_numeric($plng)) {
                continue;
            }
            $tags = (array) ($el['tags'] ?? []);
            $name = isset($tags['name']) ? (string) $tags['name'] : null;
            $street = trim(($tags['addr:street'] ?? '').' '.($tags['addr:housenumber'] ?? ''));
            $out[] = [
                'id' => ($el['type'] ?? 'node').'/'.($el['id'] ?? ''),
                'kind' => $name !== null && preg_match('/незламн/iu', $name) ? 'invincibility' : 'shelter',
                'name' => $name,
                'address' => $street !== '' ? $street : null,
                'lat' => (float) $plat,
                'lng' => (float) $plng,
                'distance' => 0,
            ];
        }

        return $out;
    }

    /** Відстань по поверхні Землі, м. */
    public static function distance(float $lat1, float $lng1, float $lat2, float $lng2): int
    {
        $r = 6371000;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return (int) round(2 * $r * asin(min(1, sqrt($a))));
    }
}
