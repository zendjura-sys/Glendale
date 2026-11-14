<?php

namespace App\Http\Controllers;

use App\Support\Plugins\Plugins;
use App\Support\Profile\Character;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Персонаж-аватар: конструктор (зачіска, обличчя, очі, рот, одяг) у налаштуваннях.
 * Малюється на клієнті з набору чисел; у шоу персонаж «говорить» голосом людини.
 */
class AvatarCharacterController extends Controller
{
    public function edit(Request $request): Response|JsonResponse
    {
        app(Plugins::class)->ensure('characters');
        $data = ['character' => $request->user()->character, 'parts' => Character::PARTS];

        return $request->expectsJson() ? response()->json($data) : Inertia::render('settings/character', $data);
    }

    public function update(Request $request): RedirectResponse|JsonResponse
    {
        app(Plugins::class)->ensure('characters');
        $character = Character::clean($request->input('character'));
        $user = $request->user();
        $user->forceFill(['character' => $character])->save();

        if ($request->expectsJson()) {
            return response()->json(['character' => $character]);
        }
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Персонажа збережено.']);

        return back();
    }

    public function destroy(Request $request): RedirectResponse|JsonResponse
    {
        app(Plugins::class)->ensure('characters');
        $request->user()->forceFill(['character' => null])->save();

        return $request->expectsJson() ? response()->json(['character' => null]) : back();
    }
}
