<?php

namespace App\Services\Ai;

use App\Models\MessageAttachment;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

/**
 * Розшифровка голосових повідомлень: будь-який OpenAI-сумісний /audio/transcriptions (OpenAI Whisper, Groq).
 * Свій ключ в «Інтеграціях» або той самий, що в «ШІ» (OpenAI-сумісний): Claude аудіо не розпізнає. Текст зберігаємо в meta вкладення — повторно не платимо.
 */
class SpeechToText
{
    public const DEFAULT_BASE = 'https://api.openai.com/v1';

    public const DEFAULT_MODEL = 'whisper-1';

    /** Довше не розшифровуємо — це вже не голосове, а подкаст. */
    public const MAX_SECONDS = 600;

    public function __construct(private readonly SiteSettings $settings) {}

    /** Модель Groq за замовчуванням (коли розшифровка йде через ключ Groq). */
    public const GROQ_MODEL = 'whisper-large-v3';

    public function configured(): bool
    {
        return $this->key() !== null;
    }

    /**
     * Свій ключ розшифровки, а без нього — ключ «ШІ», якщо там OpenAI-сумісний сервіс (Groq, OpenAI, OpenRouter):
     * один ключ на текст і голос.
     */
    public function key(): ?string
    {
        return $this->settings->secret('stt_key') ?? ($this->sharesAiKey() ? $this->settings->secret('ai_key') : null);
    }

    public function sharesAiKey(): bool
    {
        return $this->settings->secret('stt_key') === null && $this->settings->get('ai_provider') === AiClient::OPENAI;
    }

    public function base(): string
    {
        $own = trim((string) $this->settings->get('stt_base_url'));
        $ai = $this->sharesAiKey() ? trim((string) $this->settings->get('ai_base_url')) : '';

        return rtrim($own !== '' ? $own : ($ai !== '' ? $ai : self::DEFAULT_BASE), '/');
    }

    public function model(): string
    {
        $model = trim((string) $this->settings->get('stt_model'));

        return $model !== '' ? $model : (str_contains($this->base(), 'groq.com') ? self::GROQ_MODEL : self::DEFAULT_MODEL);
    }

    /** @throws AiException */
    public function transcribe(MessageAttachment $attachment): string
    {
        if (is_string($attachment->meta['transcript'] ?? null)) {
            return $attachment->meta['transcript'];
        }
        $key = $this->key();
        if ($key === null) {
            throw new AiException('Розшифровку ще не підключено: адміністрація не додала ключ.');
        }
        if (($attachment->duration ?? 0) > self::MAX_SECONDS) {
            throw new AiException('Запис задовгий для розшифровки.');
        }
        $disk = Storage::disk($attachment->disk);
        if (! $disk->exists($attachment->path)) {
            throw new AiException('Файл голосового не знайдено.');
        }
        $base = $this->base();
        try {
            $response = Http::withToken($key)->timeout(90)
                ->attach('file', (string) $disk->get($attachment->path), basename($attachment->path))
                ->post($base.'/audio/transcriptions', ['model' => $this->model(), 'response_format' => 'json']);
        } catch (ConnectionException) {
            throw new AiException('Сервіс розшифровки зараз недоступний.');
        }
        if (! $response->successful()) {
            throw new AiException(in_array($response->status(), [401, 403], true) ? 'Сервіс розшифровки відхилив ключ.' : 'Не вдалося розшифрувати запис.', $response->status());
        }
        $text = trim((string) $response->json('text', ''));
        $attachment->forceFill(['meta' => [...($attachment->meta ?? []), 'transcript' => $text]])->save();
        Cache::increment('stt.requests.'.now()->format('Y-m-d'));

        return $text;
    }

    public function today(): int
    {
        return (int) Cache::get('stt.requests.'.now()->format('Y-m-d'), 0);
    }
}
