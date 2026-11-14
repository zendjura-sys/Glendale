<?php

namespace App\Services\Developer;

use App\Models\DeveloperApp;
use App\Models\DeveloperToken;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * OAuth 2.1 для сторонніх застосунків: лише authorization_code з PKCE (S256) і refresh_token з ротацією.
 * Без implicit і password grant; redirect_uri — точний збіг; коди одноразові й живуть 10 хв.
 * Повторне використання коду чи старого refresh-токена відкликає всю видачу (захист від крадіжки).
 */
class OAuthServer
{
    /** Права, які може попросити застосунок. Назва → що бачить людина на екрані згоди. */
    public const SCOPES = [
        'profile' => 'Ваше ім’я, нік, аватар і публічний профіль',
        'email' => 'Ваша адреса email',
        'friends' => 'Список ваших друзів',
        'posts:read' => 'Ваші публікації',
        'posts:write' => 'Публікувати від вашого імені',
        'status' => 'Ставити статус «Граю в…»',
        'notifications' => 'Кількість непрочитаних сповіщень',
        'voice' => 'Голосовий зв’язок у застосунку (кімнати лобі й матчів)',
        'chat' => 'Читати й надсилати ваші повідомлення',
        'groups' => 'Ваші сім’ї, клани й гільдії та їхній склад',
        'groups:manage' => 'Керувати кланами й гільдіями від вашого імені (ранги, заявки, виключення) — у межах ваших прав',
        'music' => 'Що грає у вас і керування відтворенням',
        'presence' => 'Показувати друзям ваш статус у грі',
        'invites' => 'Запрошувати ваших друзів у гру від вашого імені',
        'achievements' => 'Ваші досягнення й результати в таблицях лідерів гри',
        'notify' => 'Надсилати вам сповіщення гри (до 20 на добу)',
    ];

    public const DEFAULT_SCOPE = 'profile';

    public const CODE_TTL = 600;

    public const ACCESS_TTL = 3600;

    public const REFRESH_DAYS = 30;

    public function newClientId(): string
    {
        return 'gc_'.Str::lower(Str::random(29));
    }

    public function newPublicKey(): string
    {
        return 'gcp_'.Str::lower(Str::random(40));
    }

    /** Новий токен бота застосунку: показуємо один раз, зберігаємо хеш. */
    public function newBotToken(DeveloperApp $app): string
    {
        $plain = 'gcb_'.$app->id.'_'.Str::random(48);
        $app->forceFill(['bot_token' => hash('sha256', $plain), 'bot_token_at' => now()])->save();

        return $plain;
    }

    /** Застосунок за токеном бота або публічним ключем (для запитів без людини). */
    public function appByKey(string $value): ?DeveloperApp
    {
        $app = str_starts_with($value, 'gcb_')
            ? DeveloperApp::query()->where('bot_token', hash('sha256', $value))->first()
            : (str_starts_with($value, 'gcp_') ? DeveloperApp::query()->where('public_key', $value)->first() : null);

        return $app !== null && ! $app->blocked() ? $app : null;
    }

    /**
     * Особистий токен розробника для свого ж акаунта (тести без проходження OAuth у браузері).
     *
     * @param  list<string>  $scopes
     * @return array<string, mixed>
     */
    public function personalToken(DeveloperApp $app, User $user, array $scopes): array
    {
        return $this->issueTokens($app, $user->id, $scopes);
    }

    /** Новий секрет: показуємо один раз, зберігаємо хеш. */
    public function newSecret(DeveloperApp $app): string
    {
        $plain = 'gcs_'.Str::random(48);
        $app->forceFill(['client_secret' => hash('sha256', $plain)])->save();

        return $plain;
    }

    /** @return list<string>|null null — невідомий scope або не дозволений застосунку */
    public function scopes(DeveloperApp $app, ?string $requested): ?array
    {
        $list = array_values(array_unique(array_filter(preg_split('/[\s,]+/', trim((string) ($requested ?: self::DEFAULT_SCOPE))) ?: [])));
        foreach ($list as $scope) {
            if (! isset(self::SCOPES[$scope]) || ! in_array($scope, $app->scopes, true)) {
                return null;
            }
        }

        return $list === [] ? [self::DEFAULT_SCOPE] : $list;
    }

    /** @param list<string> $scopes */
    public function issueCode(DeveloperApp $app, User $user, array $scopes, string $redirect, string $challenge): string
    {
        $plain = Str::random(64);
        DB::table('developer_oauth_codes')->insert([
            'id' => hash('sha256', $plain),
            'developer_app_id' => $app->id,
            'user_id' => $user->id,
            'scopes' => json_encode($scopes),
            'redirect_uri' => $redirect,
            'code_challenge' => $challenge,
            'expires_at' => now()->addSeconds(self::CODE_TTL),
        ]);

        return $plain;
    }

    /**
     * Обмін коду на токени. Повертає відповідь токен-ендпоінта або код помилки RFC 6749.
     *
     * @return array<string, mixed>|string
     */
    public function exchangeCode(DeveloperApp $app, string $code, string $redirect, string $verifier): array|string
    {
        return DB::transaction(function () use ($app, $code, $redirect, $verifier) {
            $row = DB::table('developer_oauth_codes')->where('id', hash('sha256', $code))->lockForUpdate()->first();
            if ($row === null || (int) $row->developer_app_id !== $app->id) {
                return 'invalid_grant';
            }
            if ($row->used_at !== null) {
                // Код використали вдруге — хтось його вкрав: відкликаємо все, що з нього видано.
                DeveloperToken::query()->where('developer_app_id', $app->id)->where('user_id', $row->user_id)
                    ->where('created_at', '>=', $row->used_at)->update(['revoked_at' => now()]);

                return 'invalid_grant';
            }
            DB::table('developer_oauth_codes')->where('id', $row->id)->update(['used_at' => now()]);
            if (now()->greaterThan($row->expires_at) || ! hash_equals($row->redirect_uri, $redirect) || ! ($row->code_challenge === '' || $row->code_challenge === null ? $app->confidential : self::verifyPkce($verifier, $row->code_challenge))) {
                return 'invalid_grant';
            }

            return $this->issueTokens($app, (int) $row->user_id, json_decode($row->scopes, true));
        });
    }

    /** @return array<string, mixed>|string */
    public function refresh(DeveloperApp $app, string $refresh, ?string $scope = null): array|string
    {
        return DB::transaction(function () use ($app, $refresh, $scope) {
            $token = DeveloperToken::query()->where('refresh_token', hash('sha256', $refresh))->lockForUpdate()->first();
            if ($token === null || $token->developer_app_id !== $app->id) {
                return 'invalid_grant';
            }
            if ($token->revoked_at !== null) {
                // Старий (уже обміняний) refresh-токен — ознака крадіжки: гасимо всі токени цієї пари.
                DeveloperToken::query()->where('developer_app_id', $app->id)->where('user_id', $token->user_id)->update(['revoked_at' => now()]);

                return 'invalid_grant';
            }
            if ($token->refresh_expires_at?->isPast()) {
                return 'invalid_grant';
            }
            $scopes = $token->scopes;
            if ($scope !== null && $scope !== '') {
                $asked = preg_split('/[\s,]+/', trim($scope)) ?: [];
                if (array_diff($asked, $scopes) !== []) {
                    return 'invalid_scope';
                }
                $scopes = array_values($asked);
            }
            $token->forceFill(['revoked_at' => now()])->save();

            return $this->issueTokens($app, $token->user_id, $scopes);
        });
    }

    /**
     * @param  list<string>  $scopes
     * @return array<string, mixed>
     */
    private function issueTokens(DeveloperApp $app, int $userId, array $scopes): array
    {
        $access = 'gca_'.Str::random(60);
        $refresh = 'gcr_'.Str::random(60);
        DeveloperToken::query()->create([
            'developer_app_id' => $app->id,
            'user_id' => $userId,
            'access_token' => hash('sha256', $access),
            'refresh_token' => hash('sha256', $refresh),
            'scopes' => $scopes,
            'expires_at' => now()->addSeconds(self::ACCESS_TTL),
            'refresh_expires_at' => now()->addDays(self::REFRESH_DAYS),
        ]);

        return [
            'access_token' => $access,
            'token_type' => 'Bearer',
            'expires_in' => self::ACCESS_TTL,
            'refresh_token' => $refresh,
            'scope' => implode(' ', $scopes),
        ];
    }

    /** RFC 7009: токен (access чи refresh) більше не діє. Невідомий токен — теж «успіх». */
    public function revoke(DeveloperApp $app, string $token): void
    {
        $hash = hash('sha256', $token);
        DeveloperToken::query()->where('developer_app_id', $app->id)
            ->where(fn ($q) => $q->where('access_token', $hash)->orWhere('refresh_token', $hash))
            ->update(['revoked_at' => now()]);
    }

    /** Чинний токен доступу за значенням з заголовка Authorization. */
    public function resolve(string $bearer): ?DeveloperToken
    {
        $token = DeveloperToken::query()->with(['app', 'user'])->where('access_token', hash('sha256', $bearer))->first();
        if ($token === null || $token->revoked_at !== null || $token->expires_at->isPast() || $token->app->blocked() || $token->user->banned_at !== null) {
            return null;
        }

        return $token;
    }

    /** Клієнт за client_id і (для конфіденційних) секретом. */
    public function client(?string $clientId, ?string $secret): ?DeveloperApp
    {
        $app = $clientId ? DeveloperApp::query()->where('client_id', $clientId)->first() : null;
        if ($app === null || $app->blocked()) {
            return null;
        }
        if ($app->confidential && ($secret === null || $app->client_secret === null || ! hash_equals($app->client_secret, hash('sha256', $secret)))) {
            return null;
        }

        return $app;
    }

    public static function verifyPkce(string $verifier, string $challenge): bool
    {
        if (preg_match('/^[A-Za-z0-9\-._~]{43,128}$/', $verifier) !== 1) {
            return false;
        }

        return hash_equals($challenge, rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '='));
    }

    /** Чи дозволена адреса повернення: точний збіг з однією зі збережених. */
    public static function redirectAllowed(DeveloperApp $app, string $uri): bool
    {
        if (in_array($uri, $app->redirect_uris, true)) {
            return true;
        }
        // RFC 8252 §7.3: нативні застосунки (Windows, Linux, macOS) слухають випадковий порт на loopback —
        // зареєстрована адреса без порту (http://127.0.0.1/callback) підходить з будь-яким портом.
        $got = parse_url($uri);
        if (($got['scheme'] ?? '') !== 'http' || ! in_array($got['host'] ?? '', ['127.0.0.1', 'localhost', '[::1]'], true) || isset($got['query']) || isset($got['fragment'])) {
            return false;
        }
        foreach ($app->redirect_uris as $registered) {
            $want = parse_url($registered);
            if (($want['scheme'] ?? '') === 'http' && ! isset($want['port']) && ($want['host'] ?? '') === $got['host']
                && rtrim($want['path'] ?? '/', '/') === rtrim($got['path'] ?? '/', '/')) {
                return true;
            }
        }

        return false;
    }

    /** Що людина дозволила застосункам: для «Підключених застосунків». @return list<array<string, mixed>> */
    public function connected(User $user): array
    {
        return DeveloperToken::query()->with('app')->where('user_id', $user->id)->whereNull('revoked_at')
            ->where(fn ($q) => $q->where('expires_at', '>', now())->orWhere('refresh_expires_at', '>', now()))
            ->get()->groupBy('developer_app_id')
            ->map(function ($tokens) {
                $app = $tokens->first()->app;

                return [
                    'id' => $app->id,
                    'name' => $app->name,
                    'website' => $app->website,
                    'scopes' => array_values(array_unique($tokens->flatMap(fn (DeveloperToken $t) => $t->scopes)->all())),
                    'since' => $tokens->min('created_at')?->toIso8601String(),
                    'last_used_at' => $tokens->max('last_used_at')?->toIso8601String(),
                ];
            })->values()->all();
    }

    /** Людина відкликає доступ застосунку повністю. */
    public function disconnect(User $user, int $appId): void
    {
        DeveloperToken::query()->where('user_id', $user->id)->where('developer_app_id', $appId)->update(['revoked_at' => now()]);
        DB::table('developer_oauth_codes')->where('user_id', $user->id)->where('developer_app_id', $appId)->delete();
    }
}
