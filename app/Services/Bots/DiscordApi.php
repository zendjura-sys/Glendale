<?php

namespace App\Services\Bots;

use App\Support\Settings\SiteSettings;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Throwable;

/** REST API Discord для бота GameCon: повідомлення з кнопками, канали, ролі, перевірка інтеракцій. */
class DiscordApi
{
    /** Боту потрібні: надсилати повідомлення, вбудовувати посилання, керувати ролями, бачити канали. */
    public const PERMISSIONS = 2048 | 16384 | 268435456 | 1024 | 8589934592;

    public function __construct(private readonly SiteSettings $settings) {}

    public function token(): ?string
    {
        $value = $this->settings->secret('discord_bot_token') ?? config('services.discord.bot_token');

        return is_string($value) && $value !== '' ? $value : null;
    }

    public function clientId(): ?string
    {
        $value = $this->settings->get('discord_client_id') ?: config('services.discord.client_id');

        return is_string($value) && $value !== '' ? $value : null;
    }

    public function publicKey(): ?string
    {
        $value = $this->settings->get('discord_public_key') ?: config('services.discord.public_key');

        return is_string($value) && preg_match('/^[0-9a-f]{64}$/i', $value) === 1 ? strtolower($value) : null;
    }

    public function configured(): bool
    {
        return $this->token() !== null && $this->clientId() !== null;
    }

    /** Посилання «Додати бота на сервер»: після згоди Discord поверне guild_id на наш callback. */
    public function inviteUrl(string $state, string $redirect): ?string
    {
        $clientId = $this->clientId();

        return $clientId ? 'https://discord.com/oauth2/authorize?'.http_build_query([
            'client_id' => $clientId,
            'scope' => 'bot',
            'permissions' => self::PERMISSIONS,
            'response_type' => 'code',
            'redirect_uri' => $redirect,
            'state' => $state,
        ]) : null;
    }

    /**
     * Обмін коду з callback на сервер, куди справді додали бота (guild_id з адреси не довіряємо).
     *
     * @return array{id: string, name: string}|null
     */
    public function guildFromCode(string $code, string $redirect): ?array
    {
        $secret = $this->settings->secret('discord_client_secret') ?? config('services.discord.client_secret');
        if (! is_string($secret) || $this->clientId() === null) {
            return null;
        }
        try {
            $response = Http::asForm()->timeout(10)->post($this->api().'/v10/oauth2/token', [
                'client_id' => $this->clientId(),
                'client_secret' => $secret,
                'grant_type' => 'authorization_code',
                'code' => $code,
                'redirect_uri' => $redirect,
            ]);
        } catch (Throwable) {
            return null;
        }
        $guild = $response->json('guild');

        return is_array($guild) && isset($guild['id']) ? ['id' => (string) $guild['id'], 'name' => (string) ($guild['name'] ?? '')] : null;
    }

    /**
     * Текстові канали сервера, куди бот може писати.
     *
     * @return list<array{id: string, name: string}>
     */
    public function channels(string $guild): array
    {
        $rows = $this->request('get', "/guilds/{$guild}/channels")?->json();

        return is_array($rows) ? array_values(array_map(
            fn (array $c) => ['id' => (string) $c['id'], 'name' => '#'.$c['name']],
            array_filter($rows, fn ($c) => is_array($c) && in_array($c['type'] ?? null, [0, 5], true)),
        )) : [];
    }

    /**
     * Ролі сервера (крім @everyone і ролей інших ботів).
     *
     * @return list<array{id: string, name: string}>
     */
    public function roles(string $guild): array
    {
        $rows = $this->request('get', "/guilds/{$guild}/roles")?->json();

        return is_array($rows) ? array_values(array_map(
            fn (array $r) => ['id' => (string) $r['id'], 'name' => (string) $r['name']],
            array_filter($rows, fn ($r) => is_array($r) && ($r['name'] ?? '') !== '@everyone' && empty($r['managed'])),
        )) : [];
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function send(string $channel, array $payload): ?string
    {
        $id = $this->request('post', "/channels/{$channel}/messages", $payload)?->json('id');

        return is_string($id) ? $id : null;
    }

    /**
     * Додаткова відповідь на кнопку (наприклад, «лише вам» після оновлення картки).
     *
     * @param  array<string, mixed>  $payload
     */
    public function followup(string $interactionToken, array $payload): void
    {
        $clientId = $this->clientId();
        if ($clientId === null) {
            return;
        }
        try {
            Http::timeout(10)->post($this->api()."/v10/webhooks/{$clientId}/{$interactionToken}", $payload);
        } catch (Throwable) {
            // Відповідь на кнопку вже надіслано — додаткова лише бонус.
        }
    }

    public function setRole(string $method, string $guild, string $user, string $role): int
    {
        return $this->request($method, "/guilds/{$guild}/members/{$user}/roles/{$role}", null, ['X-Audit-Log-Reason' => 'GameCon'])?->status() ?? 0;
    }

    public function leave(string $guild): void
    {
        $this->request('delete', "/users/@me/guilds/{$guild}");
    }

    /** Підпис інтеракції (Ed25519): без нього Discord-запит не приймаємо. */
    public function verify(string $signature, string $timestamp, string $body): bool
    {
        $key = $this->publicKey();
        if ($key === null || preg_match('/^[0-9a-f]{128}$/i', $signature) !== 1 || abs(time() - (int) $timestamp) > 300) {
            return false;
        }

        try {
            $sig = hex2bin($signature);
            $pub = hex2bin($key);

            return $sig !== false && $pub !== false && $sig !== '' && $pub !== '' && sodium_crypto_sign_verify_detached($sig, $timestamp.$body, $pub);
        } catch (Throwable) {
            return false;
        }
    }

    /**
     * @param  array<string, mixed>|null  $payload
     * @param  array<string, string>  $headers
     */
    private function request(string $method, string $path, ?array $payload = null, array $headers = []): ?Response
    {
        $token = $this->token();
        if ($token === null) {
            return null;
        }
        try {
            $request = Http::withHeaders(['Authorization' => 'Bot '.$token, ...$headers])->timeout(10);

            return $payload === null ? $request->send(strtoupper($method), $this->api().'/v10'.$path) : $request->{$method}($this->api().'/v10'.$path, $payload);
        } catch (Throwable) {
            return null;
        }
    }

    private function api(): string
    {
        return rtrim((string) config('services.discord.api_url', 'https://discord.com/api'), '/');
    }
}
