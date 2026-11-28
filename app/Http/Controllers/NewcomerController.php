<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/** Сховати картку «Тиждень новачка»; тур по розділах пройдено чи пропущено. */
class NewcomerController extends Controller
{
    /** Скільки днів після реєстрації тур пропонується сам (далі — лише з довідки). */
    public const TOUR_DAYS = 14;

    public static function tourPending(User $user): bool
    {
        return $user->pref('tour_done') !== true && $user->created_at?->gt(now()->subDays(self::TOUR_DAYS)) === true;
    }

    public function tourDone(Request $request): JsonResponse
    {
        $request->user()->mergePref(['tour_done' => true]);

        return response()->json(['ok' => true]);
    }

    public function hide(Request $request): RedirectResponse
    {
        $request->user()->mergePref(['newcomer_hidden' => true]);

        return back();
    }
}
