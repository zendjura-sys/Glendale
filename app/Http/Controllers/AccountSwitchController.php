<?php

namespace App\Http\Controllers;

use App\Services\Accounts\AccountSwitcher;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/** Перемикач акаунтів у меню людини. */
class AccountSwitchController extends Controller
{
    public function __construct(private readonly AccountSwitcher $switcher) {}

    public function index(Request $request): JsonResponse
    {
        app(Plugins::class)->ensure('account_switcher');

        return response()->json(['accounts' => $this->switcher->accounts($request), 'max' => AccountSwitcher::MAX]);
    }

    /** Додати акаунт: памʼятаємо поточний, виходимо й ведемо на звичайний вхід. */
    public function add(Request $request): RedirectResponse
    {
        app(Plugins::class)->ensure('account_switcher');
        $this->switcher->remember($request, $request->user());
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        $request->session()->put(AccountSwitcher::ADDING, true);

        return redirect()->route('login');
    }

    public function switch(Request $request, int $user): RedirectResponse
    {
        app(Plugins::class)->ensure('account_switcher');
        abort_unless($this->switcher->switchTo($request, $user), 403, 'Цей акаунт більше не збережено на пристрої — увійдіть ще раз.');

        return redirect()->route('feed');
    }

    public function forget(Request $request, int $user): JsonResponse
    {
        $this->switcher->forget($request, $user);

        return response()->json(['ok' => true]);
    }
}
