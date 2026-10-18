<?php

namespace App\Services\Bots;

use App\Support\Settings\SiteSettings;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

/** Клієнт Bot API Telegram для офіційного бота GameCon. Токен — у налаштуваннях адмінки. */
class TelegramApi
{
    public function __construct(private readonly SiteSettings $settings) {}

    public function token(): ?string
    {
        $value = $this->settings->secret('telegram_bot_token') ?? config('services.telegram.bot_token');

        return is_string($value) && $value !== '' ? $value : null;
    }

    public function configured(): bool
    {
        return $this->token() !== null && $this->username() !== null;
    }

    public function username(): ?string
    {
        $value = $this->settings->get('telegram_bot_username');

        return is_string($value) && $value !== '' ? ltrim($value, '@') : null;
    }

    /** Секрет вебхука: Telegram надсилає його в заголовку, так ми відрізняємо справжні оновлення. */
    public function webhookSecret(): string
    {
        $secret = $this->settings->secret('telegram_webhook_secret');
        if ($secret === null) {
            $secret = Str::random(48);
            $this->settings->putSecret('telegram_webhook_secret', $secret);
        }

        return $secret;
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>|null result або null, якщо Telegram відмовив
     */
    public function call(string $method, array $params = []): ?array
    {
        $token = $this->token();
        if ($token === null) {
            return null;
        }
        $base = rtrim((string) config('services.telegram.api_url', 'https://api.telegram.org'), '/');

        try {
            $response = Http::timeout(10)->asJson()->post("{$base}/bot{$token}/{$method}", $params);
        } catch (Throwable) {
            return null;
        }
        $json = $response->json();

        return is_array($json) && ($json['ok'] ?? false) === true ? (is_array($json['result'] ?? null) ? $json['result'] : ['value' => $json['result'] ?? true]) : null;
    }

    /** Перевіряє токен і запам’ятовує @username бота; вмикає вебхук на цей сайт. */
    public function connect(string $webhookUrl): ?string
    {
        $me = $this->call('getMe');
        if (! is_array($me) || ! isset($me['username'])) {
            return null;
        }
        $this->settings->put(['telegram_bot_username' => (string) $me['username']]);
        $this->call('setWebhook', [
            'url' => $webhookUrl,
            'secret_token' => $this->webhookSecret(),
            'allowed_updates' => ['message', 'callback_query', 'my_chat_member'],
            'drop_pending_updates' => true,
        ]);

        return (string) $me['username'];
    }

    public function groupLink(string $code): ?string
    {
        $bot = $this->username();

        return $bot ? "https://t.me/{$bot}?startgroup={$code}" : null;
    }

    public function privateLink(string $code): ?string
    {
        $bot = $this->username();

        return $bot ? "https://t.me/{$bot}?start={$code}" : null;
    }
}
