<?php

namespace App\Services\Alerts;

use App\Support\Settings\SiteSettings;
use Carbon\CarbonImmutable;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * NEPTUN (neptun.in.ua/developers) — відкритий безкоштовний API без ключів: офіційні тривоги по районах
 * й областях, активні цілі з курсом і впевненістю, стрічка повідомлень каналів. Умови: лише GET, не частіше
 * ніж раз на 5 с (CDN-кеш), обов’язкове видиме посилання на NEPTUN поруч із мапою (див. ATTRIBUTION).
 */
class Neptun
{
    public const BASE = 'https://neptun.in.ua';

    public const ATTRIBUTION = 'Дані: Карта повітряних загроз NEPTUN';

    /** Кеш відповіді — щоб усі відвідувачі разом не били NEPTUN частіше, ніж просять умови. */
    public const CACHE_SECONDS = 10;

    /** Упевненість мітки за рівнем NEPTUN. */
    private const CONFIDENCE = ['low' => 30, 'medium' => 60, 'high' => 90];

    public function __construct(
        private readonly SiteSettings $settings,
        private readonly AirAlertService $alerts,
    ) {}

    public function enabled(): bool
    {
        return (string) ($this->settings->get('alerts_neptun') ?? '1') !== '0';
    }

    /**
     * Активні цілі у форматі картки мапи (як AirThreat::toCard()).
     *
     * @return list<array<string, mixed>>|null
     */
    public function threatCards(): ?array
    {
        $data = $this->get('/api/v1/threats');
        if ($data === null || ! is_array($data['threats'] ?? null)) {
            return null;
        }
        $now = CarbonImmutable::now();
        $cards = [];
        foreach ($data['threats'] as $t) {
            if (! is_array($t) || ! is_numeric($t['lat'] ?? null) || ! is_numeric($t['lon'] ?? null) || ($t['status'] ?? 'active') === 'removed') {
                continue;
            }
            $title = (string) ($t['title'] ?? '');
            $text = $title.' '.(string) ($t['explanationShort'] ?? '');
            $type = $this->type((string) ($t['type'] ?? 'uav'), $text);
            $areaOnly = ($t['areaOnly'] ?? false) === true;
            $parsed = $this->alerts->parse($text);
            $velocity = is_array($t['velocity'] ?? null) ? $t['velocity'] : [];
            $heading = $t['heading'] ?? $velocity['bearingDeg'] ?? null;
            $speed = $velocity['speedKmh'] ?? $velocity['speed'] ?? null;
            $updated = self::time($t, ['updatedAt']) ?? $now->toIso8601String();
            $first = self::time($t, ['firstSeenAt', 'createdAt', 'confirmedAt']) ?? $updated;
            $level = (string) ($t['confidenceLevel'] ?? 'medium');
            $cards[] = [
                'id' => crc32('neptun:'.(string) ($t['id'] ?? $title.$t['lat'].$t['lon'])) & 0x7FFFFFFF,
                'type' => $type,
                'variant' => $parsed !== null && $parsed['type'] === $type ? $parsed['variant'] : null,
                'region' => $this->alerts->slugFor((string) ($t['region'] ?? '')) ?? 'ua',
                'place' => $t['locality'] ?? $t['district'] ?? $t['region'] ?? null,
                'title' => mb_substr((string) ($t['explanationShort'] ?? $title), 0, 290),
                'lat' => (float) $t['lat'],
                'lng' => (float) $t['lon'],
                // Лише область (areaOnly) — це центр області, не місце: без курсу й руху.
                'course' => $areaOnly || ! is_numeric($heading) ? null : (int) round((float) $heading),
                'speed' => $areaOnly ? 0 : (is_numeric($speed) ? (int) round((float) $speed) : (AirAlertService::SPEED[$type] ?? 0)),
                'confidence' => self::CONFIDENCE[$level] ?? 60,
                'sources' => array_fill(0, max(1, (int) ($t['sourceCount'] ?? 1)), 'neptun'),
                'count' => max(1, (int) ($t['count'] ?? 1)),
                'advisory' => ($t['advisory'] ?? false) === true,
                'area_only' => $areaOnly,
                'uncertainty_km' => is_numeric($t['uncertaintyKm'] ?? null) ? (float) $t['uncertaintyKm'] : null,
                'detected_at' => $first,
                'updated_at' => $updated,
                // Точка lat/lon актуальна на момент оновлення — рух рахуємо від нього.
                'position_at' => $updated,
                'expires_at' => $now->addMinutes(AirAlertService::LIFETIME[$type] ?? 15)->toIso8601String(),
                'provider' => 'neptun',
            ];
        }

        return $cards;
    }

    /**
     * Стрічка повідомлень каналів для бічної панелі.
     *
     * @return list<array{ref: string, channel: string|null, group: string, text: string, at: string}>|null
     */
    public function feed(): ?array
    {
        $data = $this->get('/api/v1/messages');
        if ($data === null || ! is_array($data['messages'] ?? null)) {
            return null;
        }
        $out = [];
        foreach (array_slice($data['messages'], 0, 30) as $i => $m) {
            if (! is_array($m) || trim((string) ($m['text'] ?? '')) === '') {
                continue;
            }
            $channel = is_string($m['channel'] ?? null) ? ltrim($m['channel'], '@') : null;
            $out[] = [
                'ref' => 'neptun:'.(string) ($m['id'] ?? $i),
                'channel' => $channel,
                'group' => $channel !== null ? AlertSources::group($channel) : 'custom',
                'text' => mb_substr((string) $m['text'], 0, 400),
                'at' => self::time($m, ['date', 'ts', 'createdAt', 'time']) ?? CarbonImmutable::now()->toIso8601String(),
            ];
        }

        return $out;
    }

    /** @return array<string, mixed>|null */
    private function get(string $path): ?array
    {
        if (! $this->enabled()) {
            return null;
        }

        return Cache::remember('alerts.neptun.'.md5($path), self::CACHE_SECONDS, function () use ($path) {
            try {
                $response = Http::timeout(5)->acceptJson()->withUserAgent('GameCon/1.0 (+https://gamecon.online)')->get(self::BASE.$path);
                $json = $response->successful() ? $response->json() : null;
            } catch (ConnectionException|RequestException) {
                return null;
            }

            return is_array($json) ? $json : null;
        });
    }

    /** Тип NEPTUN → наш: uav, missile, ballistic, kab, mig, artillery. */
    private function type(string $raw, string $text): string
    {
        $raw = strtolower($raw);
        $lower = mb_strtolower($text);

        return match (true) {
            str_contains($raw, 'ballist') || str_contains($lower, 'балістик') => 'ballistic',
            str_contains($raw, 'kab') || str_contains($raw, 'bomb') || str_contains($lower, 'каб') => 'kab',
            str_contains($raw, 'aircraft') || str_contains($raw, 'aviation') || str_contains($raw, 'mig') || str_contains($lower, 'міг') => 'mig',
            str_contains($raw, 'artill') => 'artillery',
            str_contains($raw, 'missile') || str_contains($raw, 'rocket') || str_contains($raw, 'cruise') => 'missile',
            default => 'uav',
        };
    }

    /** «odeska» / «krymska» / «kyiv» → наш slug області. */
    public function oblastSlug(string $key, string $name = ''): ?string
    {
        if ($name !== '' && ($slug = $this->alerts->slugFor($name)) !== null) {
            return $slug;
        }
        $key = strtolower(trim($key));
        if ($key === '') {
            return null;
        }
        if (in_array($key, ['krymska', 'krym', 'crimea', 'ar-krym', 'sevastopol'], true)) {
            return 'crimea';
        }
        if (in_array($key, ['kyiv', 'm-kyiv', 'kyiv-city', 'kyivmisto', 'kyiv_city'], true)) {
            return 'kyiv';
        }
        foreach (AirAlertService::REGIONS as $slug => $region) {
            if ($slug !== 'kyiv' && self::latin(explode(' ', $region['name'])[0]) === $key) {
                return $slug;
            }
        }

        return null;
    }

    /** Код району за ключем «odeskyi» чи назвою «Одеський район». */
    private function raionCode(string $oblast, string $key, string $name): ?string
    {
        if ($name !== '' && ($code = AlertUnits::find($oblast, 2, $name)) !== null) {
            return $code;
        }
        $key = strtolower((string) preg_replace('/[^a-z]/i', '', $key));
        if ($key === '') {
            return null;
        }
        foreach (AlertUnits::raionsOf($oblast) as $code) {
            $latin = (string) preg_replace('/[^a-z]/', '', self::latin(str_replace(' район', '', AlertUnits::all()[$code][0])));
            if ($latin === $key) {
                return $code;
            }
        }

        return null;
    }

    /** Транслітерація (постанова КМУ 2010, спрощено): «Одеський» → «odeskyi». */
    public static function latin(string $text): string
    {
        $map = ['а' => 'a', 'б' => 'b', 'в' => 'v', 'г' => 'h', 'ґ' => 'g', 'д' => 'd', 'е' => 'e', 'є' => 'ie', 'ж' => 'zh', 'з' => 'z', 'и' => 'y', 'і' => 'i', 'ї' => 'i', 'й' => 'i', 'к' => 'k', 'л' => 'l', 'м' => 'm', 'н' => 'n', 'о' => 'o', 'п' => 'p', 'р' => 'r', 'с' => 's', 'т' => 't', 'у' => 'u', 'ф' => 'f', 'х' => 'kh', 'ц' => 'ts', 'ч' => 'ch', 'ш' => 'sh', 'щ' => 'shch', 'ь' => '', 'ю' => 'iu', 'я' => 'ia', '’' => '', '\'' => '', 'ʼ' => ''];

        return strtr(mb_strtolower(trim($text)), $map);
    }

    /**
     * @param  array<mixed>  $item
     * @param  list<string>  $keys
     */
    private static function time(array $item, array $keys = ['startedAt', 'since', 'started_at', 'updatedAt']): ?string
    {
        foreach ($keys as $key) {
            if (is_string($item[$key] ?? null) && $item[$key] !== '') {
                try {
                    return CarbonImmutable::parse($item[$key])->toIso8601String();
                } catch (Throwable) {
                    continue;
                }
            }
        }

        return null;
    }
}
