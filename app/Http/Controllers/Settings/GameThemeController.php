<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\Game;
use App\Models\User;
use App\Support\GameTheme;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Тема профілю за улюбленою грою та звук сповіщень — налаштування оформлення, що зберігаються одразу.
 */
class GameThemeController extends Controller
{
    /** Звуки сповіщень: off — без звуку; решта — короткі мелодії, що синтезуються в браузері. */
    public const SOUNDS = ['off', 'soft', 'pixel', 'arcade', 'drop'];

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate(['game_id' => ['nullable', 'integer']]);
        $user = $this->user($request);
        if (($data['game_id'] ?? null) === null) {
            $user->mergePref([GameTheme::PREF => null]);

            return back();
        }
        $game = Game::query()->published()->whereKey((int) $data['game_id'])->first();
        if ($game === null) {
            throw ValidationException::withMessages(['game_id' => 'Гру не знайдено.']);
        }
        // Палітру рахуємо зараз, щоб сторінка профілю брала готові кольори з кешу.
        if (GameTheme::fromGame($game) === null) {
            throw ValidationException::withMessages(['game_id' => 'Не вдалося взяти кольори з обкладинки цієї гри — оберіть іншу.']);
        }
        $user->mergePref([GameTheme::PREF => $game->id]);

        return back();
    }

    public function sound(Request $request): RedirectResponse
    {
        $data = $request->validate(['notify_sound' => ['required', 'string', 'in:'.implode(',', self::SOUNDS)]]);
        $this->user($request)->mergePref(['notify_sound' => $data['notify_sound']]);

        return back();
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return $user;
    }
}
