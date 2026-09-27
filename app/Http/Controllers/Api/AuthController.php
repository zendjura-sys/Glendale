<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\UnionBlacklistedPlayer;
use App\Models\User;
use App\Support\FamilyContent;
use App\Support\TwoFactorAuthentication;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules;
use Illuminate\Validation\ValidationException;

/**
 * Токен-автентифікація для мобільного застосунку (Flutter). Окремо від
 * AuthenticatedSessionController (веб-сесія) — тут немає кукі й CSRF,
 * лише Sanctum personal access token на пристрій. Дзеркалить ту саму
 * 2FA-логіку двома кроками, що й веб (TwoFactorChallengeController), але
 * замість проміжного стану в сесії — короткоживучий challenge-токен у
 * кеші, бо між кроком 1 і 2 застосунок не тримає сесії сервера.
 */
class AuthController extends Controller
{
    public function __construct(private readonly TwoFactorAuthentication $twoFactor)
    {
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
            'device_name' => ['required', 'string', 'max:255'],
        ]);

        $throttleKey = Str::transliterate(Str::lower($data['email'])).'|'.$request->ip();

        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            event(new Lockout($request));
            $seconds = RateLimiter::availableIn($throttleKey);

            throw ValidationException::withMessages([
                'email' => trans('auth.throttle', ['seconds' => $seconds, 'minutes' => ceil($seconds / 60)]),
            ]);
        }

        if (! Auth::guard('web')->validate(['email' => $data['email'], 'password' => $data['password']])) {
            RateLimiter::hit($throttleKey);

            throw ValidationException::withMessages(['email' => trans('auth.failed')]);
        }

        RateLimiter::clear($throttleKey);

        /** @var User $user */
        $user = User::where('email', $data['email'])->firstOrFail();

        if ($user->hasConfirmedTwoFactor()) {
            $challenge = Str::random(64);
            Cache::put('mobile-2fa:'.$challenge, $user->id, now()->addMinutes(5));

            return response()->json([
                'requires_two_factor' => true,
                'challenge_token' => $challenge,
            ]);
        }

        return response()->json($this->issueToken($user, $data['device_name']));
    }

    public function loginTwoFactor(Request $request): JsonResponse
    {
        $data = $request->validate([
            'challenge_token' => ['required', 'string'],
            'code' => ['nullable', 'string'],
            'recovery_code' => ['nullable', 'string'],
            'device_name' => ['required', 'string', 'max:255'],
        ]);

        $userId = Cache::get('mobile-2fa:'.$data['challenge_token']);
        if (! $userId) {
            throw ValidationException::withMessages(['challenge_token' => 'Код підтвердження прострочено, увійдіть ще раз.']);
        }

        $user = User::find($userId);
        if (! $user) {
            throw ValidationException::withMessages(['challenge_token' => 'Код підтвердження прострочено, увійдіть ще раз.']);
        }

        $verified = $this->verifyCode($user, $data) || $this->verifyRecoveryCode($user, $data);

        if (! $verified) {
            throw ValidationException::withMessages(['code' => 'Невірний код підтвердження.']);
        }

        Cache::forget('mobile-2fa:'.$data['challenge_token']);

        return response()->json($this->issueToken($user, $data['device_name']));
    }

    /**
     * Реєстрація "за себе" з застосунку — без союзних полів (union.gamecon.online
     * не має мобільного застосунку) і без покрокового підтвердження
     * тіньового акаунту, що є на сайті (Auth/Register.vue): якщо ім'я
     * збігається з тіньовим акаунтом, просто просимо завершити реєстрацію
     * на сайті, де є той екран підтвердження.
     */
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:120'],
            'last_name' => ['nullable', 'string', 'max:120'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:'.User::class],
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
            'device_name' => ['required', 'string', 'max:255'],
        ]);

        $fullName = trim($data['first_name'].' '.($data['last_name'] ?? ''));

        if (UnionBlacklistedPlayer::isBlacklisted($data['first_name'], $data['last_name'] ?? null)) {
            throw ValidationException::withMessages(['first_name' => 'Цей гравець у чорному списку союзу — реєстрація недоступна.']);
        }

        if (User::query()->where('is_shadow', true)->where('name', $fullName)->exists()) {
            throw ValidationException::withMessages([
                'first_name' => 'За це ім\'я вже подавали звіт раніше. Завершіть реєстрацію на сайті gamecon.online — там є підтвердження, що це саме ви.',
            ]);
        }

        $user = User::create([
            'first_name' => $data['first_name'],
            'last_name' => $data['last_name'] ?? null,
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'position_key' => FamilyContent::positionKeys()[0] ?? null,
        ]);

        event(new Registered($user));

        return response()->json($this->issueToken($user, $data['device_name']));
    }

    /**
     * "Забули пароль?" із застосунку — той самий Password::sendResetLink(),
     * що й на сайті (PasswordResetLinkController), лише JSON замість
     * редіректу. Лист із посиланням відкривається в браузері — сама зміна
     * пароля лишається на сайті (там уже є форма з токеном), у застосунку
     * просто просимо лист і повертаємо на логін.
     */
    public function forgotPassword(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'string', 'email']]);

        $status = Password::sendResetLink($data);

        if ($status !== Password::RESET_LINK_SENT) {
            throw ValidationException::withMessages(['email' => [trans($status)]]);
        }

        return response()->json(['message' => trans($status)]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Вихід виконано.']);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'position' => $user->position_title,
            'avatar_url' => $user->avatar_path ? \Illuminate\Support\Facades\Storage::url($user->avatar_path) : null,
            'permissions' => $user->getAllPermissions()->pluck('name'),
        ]);
    }

    /** @return array{token: string, user: array<string, mixed>} */
    private function issueToken(User $user, string $deviceName): array
    {
        $token = $user->createToken($deviceName)->plainTextToken;

        return [
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'position' => $user->position_title,
                'permissions' => $user->getAllPermissions()->pluck('name'),
            ],
        ];
    }

    /** @param array<string, mixed> $data */
    private function verifyCode(User $user, array $data): bool
    {
        if (empty($data['code']) || ! $user->two_factor_secret) {
            return false;
        }

        return $this->twoFactor->verify($user->two_factor_secret, $data['code']);
    }

    /** @param array<string, mixed> $data */
    private function verifyRecoveryCode(User $user, array $data): bool
    {
        if (empty($data['recovery_code'])) {
            return false;
        }

        $codes = $user->two_factor_recovery_codes ?? [];
        $index = array_search($data['recovery_code'], $codes, true);

        if ($index === false) {
            return false;
        }

        unset($codes[$index]);
        $user->forceFill(['two_factor_recovery_codes' => array_values($codes)])->save();

        return true;
    }
}
