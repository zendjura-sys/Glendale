<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\Referrals;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Сторінка «Запросити друзів» і перехід за особистим посиланням. */
class ReferralController extends Controller
{
    public function __construct(private readonly Referrals $referrals) {}

    public function index(Request $request): Response
    {
        return Inertia::render('invite/index', $this->referrals->summary($request->user()));
    }

    /** /r/{код}: запам’ятовуємо запрошувача на 30 днів і ведемо на реєстрацію. */
    public function visit(Request $request, string $code): RedirectResponse
    {
        if ($request->user() !== null || ! User::query()->where('invite_code', $code)->exists()) {
            return redirect('/');
        }

        return redirect()->route('register')->withCookie(cookie(Referrals::COOKIE, $code, 60 * 24 * 30));
    }
}
