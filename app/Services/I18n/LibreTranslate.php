<?php

namespace App\Services\I18n;

use App\Support\I18n\Locales;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * LibreTranslate — безкоштовний перекладач без ліміту символів, що працює на нашому ж сервері
 * (deploy/libretranslate.sh, http://127.0.0.1:5000). Запасний варіант, коли DeepL вичерпав
 * місячний ліміт або не відповідає. Якість нижча за DeepL, але тексти не губляться.
 *
 * API: POST /translate {q, source, target, format, api_key}, POST /detect {q}, GET /languages.
 */
class LibreTranslate
{
    /** Скільки рядків в одному запиті. */
    public const BATCH = 50;

    /**
     * Коди DeepL → коди LibreTranslate (у порядку переваги: різні версії LibreTranslate
     * називають бразильську португальську «pb» або «pt-BR», китайську — «zh» / «zh-Hans», «zt» / «zh-Hant»).
     *
     * @var array<string, list<string>>
     */
    public const FROM_DEEPL = [
        'EN-US' => ['en'], 'EN-GB' => ['en'],
        'PT-BR' => ['pb', 'pt-BR', 'pt'], 'PT-PT' => ['pt'],
        'ZH-HANS' => ['zh-Hans', 'zh'], 'ZH-HANT' => ['zh-Hant', 'zt'],
        'ES-419' => ['es'], 'NB' => ['nb'],
    ];

    /** Коди LibreTranslate → DeepL (решта — просто великими літерами). */
    public const TO_DEEPL = ['en' => 'EN-US', 'pb' => 'PT-BR', 'pt-BR' => 'PT-BR', 'pt' => 'PT-PT', 'zh' => 'ZH-HANS', 'zh-Hans' => 'ZH-HANS', 'zt' => 'ZH-HANT', 'zh-Hant' => 'ZH-HANT'];

    public function __construct(private readonly SiteSettings $settings) {}

    /** Адреса сервера; порожньо — вимкнено. */
    public function url(): ?string
    {
        $url = $this->settings->get('libretranslate_url') ?: config('services.libretranslate.url');

        return is_string($url) && trim($url) !== '' ? rtrim(trim($url), '/') : null;
    }

    public function configured(): bool
    {
        return $this->url() !== null;
    }

    private function key(): ?string
    {
        $key = $this->settings->secret('libretranslate_key') ?? config('services.libretranslate.key');

        return is_string($key) && $key !== '' ? $key : null;
    }

    /**
     * Чи сервер відповідає. Результат кешується (успіх — 10 хв, збій — 2 хв): викликається
     * на кожній сторінці (прапорець site.translate), а сервер може бути й не встановлений.
     */
    public function available(): bool
    {
        if (! $this->configured()) {
            return false;
        }

        return Cache::get('libretranslate.up') ?? $this->check();
    }

    /** Свіжа перевірка (кнопка «Перевірити» в адмінці). */
    public function check(): bool
    {
        Cache::forget('libretranslate.languages');
        $up = $this->languages() !== [];
        Cache::put('libretranslate.up', $up, $up ? now()->addMinutes(10) : now()->addMinutes(2));

        return $up;
    }

    public function test(): bool
    {
        return $this->check();
    }

    /**
     * Коди мов, які вміє сервер (на нього встановлені моделі, напр. --load-only uk,en,pl,de).
     *
     * @return list<string>
     */
    public function languages(): array
    {
        if (! $this->configured()) {
            return [];
        }
        $cached = Cache::get('libretranslate.languages');
        if (is_array($cached)) {
            return array_values(array_filter($cached, 'is_string'));
        }
        $rows = $this->request('get', '/languages', [], 5);
        $codes = [];
        foreach (is_array($rows) ? $rows : [] as $row) {
            if (is_array($row) && is_string($row['code'] ?? null)) {
                $codes[] = $row['code'];
            }
        }
        if ($codes !== []) {
            Cache::put('libretranslate.languages', $codes, now()->addHour());
        }

        return $codes;
    }

    /**
     * Можливі коди LibreTranslate для коду DeepL (EN-US → en, PT-BR → pb / pt-BR / pt).
     *
     * @return list<string>
     */
    public static function fromDeepL(string $code): array
    {
        $code = strtoupper($code);

        return self::FROM_DEEPL[$code] ?? [strtolower(explode('-', $code)[0])];
    }

    /** Код DeepL для коду LibreTranslate (pb → PT-BR, zt → ZH-HANT, de → DE). */
    public static function toDeepL(string $code): string
    {
        return self::TO_DEEPL[$code] ?? strtoupper($code);
    }

    /** Основний код мови (як Locales::primary) для коду LibreTranslate: pb → pt, zt → zh. */
    public static function primary(string $code): string
    {
        return strtolower(explode('-', self::toDeepL($code))[0]);
    }

    /**
     * Код LibreTranslate для нашої мови («en», «pt-BR», «zh-Hant»…), якщо сервер її знає. Немає — null.
     */
    public function target(string $locale): ?string
    {
        $primary = Locales::primary($locale);
        $upper = strtoupper($locale);
        $deepl = match (true) {
            $primary === 'pt' => str_ends_with($upper, '-BR') ? 'PT-BR' : 'PT-PT',
            $primary === 'zh' => (str_contains($upper, 'HANT') || str_ends_with($upper, '-TW') || str_ends_with($upper, '-HK')) ? 'ZH-HANT' : 'ZH-HANS',
            in_array($primary, ['nb', 'no', 'nn'], true) => 'NB',
            default => strtoupper($primary),
        };
        $known = $this->languages();
        foreach (self::fromDeepL($deepl) as $code) {
            if (in_array($code, $known, true)) {
                return $code;
            }
        }

        return null;
    }

    /**
     * Переклад одного чи кількох текстів. source null — визначити мову автоматично.
     *
     * @param  string|list<string>  $text
     * @return array{text: string|list<string>, source: string|null}|null
     */
    public function translate(string|array $text, string $target, ?string $source = null, bool $html = false): ?array
    {
        $data = $this->request('post', '/translate', [
            'q' => $text,
            'source' => $source ?? 'auto',
            'target' => $target,
            'format' => $html ? 'html' : 'text',
        ]);
        if (! is_array($data) || ! isset($data['translatedText'])) {
            return null;
        }
        $out = $data['translatedText'];
        if (is_array($text)) {
            if (! is_array($out) || count($out) !== count($text)) {
                return null;
            }
            $out = array_values(array_map(fn ($t) => is_string($t) ? $t : '', $out));
        } elseif (! is_string($out)) {
            return null;
        }
        $detected = $data['detectedLanguage'] ?? null;
        // Для кількох текстів detectedLanguage — список; беремо першу мову.
        if (is_array($detected) && array_is_list($detected)) {
            $detected = $detected[0] ?? null;
        }
        $lang = is_array($detected) && is_string($detected['language'] ?? null) ? $detected['language'] : $source;

        return ['text' => $out, 'source' => $lang];
    }

    /** Визначити мову тексту: код LibreTranslate або null. */
    public function detect(string $text): ?string
    {
        $rows = $this->request('post', '/detect', ['q' => $text]);
        $row = is_array($rows) && is_array($rows[0] ?? null) ? $rows[0] : null;

        return $row !== null && is_string($row['language'] ?? null) ? $row['language'] : null;
    }

    /**
     * Текст користувача (мова — автоматично). source — основний код мови (en, pt, zh).
     *
     * @return array{text: string, source: string}|null
     */
    public function content(string $text, string $target): ?array
    {
        $result = $this->translate($text, $target);
        if ($result === null || ! is_string($result['text'])) {
            return null;
        }

        return ['text' => $result['text'], 'source' => $result['source'] !== null ? self::primary($result['source']) : ''];
    }

    /**
     * Переклад інтерфейсу з української. Підстановки {0}, {name}, :attribute беремо в
     * <span translate="no"> (HTML-режим LibreTranslate їх не перекладає) і повертаємо як були.
     *
     * @param  list<string>  $texts
     * @return list<string>|null
     */
    public function interface(array $texts, string $target): ?array
    {
        $source = in_array('uk', $this->languages(), true) ? 'uk' : null;
        $out = [];
        foreach (array_chunk($texts, self::BATCH) as $chunk) {
            $wrapped = array_map(fn (string $t) => $this->protect($t), $chunk);
            $result = $this->translate($wrapped, $target, $source, true);
            if ($result === null || ! is_array($result['text'])) {
                return null;
            }
            foreach ($result['text'] as $text) {
                $out[] = $this->restore($text);
            }
        }

        return $out;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function request(string $method, string $path, array $payload, int $timeout = 60): mixed
    {
        $url = $this->url();
        if ($url === null) {
            return null;
        }
        if ($method !== 'get' && ($key = $this->key()) !== null) {
            $payload['api_key'] = $key;
        }
        try {
            $client = Http::timeout($timeout)->connectTimeout(3)->acceptJson();
            $response = $method === 'get' ? $client->get($url.$path, $payload) : $client->asJson()->post($url.$path, $payload);
        } catch (ConnectionException) {
            return null;
        }

        return $response->successful() ? $response->json() : null;
    }

    private function protect(string $text): string
    {
        $escaped = htmlspecialchars($text, ENT_NOQUOTES | ENT_HTML5, 'UTF-8');

        return (string) preg_replace('/(\{\w+\}|:[a-z_]+\b)/u', '<span translate="no">$1</span>', $escaped);
    }

    private function restore(string $text): string
    {
        $plain = (string) preg_replace('#<span translate="no">\s*(.*?)\s*</span>#u', '$1', $text);

        return html_entity_decode(strip_tags($plain), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }
}
