<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\TwoFactorAuthentication;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Другий крок входу — ПІСЛЯ вірного пароля (AuthenticatedSessionController
 * встиг лише перевірити пароль і одразу розлогінив, залишивши id у сесії;
 * сюди приходять НЕ автентифікованими, доки не введуть код).
 */
class TwoFactorChallengeController extends Controller
{
    public function __construct(private readonly TwoFactorAuthentication $service)
    {
    }

    public function create(Request $request): RedirectResponse|Response
    {
        if (! $request->session()->has('login.id')) {
            return redirect()->route('login');
        }

        return Inertia::render('Auth/TwoFactorChallenge');
    }

    public function store(Request $request): RedirectResponse
    {
        $userId = $request->session()->get('login.id');
        if (! $userId) {
            return redirect()->route('login');
        }

        $data = $request->validate([
            'code' => ['nullable', 'string'],
            'recovery_code' => ['nullable', 'string'],
            'remember_device' => ['nullable', 'boolean'],
        ]);

        $user = User::find($userId);
        if (! $user) {
            $request->session()->forget(['login.id', 'login.remember']);

            return redirect()->route('login');
        }

        $verified = $this->verifyCode($user, $data) || $this->verifyRecoveryCode($user, $data);

        if (! $verified) {
            throw ValidationException::withMessages([
                'code' => 'Невірний код підтвердження.',
            ]);
        }

        $remember = (bool) $request->session()->get('login.remember', false);
        $request->session()->forget(['login.id', 'login.remember']);

        Auth::login($user, $remember);
        $request->session()->regenerate();

        $response = redirect()->intended('/feed');

        if ($data['remember_device'] ?? false) {
            $token = $this->service->trustDevice($user);
            $response->withCookie(Cookie::make(
                TwoFactorAuthentication::TRUST_COOKIE,
                $token,
                60 * 24 * 30,
                httpOnly: true,
                sameSite: 'lax',
            ));
        }

        return $response;
    }

    private function verifyCode(User $user, array $data): bool
    {
        if (empty($data['code']) || ! $user->two_factor_secret) {
            return false;
        }

        return $this->service->verify($user->two_factor_secret, $data['code']);
    }

    /** Використаний код одразу видаляється зі списку — одноразовий за визначенням. */
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
