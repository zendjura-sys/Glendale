<?php

namespace App\Services\Auth;

use App\Support\Settings\SiteSettings;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

class DiscordOAuth
{
    public const SCOPES = ['identify', 'email'];

    public function __construct(private readonly SiteSettings $settings) {}

    public function clientId(): ?string
    {
        return $this->settings->get('discord_client_id') ?: config('services.discord.client_id');
    }

    public function clientSecret(): ?string
    {
        return $this->settings->secret('discord_client_secret') ?: config('services.discord.client_secret');
    }

    public function configured(): bool
    {
        return filled($this->clientId()) && filled($this->clientSecret());
    }

    public function redirectUri(): string
    {
        return config('services.discord.redirect') ?: route('auth.discord.callback');
    }

    public function authorizeUrl(string $state): string
    {
        return config('services.discord.authorize_url').'?'.http_build_query([
            'client_id' => $this->clientId(),
            'redirect_uri' => $this->redirectUri(),
            'response_type' => 'code',
            'scope' => implode(' ', self::SCOPES),
            'state' => $state,
            'prompt' => 'consent',
        ]);
    }

    public function profile(string $code): SocialProfile
    {
        try {
            $token = Http::asForm()->acceptJson()->timeout(10)
                ->post($this->api('/oauth2/token'), [
                    'client_id' => $this->clientId(),
                    'client_secret' => $this->clientSecret(),
                    'grant_type' => 'authorization_code',
                    'code' => $code,
                    'redirect_uri' => $this->redirectUri(),
                ]);

            if (! $token->successful() || blank($token->json('access_token'))) {
                throw new SocialAuthException('Discord відхилив вхід. Спробуйте ще раз.');
            }

            $me = Http::withToken((string) $token->json('access_token'))->acceptJson()->timeout(10)->get($this->api('/users/@me'));
        } catch (ConnectionException) {
            throw new SocialAuthException('Discord не відповідає. Спробуйте пізніше.');
        }

        if (! $me->successful() || blank($me->json('id'))) {
            throw new SocialAuthException('Не вдалося отримати профіль Discord.');
        }

        $id = (string) $me->json('id');
        $avatar = $me->json('avatar');

        return new SocialProfile(
            provider: 'discord',
            id: $id,
            email: $me->json('email') ? mb_strtolower((string) $me->json('email')) : null,
            emailVerified: (bool) $me->json('verified'),
            name: (string) ($me->json('global_name') ?: $me->json('username')),
            handle: (string) $me->json('username'),
            avatarUrl: $avatar ? "https://cdn.discordapp.com/avatars/{$id}/{$avatar}.png?size=512" : null,
        );
    }

    /**
     * Перевірка ключів через client_credentials — не потребує користувача.
     */
    public function testCredentials(): bool
    {
        try {
            return Http::asForm()->withBasicAuth((string) $this->clientId(), (string) $this->clientSecret())->timeout(10)
                ->post($this->api('/oauth2/token'), ['grant_type' => 'client_credentials', 'scope' => 'identify'])
                ->successful();
        } catch (ConnectionException) {
            return false;
        }
    }

    private function api(string $path): string
    {
        return rtrim((string) config('services.discord.api_url'), '/').$path;
    }
}
