<?php

namespace App\Services\I18n;

use App\Support\I18n\Locales;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Машинний переклад DeepL: інтерфейс (з української) і тексти користувачів (кнопка «Перекласти»).
 * Підстановки {0}, {name}, :attribute беремо в теги, які DeepL не чіпає.
 */
class DeepL
{
    /** Мови перекладу DeepL (на випадок, якщо список не вдалося отримати). */
    public const TARGETS = ['AR', 'BG', 'CS', 'DA', 'DE', 'EL', 'EN-GB', 'EN-US', 'ES', 'ES-419', 'ET', 'FI', 'FR', 'HE', 'HU', 'ID', 'IT', 'JA', 'KO', 'LT', 'LV', 'NB', 'NL', 'PL', 'PT-BR', 'PT-PT', 'RO', 'RU', 'SK', 'SL', 'SV', 'TH', 'TR', 'UK', 'VI', 'ZH-HANS', 'ZH-HANT'];

    /** Скільки рядків в одному запиті (обмеження DeepL — 50). */
    public const BATCH = 50;

    private const CONTEXT = 'User interface of GameCon, a social network for gamers: GTA RP servers, role-play families, clans, friends, chats, music and movies.';

    public function __construct(private readonly SiteSettings $settings) {}

    public function key(): ?string
    {
        $key = $this->settings->secret('deepl_key') ?? config('services.deepl.key');

        return is_string($key) && $key !== '' ? $key : null;
    }

    public function configured(): bool
    {
        return $this->key() !== null;
    }

    /** Безкоштовні ключі закінчуються на «:fx» і мають окрему адресу API. */
    private function url(string $path): string
    {
        $base = config('services.deepl.url') ?: (str_ends_with((string) $this->key(), ':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com');

        return rtrim((string) $base, '/').$path;
    }

    /**
     * Код мови DeepL для нашої мови: «en» → EN-US, «pt-BR» → PT-BR, «zh-Hant» → ZH-HANT. Немає — null.
     */
    public function target(string $locale): ?string
    {
        $primary = Locales::primary($locale);
        $upper = strtoupper($locale);
        $code = match (true) {
            $primary === 'en' => str_ends_with($upper, '-GB') ? 'EN-GB' : 'EN-US',
            $primary === 'pt' => str_ends_with($upper, '-BR') ? 'PT-BR' : 'PT-PT',
            $primary === 'zh' => (str_contains($upper, 'HANT') || str_ends_with($upper, '-TW') || str_ends_with($upper, '-HK')) ? 'ZH-HANT' : 'ZH-HANS',
            $primary === 'es' => str_ends_with($upper, '-419') ? 'ES-419' : 'ES',
            in_array($primary, ['nb', 'no', 'nn'], true) => 'NB',
            default => strtoupper($primary),
        };

        return in_array($code, $this->targets(), true) ? $code : null;
    }

    /**
     * @return list<string>
     */
    public function targets(): array
    {
        if (! $this->configured()) {
            return self::TARGETS;
        }

        $cached = Cache::remember('deepl.targets', now()->addDay(), function () {
            $rows = $this->request('get', '/v2/languages', ['type' => 'target']);
            $codes = [];
            foreach (is_array($rows) ? $rows : [] as $row) {
                if (is_array($row) && is_string($row['language'] ?? null)) {
                    $codes[] = strtoupper($row['language']);
                }
            }

            return $codes === [] ? self::TARGETS : array_values(array_unique([...$codes, 'ZH-HANS', 'ZH-HANT']));
        });

        return is_array($cached) ? array_values(array_map('strval', $cached)) : self::TARGETS;
    }

    /**
     * Скільки символів використано й ліміт за місяць.
     *
     * @return array{used: int, limit: int}|null
     */
    public function usage(): ?array
    {
        $data = $this->request('get', '/v2/usage', []);

        return is_array($data) && isset($data['character_count'], $data['character_limit'])
            ? ['used' => (int) $data['character_count'], 'limit' => (int) $data['character_limit']]
            : null;
    }

    public function test(): bool
    {
        return $this->usage() !== null;
    }

    /**
     * Переклад інтерфейсу: з української, з підстановками. Порядок і кількість — як у вхідному списку.
     *
     * @param  list<string>  $texts
     * @return list<string>|null null — DeepL недоступний або ліміт вичерпано
     */
    public function interface(array $texts, string $target): ?array
    {
        $out = [];
        foreach (array_chunk($texts, self::BATCH) as $chunk) {
            $wrapped = array_map(fn (string $t) => $this->protect($t), $chunk);
            $result = $this->translate($wrapped, $target, 'UK', true);
            if ($result === null) {
                return null;
            }
            foreach ($result as $text) {
                $out[] = $this->restore($text);
            }
        }

        return $out;
    }

    /**
     * Переклад тексту користувача (мова визначається автоматично).
     *
     * @return array{text: string, source: string}|null
     */
    public function content(string $text, string $target): ?array
    {
        $data = $this->request('post', '/v2/translate', ['text' => [$text], 'target_lang' => $target]);
        $row = is_array($data) && is_array($data['translations'][0] ?? null) ? $data['translations'][0] : null;

        return $row === null ? null : ['text' => (string) ($row['text'] ?? ''), 'source' => strtolower((string) ($row['detected_source_language'] ?? ''))];
    }

    /**
     * @param  list<string>  $texts
     * @return list<string>|null
     */
    private function translate(array $texts, string $target, string $source, bool $xml): ?array
    {
        $body = [
            'text' => $texts,
            'source_lang' => $source,
            'target_lang' => $target,
            'context' => self::CONTEXT,
            // Сайт звертається на «ти» — неформально, де мова це підтримує.
            'formality' => 'prefer_less',
        ];
        if ($xml) {
            $body['tag_handling'] = 'xml';
            $body['ignore_tags'] = ['x'];
        }
        $data = $this->request('post', '/v2/translate', $body);
        $rows = is_array($data) && is_array($data['translations'] ?? null) ? $data['translations'] : null;
        if ($rows === null || count($rows) !== count($texts)) {
            return null;
        }

        return array_values(array_map(fn ($row) => is_array($row) ? (string) ($row['text'] ?? '') : '', $rows));
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function request(string $method, string $path, array $payload): mixed
    {
        $key = $this->key();
        if ($key === null) {
            return null;
        }
        try {
            $client = Http::timeout(60)->acceptJson()->withHeaders(['Authorization' => 'DeepL-Auth-Key '.$key]);
            $response = $method === 'get' ? $client->get($this->url($path), $payload) : $client->asJson()->post($this->url($path), $payload);
        } catch (ConnectionException) {
            return null;
        }

        return $response->successful() ? $response->json() : null;
    }

    /** XML для DeepL: екрануємо текст, підстановки — у <x>…</x>. */
    private function protect(string $text): string
    {
        $escaped = htmlspecialchars($text, ENT_NOQUOTES | ENT_XML1, 'UTF-8');

        return (string) preg_replace('/(\{\w+\}|:[a-z_]+\b)/u', '<x>$1</x>', $escaped);
    }

    private function restore(string $text): string
    {
        return htmlspecialchars_decode((string) preg_replace('#</?x>#', '', $text), ENT_NOQUOTES | ENT_XML1);
    }
}
