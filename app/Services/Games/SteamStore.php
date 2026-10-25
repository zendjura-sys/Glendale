<?php

namespace App\Services\Games;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Публічна сторінка гри в Steam (store.steampowered.com/api/appdetails, без ключа): ціна
 * для регіону UA і системні вимоги ПК. Кеш 12 год — у Steam ліміт запитів.
 */
class SteamStore
{
    public const URL = 'https://store.steampowered.com/api/appdetails';

    /** Назви рядків вимог англійською → наші ключі. */
    private const LABELS = [
        'os' => 'os', 'processor' => 'cpu', 'cpu' => 'cpu', 'memory' => 'ram', 'ram' => 'ram',
        'graphics' => 'gpu', 'video card' => 'gpu', 'video' => 'gpu', 'gpu' => 'gpu',
        'storage' => 'storage', 'hard drive' => 'storage', 'hard disk space' => 'storage', 'hard disk' => 'storage', 'disk space' => 'storage',
        'directx' => 'directx', 'network' => 'network', 'sound card' => 'sound', 'additional notes' => 'notes',
    ];

    /**
     * @return array{free: bool, price: array{final: string, initial: string, discount: int}|null, requirements: array{minimum: array<string, string>, recommended: array<string, string>}}|null
     */
    public function app(int $appId): ?array
    {
        // Порожній масив у кеші — гри немає в Steam або він не відповів: годину не питаємо.
        $key = 'steam.app.'.$appId;
        $value = Cache::get($key);
        if (! is_array($value)) {
            $value = $this->fetch($appId) ?? [];
            Cache::put($key, $value, $value === [] ? now()->addHour() : now()->addHours(12));
        }

        return $value === [] ? null : $this->shape($value);
    }

    /**
     * @return array{free: bool, price: array{final: string, initial: string, discount: int}|null, requirements: array{minimum: array<string, string>, recommended: array<string, string>}}|null
     */
    private function fetch(int $appId): ?array
    {
        try {
            $response = Http::timeout(8)->connectTimeout(4)->acceptJson()
                ->get(self::URL, ['appids' => $appId, 'cc' => 'ua', 'l' => 'english']);
        } catch (ConnectionException) {
            return null;
        }
        $data = $response->successful() ? $response->json((string) $appId) : null;
        if (! is_array($data) || ($data['success'] ?? false) !== true || ! is_array($data['data'] ?? null)) {
            return null;
        }
        $app = $data['data'];
        $price = is_array($app['price_overview'] ?? null) ? $app['price_overview'] : null;
        $req = is_array($app['pc_requirements'] ?? null) ? $app['pc_requirements'] : [];

        return [
            'free' => ($app['is_free'] ?? false) === true,
            'price' => $price === null ? null : [
                'final' => (string) ($price['final_formatted'] ?? ''),
                'initial' => (string) ($price['initial_formatted'] ?? ''),
                'discount' => (int) ($price['discount_percent'] ?? 0),
            ],
            'requirements' => [
                'minimum' => self::parse(is_string($req['minimum'] ?? null) ? $req['minimum'] : ''),
                'recommended' => self::parse(is_string($req['recommended'] ?? null) ? $req['recommended'] : ''),
            ],
        ];
    }

    /**
     * Значення з кешу (масив у ньому — з fetch()) → той самий вигляд, перевірений поле за полем.
     *
     * @param  array<mixed>  $value
     * @return array{free: bool, price: array{final: string, initial: string, discount: int}|null, requirements: array{minimum: array<string, string>, recommended: array<string, string>}}
     */
    private function shape(array $value): array
    {
        $price = is_array($value['price'] ?? null) ? $value['price'] : null;
        $req = is_array($value['requirements'] ?? null) ? $value['requirements'] : [];
        $level = fn (mixed $rows): array => is_array($rows)
            ? array_filter(array_map(fn ($v) => is_string($v) ? $v : null, $rows), fn ($v, $k) => $v !== null && is_string($k), ARRAY_FILTER_USE_BOTH)
            : [];

        return [
            'free' => ($value['free'] ?? false) === true,
            'price' => $price === null ? null : [
                'final' => (string) ($price['final'] ?? ''),
                'initial' => (string) ($price['initial'] ?? ''),
                'discount' => (int) ($price['discount'] ?? 0),
            ],
            'requirements' => ['minimum' => $level($req['minimum'] ?? null), 'recommended' => $level($req['recommended'] ?? null)],
        ];
    }

    /**
     * HTML вимог Steam («<li><strong>Processor:</strong> Intel Core i5…») → ['cpu' => '…', 'ram' => '…'].
     *
     * @return array<string, string>
     */
    public static function parse(string $html): array
    {
        $text = (string) preg_replace('#<br\s*/?>|</li>|</p>#i', "\n", $html);
        $text = html_entity_decode(strip_tags($text), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $out = [];
        foreach (preg_split('/\R/u', $text) ?: [] as $line) {
            if (! preg_match('/^\s*([A-Za-z ]{2,24}):\s*(.+?)\s*$/u', $line, $m)) {
                continue;
            }
            $label = self::LABELS[strtolower(trim($m[1]))] ?? null;
            if ($label !== null && ! isset($out[$label])) {
                $out[$label] = mb_substr($m[2], 0, 300);
            }
        }

        return $out;
    }
}
