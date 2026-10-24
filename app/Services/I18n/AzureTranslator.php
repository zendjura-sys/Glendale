<?php

namespace App\Services\I18n;

use App\Support\I18n\Locales;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Sleep;

/**
 * Microsoft Azure Translator — хмарний перекладач між DeepL і LibreTranslate: не навантажує сервер,
 * безкоштовний тариф F0 — 2 000 000 символів на місяць. Ключ і регіон ресурсу — в Адмінці → Інтеграції.
 *
 * API: POST /translate?api-version=3.0&to=…[&from=…][&textType=html], тіло [{"Text": "…"}].
 * 403001 — вичерпано безкоштовну квоту (позначка до нового місяця), 401 — неправильний ключ, 429 — забагато за хвилину.
 */
class AzureTranslator
{
    public const ENDPOINT = 'https://api.cognitive.microsofttranslator.com';

    /** Скільки рядків в одному запиті (ліміт API — 1000 рядків і 50 000 символів). */
    public const BATCH = 100;

    public const MAX_CHARS = 40000;

    public const EXHAUSTED = 'azure_translator.exhausted';

    /** Безкоштовний тариф F0 — символів на календарний місяць. */
    public const FREE_LIMIT = 2000000;

    /** Лічильник символів за місяць (+ рік-місяць). Azure не віддає витрату за ключем, тож рахуємо самі. */
    public const USAGE = 'azure_translator.chars.';

    /** Скільки разів повторити запит після 429 (забагато символів за хвилину на F0). */
    public const RETRIES = 4;

    /** Чому останній запит не вдався — для повідомлення в Адмінці → Мови. */
    public ?string $lastError = null;

    public function __construct(private readonly SiteSettings $settings) {}

    private function key(): ?string
    {
        $key = $this->settings->secret('azure_translator_key') ?? config('services.azure_translator.key');

        return is_string($key) && trim($key) !== '' ? trim($key) : null;
    }

    /** Регіон ресурсу (westeurope, global…); порожньо — global. */
    public function region(): ?string
    {
        $region = $this->settings->get('azure_translator_region') ?: config('services.azure_translator.region');

        return is_string($region) && trim($region) !== '' ? strtolower(trim($region)) : null;
    }

    public function configured(): bool
    {
        return $this->key() !== null;
    }

    /** Ключ є й місячну квоту не вичерпано. */
    public function available(): bool
    {
        return $this->configured() && ! $this->exhausted();
    }

    /**
     * Ліміт вичерпано: Azure відповів 403001 або лічильник сайту дійшов до 2 млн — тоді Azure
     * пропускаємо до нового місяця, а без інших перекладачів кнопка «Перекласти» ховається сама.
     */
    public function exhausted(): bool
    {
        return Cache::get(self::EXHAUSTED) !== null || $this->usage()['used'] >= self::FREE_LIMIT;
    }

    public function markExhausted(): void
    {
        Cache::put(self::EXHAUSTED, now()->toIso8601String(), now()->addMonthNoOverflow()->startOfMonth());
    }

    public function clearExhausted(): void
    {
        Cache::forget(self::EXHAUSTED);
    }

    /**
     * Витрата цього місяця за підрахунком сайту (Azure рахує символи тексту з пробілами).
     *
     * @return array{used: int, limit: int, resets_at: string}
     */
    public function usage(): array
    {
        return [
            'used' => (int) Cache::get(self::USAGE.now()->format('Y-m'), 0),
            'limit' => self::FREE_LIMIT,
            'resets_at' => now()->addMonthNoOverflow()->startOfMonth()->toIso8601String(),
        ];
    }

    private function record(int $chars): void
    {
        $key = self::USAGE.now()->format('Y-m');
        Cache::add($key, 0, now()->addDays(40));
        Cache::increment($key, $chars);
    }

    /** Кнопка «Перевірити»: короткий переклад. Успіх знімає позначку «вичерпано». */
    public function test(): bool
    {
        if (! $this->configured()) {
            return false;
        }
        $this->clearExhausted();

        return $this->translate(['Привіт'], 'en', 'uk') !== null;
    }

    /** Код Azure для нашої мови: zh → zh-Hans / zh-Hant, pt-PT → pt-pt, no → nb. */
    public function target(string $locale): ?string
    {
        $primary = Locales::primary($locale);
        if ($primary === '') {
            return null;
        }
        $upper = strtoupper($locale);

        return match (true) {
            $primary === 'zh' => (str_contains($upper, 'HANT') || str_ends_with($upper, '-TW') || str_ends_with($upper, '-HK')) ? 'zh-Hant' : 'zh-Hans',
            $primary === 'pt' => str_ends_with($upper, '-PT') ? 'pt-pt' : 'pt',
            in_array($primary, ['nb', 'no', 'nn'], true) => 'nb',
            $primary === 'sr' => str_contains($upper, 'LATN') ? 'sr-Latn' : 'sr-Cyrl',
            default => $primary,
        };
    }

    /**
     * Текст користувача (мова — автоматично). source — основний код мови (en, pt, zh).
     *
     * @return array{text: string, source: string}|null
     */
    public function content(string $text, string $target): ?array
    {
        // Кнопка «Перекласти»: на 429 одна коротка повторна спроба, людина чекає відповіді.
        $rows = $this->translate([$text], $target, retries: 1, maxWait: 5);
        if ($rows === null) {
            return null;
        }

        return ['text' => $rows[0]['text'], 'source' => strtolower(explode('-', $rows[0]['source'] ?? '')[0])];
    }

    /**
     * Переклад інтерфейсу з української. Підстановки {0}, {name}, :attribute — у
     * <span class="notranslate"> (HTML-режим Azure їх не чіпає) і повертаються як були.
     *
     * @param  list<string>  $texts
     * @return list<string>|null
     */
    public function interface(array $texts, string $target): ?array
    {
        $out = [];
        foreach ($this->chunks(array_map(fn (string $t) => $this->protect($t), $texts)) as $chunk) {
            $rows = $this->translate($chunk, $target, 'uk', true, retries: self::RETRIES, maxWait: 30);
            if ($rows === null) {
                return null;
            }
            foreach ($rows as $row) {
                $out[] = $this->restore($row['text']);
            }
        }

        return $out;
    }

    /**
     * @param  list<string>  $texts
     * @return list<list<string>>
     */
    private function chunks(array $texts): array
    {
        $chunks = [];
        $chunk = [];
        $chars = 0;
        foreach ($texts as $text) {
            $len = mb_strlen($text);
            if ($chunk !== [] && (count($chunk) >= self::BATCH || $chars + $len > self::MAX_CHARS)) {
                $chunks[] = $chunk;
                $chunk = [];
                $chars = 0;
            }
            $chunk[] = $text;
            $chars += $len;
        }
        if ($chunk !== []) {
            $chunks[] = $chunk;
        }

        return $chunks;
    }

    /**
     * @param  list<string>  $texts
     * @return list<array{text: string, source: string|null}>|null
     */
    private function translate(array $texts, string $target, ?string $source = null, bool $html = false, int $retries = 0, int $maxWait = 0): ?array
    {
        $this->lastError = null;
        $key = $this->key();
        if ($key === null || $texts === []) {
            return null;
        }
        $query = array_filter(['api-version' => '3.0', 'to' => $target, 'from' => $source, 'textType' => $html ? 'html' : null]);
        $headers = array_filter(['Ocp-Apim-Subscription-Key' => $key, 'Ocp-Apim-Subscription-Region' => $this->region()]);
        // Автопереклад мови шле багато запитів поспіль: на 429 чекаємо (Retry-After, до 30 с) і пробуємо ще.
        for ($attempt = 0; ; $attempt++) {
            try {
                $response = Http::timeout(60)->connectTimeout(5)->acceptJson()->withHeaders($headers)
                    ->asJson()->post(self::ENDPOINT.'/translate?'.http_build_query($query), array_map(fn (string $t) => ['Text' => $t], $texts));
            } catch (ConnectionException) {
                $this->lastError = 'не відповів';

                return null;
            }
            if ($response->status() !== 429 || $attempt >= $retries) {
                break;
            }
            Sleep::for(min($maxWait, max(2, (int) $response->header('Retry-After') ?: 10 * ($attempt + 1))))->seconds();
        }
        if (! $response->successful()) {
            $code = (int) $response->json('error.code');
            // Лише 403001 — справді вичерпано безкоштовну квоту; інші 403 не вимикають Azure на місяць.
            if ($code === 403001) {
                $this->markExhausted();
            }
            $this->lastError = match (true) {
                $code === 403001 => 'вичерпано місячний ліміт',
                $response->status() === 401 => 'ключ відхилено (перевірте ключ і регіон)',
                $response->status() === 429 => 'забагато запитів — спробуйте за кілька хвилин',
                $response->status() === 400 => 'не знає цієї мови',
                default => 'помилка '.$response->status(),
            };
            $message = $response->json('error.message');
            Log::warning('translate: azure failed', ['status' => $response->status(), 'code' => $code, 'message' => is_string($message) ? mb_substr($message, 0, 200) : null]);

            return null;
        }
        $rows = $response->json();
        if (! is_array($rows) || count($rows) !== count($texts)) {
            $this->lastError = 'незрозуміла відповідь';

            return null;
        }
        $this->record(array_sum(array_map('mb_strlen', $texts)));
        $out = [];
        foreach ($rows as $row) {
            $text = is_array($row) && is_array($row['translations'][0] ?? null) ? ($row['translations'][0]['text'] ?? null) : null;
            if (! is_string($text)) {
                return null;
            }
            $detected = is_array($row['detectedLanguage'] ?? null) ? ($row['detectedLanguage']['language'] ?? null) : null;
            $out[] = ['text' => $text, 'source' => is_string($detected) ? $detected : $source];
        }

        return $out;
    }

    private function protect(string $text): string
    {
        $escaped = htmlspecialchars($text, ENT_NOQUOTES | ENT_HTML5, 'UTF-8');

        return (string) preg_replace('/(\{\w+\}|:[a-z_]+\b)/u', '<span class="notranslate">$1</span>', $escaped);
    }

    private function restore(string $text): string
    {
        $plain = (string) preg_replace('#<span class="notranslate">\s*(.*?)\s*</span>#u', '$1', $text);

        return html_entity_decode(strip_tags($plain), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }
}
