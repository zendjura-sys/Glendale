<?php

namespace App\Services\Ai;

use App\Support\Settings\SiteSettings;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * ШІ з власним ключем сайту: Claude (Anthropic Messages API) або будь-який OpenAI-сумісний сервіс
 * (OpenAI, OpenRouter, Groq, локальна модель). Провайдер, ключ і модель — в адмінці «Інтеграції».
 * Короткі завдання: переписати текст, підсумок чату, опис, оцінка скарги, відповіді бота.
 */
class AiClient
{
    public const ANTHROPIC = 'anthropic';

    public const OPENAI = 'openai';

    /** Модель Claude за замовчуванням; адмін може вказати іншу. */
    public const DEFAULT_CLAUDE = 'claude-opus-5-5';

    public const DEFAULT_OPENAI = 'gpt-4o-mini';

    private const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

    private const ANTHROPIC_VERSION = '2026-10-21';

    /** Серверний запасний варіант Claude: якщо модель відмовить, той самий запит виконає рекомендована модель. */
    private const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

    /** Моделі Claude, що приймають fallbacks: "default" на Claude API. */
    private const FALLBACK_MODELS = ['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5'];

    public function __construct(private readonly SiteSettings $settings) {}

    public function configured(): bool
    {
        return $this->settings->secret('ai_key') !== null;
    }

    public function provider(): string
    {
        return $this->settings->get('ai_provider') === self::OPENAI ? self::OPENAI : self::ANTHROPIC;
    }

    public function model(): string
    {
        $model = trim((string) $this->settings->get('ai_model'));

        return $model !== '' ? $model : ($this->provider() === self::OPENAI ? self::DEFAULT_OPENAI : self::DEFAULT_CLAUDE);
    }

    /**
     * Один запит до моделі. Повертає текст відповіді.
     *
     * @param  list<array{role: 'user'|'assistant', content: string}>  $messages
     * @param  list<array{mime: string, data: string}>  $images  Картинки до останнього повідомлення (base64).
     *
     * @throws AiException
     */
    public function complete(string $system, array $messages, int $maxTokens = 1024, array $images = []): string
    {
        $key = $this->settings->secret('ai_key');
        if ($key === null) {
            throw new AiException('ШІ не підключено: адміністрація ще не додала ключ.');
        }
        try {
            $text = $this->provider() === self::OPENAI
                ? $this->openai($key, $system, $messages, $maxTokens, $images)
                : $this->anthropic($key, $system, $messages, $maxTokens, $images);
        } catch (ConnectionException) {
            throw new AiException('ШІ зараз недоступний. Спробуйте трохи пізніше.');
        }
        Cache::increment('ai.requests.'.now()->format('Y-m-d'));

        return trim($text);
    }

    /** Перевірка ключа з адмінки. */
    public function test(): bool
    {
        try {
            return $this->complete('Answer with one word.', [['role' => 'user', 'content' => 'Say "ok".']], 32) !== '';
        } catch (AiException) {
            return false;
        }
    }

    /** Скільки запитів до ШІ сьогодні (для картки в адмінці). */
    public function today(): int
    {
        return (int) Cache::get('ai.requests.'.now()->format('Y-m-d'), 0);
    }

    /**
     * @param  list<array{role: 'user'|'assistant', content: string}>  $messages
     * @param  list<array{mime: string, data: string}>  $images
     */
    private function anthropic(string $key, string $system, array $messages, int $maxTokens, array $images): string
    {
        $model = $this->model();
        $payload = [
            'model' => $model,
            'max_tokens' => $maxTokens,
            'system' => $system,
            'messages' => $this->withImages($messages, $images, fn (array $image) => [
                'type' => 'image',
                'source' => ['type' => 'base64', 'media_type' => $image['mime'], 'data' => $image['data']],
            ]),
        ];
        // Короткі завдання — мало роздумів (у моделей Claude 5 це регулюється effort).
        if (preg_match('/^claude-(opus|sonnet|haiku|fable)-5/', $model) === 1) {
            $payload['output_config'] = ['effort' => 'low'];
        }
        $headers = [
            'x-api-key' => $key,
            'anthropic-version' => self::ANTHROPIC_VERSION,
        ];
        if (in_array($model, self::FALLBACK_MODELS, true)) {
            $payload['fallbacks'] = 'default';
            $headers['anthropic-beta'] = self::FALLBACK_BETA;
        }

        $response = Http::withHeaders($headers)->acceptJson()->timeout(60)->post(self::ANTHROPIC_URL, $payload);
        $this->failOn($response);
        if ($response->json('stop_reason') === 'refusal') {
            throw new AiException('ШІ відмовився відповідати на цей запит.');
        }

        return collect((array) $response->json('content'))
            ->filter(fn ($block) => is_array($block) && ($block['type'] ?? null) === 'text')
            ->map(fn (array $block) => (string) ($block['text'] ?? ''))
            ->implode("\n");
    }

    /**
     * @param  list<array{role: 'user'|'assistant', content: string}>  $messages
     * @param  list<array{mime: string, data: string}>  $images
     */
    private function openai(string $key, string $system, array $messages, int $maxTokens, array $images): string
    {
        $base = rtrim((string) ($this->settings->get('ai_base_url') ?: 'https://api.openai.com/v1'), '/');
        $response = Http::withToken($key)->acceptJson()->timeout(60)->post($base.'/chat/completions', [
            'model' => $this->model(),
            'max_tokens' => $maxTokens,
            'messages' => [
                ['role' => 'system', 'content' => $system],
                ...$this->withImages($messages, $images, fn (array $image) => [
                    'type' => 'image_url',
                    'image_url' => ['url' => 'data:'.$image['mime'].';base64,'.$image['data']],
                ]),
            ],
        ]);
        $this->failOn($response);

        return (string) $response->json('choices.0.message.content', '');
    }

    /**
     * Картинки йдуть разом із текстом останнього повідомлення.
     *
     * @param  list<array{role: 'user'|'assistant', content: string}>  $messages
     * @param  list<array{mime: string, data: string}>  $images
     * @param  callable(array{mime: string, data: string}): array<string, mixed>  $block
     * @return list<array<string, mixed>>
     */
    private function withImages(array $messages, array $images, callable $block): array
    {
        if ($images === [] || $messages === []) {
            return $messages;
        }
        $last = array_pop($messages);
        $messages[] = [
            'role' => $last['role'],
            'content' => [...array_map($block, $images), ['type' => 'text', 'text' => $last['content']]],
        ];

        return $messages;
    }

    private function failOn(Response $response): void
    {
        if ($response->successful()) {
            return;
        }
        throw new AiException(match (true) {
            in_array($response->status(), [401, 403], true) => 'ШІ відхилив ключ. Перевірте його в адмінці.',
            $response->status() === 429 => 'ШІ перевантажений або вичерпано ліміт. Спробуйте за хвилину.',
            $response->status() >= 500 => 'ШІ зараз недоступний. Спробуйте трохи пізніше.',
            default => 'ШІ не зміг обробити запит.',
        }, $response->status());
    }
}
