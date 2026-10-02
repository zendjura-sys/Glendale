<?php

namespace App\Services\Auth;

use App\Models\User;
use App\Services\ImageStorage;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

class SocialLogin
{
    public const PROVIDERS = ['discord' => 'Discord', 'google' => 'Google'];

    /** Колонки користувача: [ідентифікатор, підпис для налаштувань]. */
    private const COLUMNS = [
        'discord' => ['discord_id', 'discord_username'],
        'google' => ['google_id', 'google_email'],
    ];

    public function __construct(
        private readonly SiteSettings $settings,
        private readonly ImageStorage $images,
    ) {}

    /**
     * Знаходить акаунт за соцмережею або підтвердженою поштою, інакше реєструє новий.
     */
    public function resolve(SocialProfile $profile): User
    {
        [$idColumn] = self::COLUMNS[$profile->provider];

        $user = User::query()->where($idColumn, $profile->id)->first();
        if ($user) {
            return $user;
        }

        $byEmail = $profile->email ? User::query()->where('email', $profile->email)->first() : null;
        if ($byEmail) {
            if (! $profile->emailVerified) {
                throw new SocialAuthException("Акаунт із поштою {$profile->email} уже існує. Увійдіть паролем і під’єднайте {$profile->label()} у налаштуваннях профілю.");
            }
            $this->link($byEmail, $profile);

            return $byEmail;
        }

        if (! $profile->email || ! $profile->emailVerified) {
            throw new SocialAuthException("Підтвердіть електронну пошту в {$profile->label()}, щоб зареєструватися через нього.");
        }

        if (! $this->settings->get('registration_open')) {
            throw new SocialAuthException('Реєстрацію тимчасово закрито.');
        }

        return $this->register($profile);
    }

    public function link(User $user, SocialProfile $profile): void
    {
        [$idColumn, $labelColumn] = self::COLUMNS[$profile->provider];

        $taken = User::query()->where($idColumn, $profile->id)->whereKeyNot($user->id)->exists();
        if ($taken) {
            throw new SocialAuthException("Цей акаунт {$profile->label()} уже під’єднано до іншого профілю GameCon.");
        }

        $user->forceFill([
            $idColumn => $profile->id,
            $labelColumn => $profile->provider === 'google' ? $profile->email : $profile->handle,
        ])->save();
    }

    public function unlink(User $user, string $provider): void
    {
        $user->forceFill(array_fill_keys(self::COLUMNS[$provider], null))->save();
    }

    /**
     * @param  array<string, bool>  $available
     * @return list<array{provider: string, label: string, connected: bool, account: string|null, available: bool}>
     */
    public function connections(User $user, array $available): array
    {
        return array_values(collect(self::PROVIDERS)->map(function (string $label, string $provider) use ($user, $available) {
            [$idColumn, $labelColumn] = self::COLUMNS[$provider];

            return [
                'provider' => $provider,
                'label' => $label,
                'connected' => filled($user->{$idColumn}),
                'account' => $user->{$labelColumn},
                'available' => (bool) ($available[$provider] ?? false),
            ];
        })->all());
    }

    private function register(SocialProfile $profile): User
    {
        [$first, $last] = $this->splitName($profile);

        $user = DB::transaction(function () use ($profile, $first, $last) {
            $isFirstUser = ! User::query()->exists();

            $user = User::create([
                'username' => $this->uniqueUsername($profile->handle ?: Str::before((string) $profile->email, '@'), $first, $last),
                'first_name' => $first,
                'last_name' => $last,
                'email' => $profile->email,
                'password' => Str::password(40),
            ]);
            $user->forceFill([
                'email_verified_at' => now(),
                'role' => $isFirstUser ? User::ROLE_ADMIN : User::ROLE_USER,
            ])->save();
            $this->link($user, $profile);

            return $user;
        });

        $this->importAvatar($user, $profile->avatarUrl);

        return $user;
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function splitName(SocialProfile $profile): array
    {
        $name = trim(preg_replace('/\s+/u', ' ', $profile->name) ?? '');
        if ($name === '') {
            $name = $profile->handle ?: Str::before((string) $profile->email, '@');
        }

        $parts = explode(' ', Str::limit($name, 128, ''), 2);

        return [Str::limit($parts[0], 64, ''), Str::limit($parts[1] ?? '', 64, '')];
    }

    private function uniqueUsername(string $preferred, string $first, string $last): string
    {
        $clean = fn (string $value) => Str::of(Str::transliterate($value))
            ->lower()
            ->replaceMatches('/[^a-z0-9_.]+/', '')
            ->replaceMatches('/^[^a-z]+/', '')
            ->limit(24, '')
            ->replaceMatches('/[^a-z0-9]+$/', '')
            ->toString();

        $base = collect([$clean($preferred), $clean($first.'.'.$last)])
            ->first(fn (string $c) => strlen($c) >= 3 && ! in_array($c, config('reserved.usernames'), true)) ?? 'user';

        $candidate = $base;
        while (User::query()->where('username', $candidate)->exists()) {
            $candidate = $base.random_int(10, 99999);
        }

        return $candidate;
    }

    private function importAvatar(User $user, ?string $url): void
    {
        if (! $url) {
            return;
        }

        $tmp = tempnam(sys_get_temp_dir(), 'avatar');

        try {
            $response = Http::timeout(8)->get($url);
            if (! $response->successful() || ! str_starts_with((string) $response->header('Content-Type'), 'image/') || strlen($response->body()) > 5 * 1024 * 1024) {
                return;
            }
            file_put_contents($tmp, $response->body());
            $stored = $this->images->store(new UploadedFile($tmp, 'avatar', null, null, true), 'avatars', cover: [512, 512]);
            $user->forceFill(['avatar_path' => $stored['path']])->save();
        } catch (Throwable $e) {
            report($e);
        } finally {
            @unlink($tmp);
        }
    }
}
