<?php

namespace App\Http\Controllers;

use App\Models\Game;
use App\Models\User;
use App\Services\Games\SteamAchievements;
use App\Services\Profile\MySetup;
use App\Services\Profile\StreamSchedule;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** «Мій сетап», досягнення Steam на сторінці людини та гри, мемогенератор. */
class SetupController extends Controller
{
    public function update(Request $request, MySetup $setup): RedirectResponse
    {
        app(Plugins::class)->ensure('my_setup');
        $rules = ['public' => ['required', 'boolean'], 'cpu' => ['nullable', 'string', 'max:80'], 'gpu' => ['nullable', 'string', 'max:80'], 'ram' => ['nullable', 'integer', 'min:1', 'max:512']];
        foreach (MySetup::FIELDS as $field) {
            $rules[$field] = ['nullable', 'string', 'max:80'];
        }
        $setup->save($request->user(), $request->validate($rules));
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Сетап збережено.']);

        return back();
    }

    /** Розклад стрімів: до 7 щотижневих слотів. */
    public function schedule(Request $request, StreamSchedule $schedule): RedirectResponse
    {
        app(Plugins::class)->ensure('stream_schedule');
        $data = $request->validate([
            'slots' => ['present', 'array', 'max:'.StreamSchedule::MAX],
            'slots.*.day' => ['required', 'integer', 'between:1,7'],
            'slots.*.time' => ['required', 'date_format:H:i'],
            'slots.*.title' => ['nullable', 'string', 'max:60'],
        ]);
        $schedule->save($request->user(), $data['slots']);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Розклад збережено.']);

        return back();
    }

    /** Мемогенератор (усе малюється в браузері; публікація — звичайний запис із картинкою). */
    public function meme(): Response
    {
        app(Plugins::class)->ensure('meme_maker');

        return Inertia::render('memes/create');
    }

    /** Досягнення Steam людини: три найдовше зіграні ігри з прогресом і рідкісними відкритими. */
    public function achievements(User $user, SteamAchievements $achievements): JsonResponse
    {
        app(Plugins::class)->ensure('steam_achievements');
        abort_if($user->is_private || $user->frozen_at !== null, 404);

        return response()->json(['games' => $achievements->showcase($user)]);
    }

    /** Мої досягнення в цій грі (на її сторінці). */
    public function game(Request $request, Game $game, SteamAchievements $achievements): JsonResponse
    {
        app(Plugins::class)->ensure('steam_achievements');
        $appId = $game->steamAppId();

        return response()->json(['data' => $appId !== null ? $achievements->forApp($request->user(), $appId) : null, 'linked' => $request->user()->steam_id !== null]);
    }
}
