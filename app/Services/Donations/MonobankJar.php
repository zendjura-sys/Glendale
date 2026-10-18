<?php

namespace App\Services\Donations;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Банка Monobank: прогрес збору для картки «Підтримати» на сторінці сім’ї чи спільноти.
 *
 * Використовує публічні (без токена) ендпоінти, якими користуються віджети банки:
 *  — POST send.monobank.ua/api/handler {c: "hello", clientId, Pc: "random"} — назва, зібрано, ціль і довгий ID;
 *  — GET  api.monobank.ua/bank/jar/{longJarId} — зібрано й ціль (м’якші ліміти, тож далі питаємо його).
 * Ендпоінти неофіційні: якщо Monobank не відповів, картка показує лише кнопку на банку.
 * Суми — у копійках. Кеш — 10 хвилин.
 */
class MonobankJar
{
    private const CACHE_MINUTES = 10;

    /** ID банки з посилання https://send.monobank.ua/jar/XXXXXXXX (null — не посилання на банку). */
    public static function clientId(?string $url): ?string
    {
        if ($url === null || preg_match('#^(?:https?://)?send\.monobank\.ua/jar/([A-Za-z0-9]{6,32})/?(?:[?\#].*)?$#', trim($url), $m) !== 1) {
            return null;
        }

        return $m[1];
    }

    /** Нормалізоване посилання на банку. */
    public static function url(string $clientId): string
    {
        return 'https://send.monobank.ua/jar/'.$clientId;
    }

    /**
     * Картка для сторінки: посилання, підпис власника і (якщо вдалося) назва, зібрано, ціль.
     *
     * @return array{url: string, note: string|null, title: string|null, amount: int|null, goal: int|null}|null
     */
    public function card(?string $jar, ?string $note): ?array
    {
        $id = self::clientId($jar);
        if ($id === null) {
            return null;
        }
        $info = $this->info($id);

        return [
            'url' => self::url($id),
            'note' => $note,
            'title' => $info['title'] ?? null,
            'amount' => $info['amount'] ?? null,
            'goal' => isset($info['goal']) && $info['goal'] > 0 ? $info['goal'] : null,
        ];
    }

    /**
     * @return array{title: string|null, amount: int, goal: int}|null
     */
    public function info(string $clientId): ?array
    {
        $cached = Cache::get($this->key($clientId));
        if (is_array($cached)) {
            return $cached['ok'] ? $cached['data'] : null;
        }
        $data = $this->fetch($clientId);
        Cache::put($this->key($clientId), ['ok' => $data !== null, 'data' => $data], now()->addMinutes($data !== null ? self::CACHE_MINUTES : 2));

        return $data;
    }

    /** Забути кеш (після зміни посилання). */
    public function forget(?string $jar): void
    {
        if (($id = self::clientId($jar)) !== null) {
            Cache::forget($this->key($id));
        }
    }

    /**
     * @return array{title: string|null, amount: int, goal: int}|null
     */
    private function fetch(string $clientId): ?array
    {
        $long = Cache::get('mono.jar.long.'.$clientId);
        try {
            if (is_string($long) && $long !== '') {
                $json = Http::timeout(5)->acceptJson()->get(rtrim((string) config('services.monobank_jar.api_url'), '/').'/bank/jar/'.rawurlencode($long))->json();
                if (is_array($json) && isset($json['amount'])) {
                    return [
                        'title' => is_string($json['title'] ?? null) ? mb_substr($json['title'], 0, 120) : null,
                        'amount' => max(0, (int) $json['amount']),
                        'goal' => max(0, (int) ($json['goal'] ?? 0)),
                    ];
                }
            }

            $json = Http::timeout(5)->acceptJson()->asJson()
                ->post(rtrim((string) config('services.monobank_jar.send_url'), '/').'/api/handler', ['c' => 'hello', 'clientId' => $clientId, 'Pc' => 'random'])
                ->json();
        } catch (Throwable) {
            return null;
        }
        if (! is_array($json) || ! isset($json['jarAmount']) || isset($json['errCode'])) {
            return null;
        }
        $longId = $json['longJarId'] ?? $json['extJarId'] ?? null;
        if (is_string($longId) && $longId !== '') {
            Cache::put('mono.jar.long.'.$clientId, $longId, now()->addDays(30));
        }

        return [
            'title' => is_string($json['name'] ?? null) ? mb_substr($json['name'], 0, 120) : null,
            'amount' => max(0, (int) $json['jarAmount']),
            'goal' => max(0, (int) ($json['jarGoal'] ?? 0)),
        ];
    }

    private function key(string $clientId): string
    {
        return 'mono.jar.'.$clientId;
    }
}
