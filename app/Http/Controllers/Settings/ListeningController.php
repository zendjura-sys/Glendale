<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * «Показувати, що я слухаю» — одне налаштування для сайту й застосунку (треки GameCon, радіо, Spotify).
 */
class ListeningController extends Controller
{
    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate(['show_listening' => ['required', 'boolean']]);
        $user = $this->user($request);
        $user->mergePref(['show_listening' => (bool) $data['show_listening']]);
        // Кеш «Зараз грає» спільний для всіх глядачів — скидаємо, щоб зміна діяла одразу.
        Cache::forget('music.now.'.$user->id);

        return back();
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return $user;
    }
}
