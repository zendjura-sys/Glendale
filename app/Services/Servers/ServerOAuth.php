<?php

namespace App\Services\Servers;

use App\Models\FamilyMember;
use App\Models\GtaServer;
use App\Models\OAuthClient;
use App\Models\OAuthCode;
use App\Models\OAuthToken;
use App\Models\RpCharacter;
use App\Models\ServerPlayer;
use App\Models\User;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * «Увійти через GameCon» для серверів: OAuth 2.0 з кодом авторизації (PKCE S256 для лаунчерів
 * без секрету), userinfo з профілем, персонажами й сім’єю на цьому сервері, і синхронізація
 * онлайну та складу від сервера. Секрети й токени зберігаються лише як SHA-256.
 */
class ServerOAuth
{
    /** Що сервер може попросити (ключ — scope, значення — опис для людини). */
    public const SCOPES = [
        'profile' => 'Ім’я, нік і аватар',
        'characters' => 'Ваші персонажі на цьому сервері',
        'family' => 'Сім’я на цьому сервері й ранг',
    ];

    public const MAX_CLIENTS = 3;

    private const CODE_MINUTES = 10;

    private const TOKEN_DAYS = 30;

    /**
     * @param  list<string>  $redirects
     * @return array{0: OAuthClient, 1: string}
     */
    public function createClient(GtaServer $server, User $owner, string $name, array $redirects): array
    {
        if (OAuthClient::query()->where('gta_server_id', $server->id)->whereNull('revoked_at')->count() >= self::MAX_CLIENTS) {
            throw ValidationException::withMessages(['name' => 'Не більше трьох застосунків на сервер.']);
        }
        $secret = 'gcs_'.Str::random(40);
        $client = OAuthClient::query()->create([
            'gta_server_id' => $server->id,
            'created_by' => $owner->id,
            'name' => $name,
            'client_id' => 'gc_'.Str::lower(Str::random(24)),
            'secret_hash' => hash('sha256', $secret),
            'redirect_uris' => $this->redirects($redirects),
        ]);

        return [$client, $secret];
    }

    public function rotateSecret(OAuthClient $client): string
    {
        $secret = 'gcs_'.Str::random(40);
        $client->update(['secret_hash' => hash('sha256', $secret)]);

        return $secret;
    }

    public function revoke(OAuthClient $client): void
    {
        $client->update(['revoked_at' => now()]);
        OAuthToken::query()->where('oauth_client_id', $client->id)->whereNull('revoked_at')->update(['revoked_at' => now()]);
    }

    /**
     * Адреси повернення: https, або http лише для localhost (розробка лаунчера чи сайту).
     *
     * @param  list<string>  $redirects
     * @return list<string>
     */
    public function redirects(array $redirects): array
    {
        $clean = [];
        foreach ($redirects as $uri) {
            $uri = trim($uri);
            if ($uri === '') {
                continue;
            }
            $parts = parse_url($uri);
            $scheme = is_array($parts) ? ($parts['scheme'] ?? '') : '';
            $host = is_array($parts) ? ($parts['host'] ?? '') : '';
            $local = in_array($host, ['localhost', '127.0.0.1'], true);
            if ($host === '' || isset($parts['fragment']) || ! ($scheme === 'https' || ($scheme === 'http' && $local))) {
                throw ValidationException::withMessages(['redirect_uris' => "Адреса повернення має бути https:// (або http://localhost): {$uri}"]);
            }
            $clean[] = $uri;
        }
        if ($clean === [] || count($clean) > 5) {
            throw ValidationException::withMessages(['redirect_uris' => 'Вкажіть від однієї до п’яти адрес повернення.']);
        }

        return array_values(array_unique($clean));
    }

    /**
     * Перевіряє запит /oauth/authorize. Помилку з адресою повернення не віддаємо на неперевірену адресу.
     *
     * @param  array<string, mixed>  $query
     * @return array{client: OAuthClient, redirect_uri: string, scopes: list<string>, state: string|null, code_challenge: string|null}
     */
    public function authorizeRequest(array $query): array
    {
        $client = OAuthClient::query()->with('server')->where('client_id', (string) ($query['client_id'] ?? ''))->whereNull('revoked_at')->first();
        abort_unless($client instanceof OAuthClient && $client->server->status === GtaServer::STATUS_PUBLISHED, 400, 'Невідомий застосунок.');
        $redirect = (string) ($query['redirect_uri'] ?? ($client->redirect_uris[0] ?? ''));
        abort_unless(in_array($redirect, $client->redirect_uris, true), 400, 'Адреса повернення не зареєстрована для цього застосунку.');
        abort_unless(($query['response_type'] ?? 'code') === 'code', 400, 'Підтримується лише response_type=code.');

        $scopes = array_values(array_unique(array_filter(preg_split('/[\s,]+/', (string) ($query['scope'] ?? 'profile')) ?: [])));
        $scopes = $scopes === [] ? ['profile'] : $scopes;
        abort_if(array_diff($scopes, array_keys(self::SCOPES)) !== [], 400, 'Невідомий scope.');
        if (! in_array('profile', $scopes, true)) {
            array_unshift($scopes, 'profile');
        }

        $challenge = isset($query['code_challenge']) ? (string) $query['code_challenge'] : null;
        if ($challenge !== null) {
            abort_unless(($query['code_challenge_method'] ?? 'S256') === 'S256' && preg_match('/^[A-Za-z0-9_-]{43,128}$/', $challenge) === 1, 400, 'Підтримується лише PKCE S256.');
        }

        return [
            'client' => $client,
            'redirect_uri' => $redirect,
            'scopes' => $scopes,
            'state' => isset($query['state']) ? Str::limit((string) $query['state'], 500, '') : null,
            'code_challenge' => $challenge,
        ];
    }

    /**
     * @param  list<string>  $scopes
     */
    public function issueCode(OAuthClient $client, User $user, string $redirect, array $scopes, ?string $challenge): string
    {
        $code = Str::random(48);
        OAuthCode::query()->create([
            'oauth_client_id' => $client->id,
            'user_id' => $user->id,
            'code_hash' => hash('sha256', $code),
            'redirect_uri' => $redirect,
            'scopes' => $scopes,
            'code_challenge' => $challenge,
            'expires_at' => now()->addMinutes(self::CODE_MINUTES),
        ]);

        return $code;
    }

    /**
     * Адреса повернення з параметрами (code або error, і state).
     *
     * @param  array<string, string|null>  $params
     */
    public function redirectWith(string $redirect, array $params): string
    {
        $params = array_filter($params, fn ($value) => $value !== null);

        return $redirect.(str_contains($redirect, '?') ? '&' : '?').http_build_query($params);
    }

    /**
     * Обмін коду на токен. Без секрету — лише з PKCE (лаунчер чи мобільний клієнт).
     *
     * @return array{access_token: string, token_type: string, expires_in: int, scope: string}
     */
    public function exchange(string $clientId, ?string $secret, string $code, string $redirect, ?string $verifier): array
    {
        $client = $this->client($clientId, $secret, allowPublic: true);
        $row = OAuthCode::query()->where('code_hash', hash('sha256', $code))->first();
        if (! $row instanceof OAuthCode || $row->oauth_client_id !== $client->id || $row->used_at !== null || $row->expires_at->isPast() || ! hash_equals($row->redirect_uri, $redirect)) {
            $this->fail('invalid_grant');
        }
        if ($row->code_challenge !== null) {
            $expected = rtrim(strtr(base64_encode(hash('sha256', (string) $verifier, true)), '+/', '-_'), '=');
            if ($verifier === null || ! hash_equals($row->code_challenge, $expected)) {
                $this->fail('invalid_grant');
            }
        } elseif ($secret === null) {
            // Без PKCE клієнт має довести, що він — сервер, секретом.
            $this->fail('invalid_client');
        }
        $row->update(['used_at' => now()]);

        $token = 'gct_'.Str::random(48);
        OAuthToken::query()->create([
            'oauth_client_id' => $client->id,
            'user_id' => $row->user_id,
            'token_hash' => hash('sha256', $token),
            'scopes' => $row->scopes,
            'expires_at' => now()->addDays(self::TOKEN_DAYS),
        ]);

        // Вхід через сервер — це й підтвердження, що людина грає на ньому.
        ServerPlayer::query()->firstOrCreate(
            ['gta_server_id' => $client->gta_server_id, 'user_id' => $row->user_id],
            ['verified_at' => now()],
        );

        return [
            'access_token' => $token,
            'token_type' => 'Bearer',
            'expires_in' => self::TOKEN_DAYS * 86400,
            'scope' => implode(' ', $row->scopes),
        ];
    }

    public function token(?string $bearer): OAuthToken
    {
        $token = $bearer ? OAuthToken::query()->with(['client.server', 'user'])->where('token_hash', hash('sha256', $bearer))->first() : null;
        if (! $token instanceof OAuthToken || $token->revoked_at !== null || $token->expires_at->isPast() || $token->client->revoked_at !== null || $token->user->banned_at !== null) {
            $this->fail('invalid_token', 401);
        }
        $token->forceFill(['last_used_at' => now()])->saveQuietly();

        return $token;
    }

    /**
     * @return array<string, mixed>
     */
    public function userinfo(OAuthToken $token): array
    {
        $user = $token->user;
        $server = $token->client->server;
        $player = ServerPlayer::query()->where('gta_server_id', $server->id)->where('user_id', $user->id)->first();
        $data = [
            'sub' => (string) $user->id,
            'username' => $user->username,
            'name' => $user->name,
            'avatar_url' => $user->avatar_url,
            'profile_url' => URL::to('/'.$user->username),
            'verified_player' => $player !== null,
            'nickname' => $player?->nickname,
        ];
        if (in_array('characters', $token->scopes, true)) {
            $data['characters'] = array_values(RpCharacter::query()->where('user_id', $user->id)->where('gta_server_id', $server->id)
                ->orderByDesc('is_main')->get()
                ->map(fn (RpCharacter $c) => ['id' => $c->id, 'name' => $c->name, 'age' => $c->age, 'occupation' => $c->occupation, 'status' => $c->status, 'is_main' => $c->is_main, 'url' => URL::to('/characters/'.$c->id)])
                ->all());
        }
        if (in_array('family', $token->scopes, true)) {
            $member = FamilyMember::query()->with('family')->where('user_id', $user->id)->where('status', FamilyMember::STATUS_ACTIVE)
                ->whereHas('family', fn ($q) => $q->where('server_id', $server->id))->first();
            $data['family'] = $member ? [
                'name' => $member->family->name,
                'tag' => $member->family->tag,
                'rank' => $member->rank,
                'nickname' => $member->rp_nickname,
                'url' => URL::to('/f/'.$member->family->slug),
            ] : null;
        }

        return $data;
    }

    /**
     * Сервер повідомляє онлайн і хто з гравців GameCon зараз у грі. Оновлюємо лише тих,
     * хто вже входив через цей сервер, — чужих людей сервер «підтвердити» не може.
     *
     * @param  array{online?: int|null, max?: int|null, players?: list<array{user_id: int|string, nickname?: string|null, online?: bool}>}  $payload
     * @return array{updated: int, ignored: int}
     */
    public function sync(OAuthClient $client, array $payload): array
    {
        $server = $client->server;
        if (isset($payload['online'])) {
            $online = max(0, (int) $payload['online']);
            $server->forceFill([
                'players_online' => $online,
                'players_max' => isset($payload['max']) ? max(0, (int) $payload['max']) : $server->players_max,
                'players_peak' => max((int) $server->players_peak, $online),
                'stats_updated_at' => now(),
            ])->save();
        }

        $updated = 0;
        $ignored = 0;
        $known = ServerPlayer::query()->where('gta_server_id', $server->id)->get()->keyBy('user_id');
        foreach ($payload['players'] ?? [] as $row) {
            $player = $known->get((int) $row['user_id']);
            if (! $player instanceof ServerPlayer) {
                $ignored++;

                continue;
            }
            $isOnline = (bool) ($row['online'] ?? true);
            $player->forceFill([
                'nickname' => isset($row['nickname']) ? Str::limit(trim((string) $row['nickname']), 60, '') : $player->nickname,
                'online' => $isOnline,
                'last_seen_at' => $isOnline ? now() : $player->last_seen_at,
            ])->save();
            $updated++;
        }

        return ['updated' => $updated, 'ignored' => $ignored];
    }

    public function client(string $clientId, ?string $secret, bool $allowPublic = false): OAuthClient
    {
        $client = OAuthClient::query()->with('server')->where('client_id', $clientId)->whereNull('revoked_at')->first();
        if (! $client instanceof OAuthClient) {
            $this->fail('invalid_client', 401);
        }
        if ($secret !== null ? ! hash_equals($client->secret_hash, hash('sha256', $secret)) : ! $allowPublic) {
            $this->fail('invalid_client', 401);
        }

        return $client;
    }

    /**
     * Сервери, яким людина дала доступ, — для налаштувань акаунта.
     *
     * @return list<array{client_id: int, name: string, server: string, slug: string, scopes: list<string>, last_used_at: string|null}>
     */
    public function connections(User $user): array
    {
        return array_values(OAuthToken::query()->with('client.server')
            ->where('user_id', $user->id)->whereNull('revoked_at')->where('expires_at', '>', now())
            ->latest('id')->get()
            ->unique('oauth_client_id')
            ->map(fn (OAuthToken $token) => [
                'client_id' => $token->oauth_client_id,
                'name' => $token->client->name,
                'server' => $token->client->server->name,
                'slug' => $token->client->server->slug,
                'scopes' => $token->scopes,
                'last_used_at' => $token->last_used_at?->toIso8601String(),
            ])->all());
    }

    public function disconnect(User $user, int $clientId): void
    {
        OAuthToken::query()->where('user_id', $user->id)->where('oauth_client_id', $clientId)->whereNull('revoked_at')->update(['revoked_at' => now()]);
    }

    /**
     * @return never
     */
    private function fail(string $error, int $status = 400): void
    {
        abort(response()->json(['error' => $error], $status));
    }
}
