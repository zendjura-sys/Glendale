<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Support\TwoFactorAuthentication;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Inertia\Response;

class AuthenticatedSessionController extends Controller
{
    public function __construct(private readonly TwoFactorAuthentication $twoFactor)
    {
    }

    /**
     * Display the login view.
     */
    public function create(): Response
    {
        return Inertia::render('Auth/Login', [
            'canResetPassword' => Route::has('password.request'),
            'status' => session('status'),
        ]);
    }

    /**
     * Handle an incoming authentication request.
     *
     * Пароль перевіряється звичайним Auth::attempt() всередині authenticate()
     * — це вже ПОВНІСТЮ логінить сесію. Якщо в акаунта підтверджена 2FA,
     * одразу відкочуємо цей логін (Auth::logout) і лишаємо тільки id у сесії:
     * людина ще НЕ автентифікована, доки не введе код на другому кроці.
     *
     * Виняток — довірений пристрій (cookie з TwoFactorChallengeController,
     * "Довіряти цьому пристрою на 30 днів"): якщо токен звідти є й ще не
     * прострочений саме для ЦЬОГО користувача, другий крок пропускається
     * зовсім, як для акаунтів без 2FA.
     */
    public function store(LoginRequest $request): RedirectResponse
    {
        $request->authenticate();

        $user = $request->user();

        $trusted = $this->twoFactor->isDeviceTrusted($user, $request->cookie(TwoFactorAuthentication::TRUST_COOKIE));

        if ($user->hasConfirmedTwoFactor() && ! $trusted) {
            $remember = $request->boolean('remember');
            Auth::guard('web')->logout();

            $request->session()->put([
                'login.id' => $user->getKey(),
                'login.remember' => $remember,
            ]);

            return redirect()->route('two-factor.login');
        }

        $request->session()->regenerate();

        return redirect()->intended('/feed');
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): RedirectResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();

        $request->session()->regenerateToken();

        return redirect('/');
    }
}
