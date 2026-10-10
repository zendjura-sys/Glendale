<?php

namespace App\Http\Controllers\Api;

use App\Actions\Fortify\CreateNewUser;
use App\Models\User;
use App\Services\Auth\AccountSecurity;
use App\Services\Auth\ApiTokens;
use App\Services\Auth\DiscordOAuth;
use App\Services\Auth\FirebaseAuth;
use App\Services\Auth\SocialAuthException;
use App\Services\Auth\SocialLogin;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Contracts\TwoFactorAuthenticationProvider;
use Laravel\Fortify\Fortify;

class AuthController extends ApiController
{
    public function __construct(
        private readonly ApiTokens $tokens,
        private readonly SocialLogin $social,
        private readonly FirebaseAuth $firebase,
        private readonly DiscordOAuth $discord,
    ) {}

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::query()->where('email', mb_strtolower($data['email']))->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            if ($user) {
                app(AccountSecurity::class)->logLogin($user, 'app', false, $request);
            }
            throw ValidationException::withMessages([
                'email' => 'Невірна пошта або пароль.',
            ]);
        }

        return $this->issue($request, $user);
    }

    public function register(Request $request, CreateNewUser $users): JsonResponse
    {
        $user = $users->create($request->all());

        return $this->issue($request, $user, created: true);
    }

    public function google(Request $request): JsonResponse
    {
        $data = $request->validate([
            'id_token' => ['required_without:google_token', 'nullable', 'string', 'max:8192'],
            'google_token' => ['nullable', 'string', 'max:8192'],
        ]);

        if (! $this->firebase->configured()) {
            throw ValidationException::withMessages(['google' => 'Вхід через Google ще не налаштовано.']);
        }

        try {
            $profile = filled($data['google_token'] ?? null)
                ? $this->firebase->verifyGoogleToken((string) $data['google_token'])
                : $this->firebase->verify((string) ($data['id_token'] ?? ''));
            $user = $this->social->resolve($profile);
        } catch (SocialAuthException $e) {
            throw ValidationException::withMessages(['google' => $e->getMessage()]);
        }

        return $this->issue($request, $user);
    }

    public function discordStart(): JsonResponse
    {
        if (! $this->discord->configured()) {
            throw ValidationException::withMessages(['discord' => 'Вхід через Discord ще не налаштовано.']);
        }

        $state = Str::random(40);
        Cache::put('discord.oauth.'.$state, ['state' => $state, 'client' => 'android'], now()->addMinutes(10));

        return response()->json(['url' => $this->discord->authorizeUrl($state)]);
    }

    public function exchange(Request $request): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'string', 'max:80']]);
        $user = $this->tokens->takeHandoff($data['code']);

        if (! $user) {
            throw ValidationException::withMessages(['code' => 'Код входу недійсний або вже використаний.']);
        }

        return $this->issue($request, $user, challenge: false);
    }

    public function twoFactor(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ticket' => ['required', 'string', 'max:80'],
            'code' => ['required_without:recovery_code', 'nullable', 'string', 'max:20'],
            'recovery_code' => ['nullable', 'string', 'max:40'],
        ]);

        $user = $this->tokens->userFromTicket($data['ticket']);

        if (! $user || $user->two_factor_confirmed_at === null) {
            throw ValidationException::withMessages(['ticket' => 'Підтвердження більше не дійсне. Увійдіть знову.']);
        }

        $valid = filled($data['recovery_code'] ?? null)
            ? $this->consumeRecoveryCode($user, (string) $data['recovery_code'])
            : $this->verifyCode($user, (string) ($data['code'] ?? ''));

        if (! $valid) {
            throw ValidationException::withMessages(['code' => 'Невірний код.']);
        }

        $this->tokens->forgetTicket($data['ticket']);

        return $this->issue($request, $user, challenge: false);
    }

    public function logout(Request $request): JsonResponse
    {
        $plain = $request->bearerToken();
        if (is_string($plain) && $plain !== '') {
            $this->tokens->revoke($this->user($request), $plain);
        }

        return response()->json(['ok' => true]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['user' => AccountPresenter::make($this->user($request))]);
    }

    private function issue(Request $request, User $user, bool $created = false, bool $challenge = true): JsonResponse
    {
        if ($user->isBanned()) {
            throw ValidationException::withMessages([
                'email' => 'Обліковий запис заблоковано'.($user->ban_reason ? ': '.$user->ban_reason : '.'),
            ]);
        }

        if ($challenge && $user->two_factor_confirmed_at !== null) {
            return response()->json([
                'two_factor' => true,
                'ticket' => $this->tokens->ticket($user),
            ]);
        }

        $name = Str::limit((string) $request->input('device', 'android'), 40, '');
        app(AccountSecurity::class)->logLogin($user, 'app', true, $request);

        return response()->json([
            'token' => $this->tokens->issue($user, $name !== '' ? $name : 'android'),
            'token_type' => 'Bearer',
            'user' => AccountPresenter::make($user),
        ], $created ? 201 : 200);
    }

    private function verifyCode(User $user, string $code): bool
    {
        if ($code === '' || $user->two_factor_secret === null) {
            return false;
        }

        try {
            return app(TwoFactorAuthenticationProvider::class)->verify(
                Fortify::currentEncrypter()->decrypt($user->two_factor_secret),
                $code,
            );
        } catch (DecryptException) {
            return false;
        }
    }

    private function consumeRecoveryCode(User $user, string $code): bool
    {
        if ($user->two_factor_recovery_codes === null) {
            return false;
        }

        try {
            $decoded = json_decode(Fortify::currentEncrypter()->decrypt($user->two_factor_recovery_codes), true);
        } catch (DecryptException) {
            return false;
        }

        if (! is_array($decoded) || ! in_array($code, $decoded, true)) {
            return false;
        }

        $user->replaceRecoveryCode($code);

        return true;
    }
}
