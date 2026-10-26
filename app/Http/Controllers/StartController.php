<?php

namespace App\Http\Controllers;

use App\Models\Follow;
use App\Models\Game;
use App\Models\GtaServer;
use App\Models\User;
use App\Services\Phones\PhoneNumbers;
use App\Support\Modules\ModuleManager;
use App\Support\NetworkModes;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class StartController extends Controller
{
    public function index(Request $request, PhoneNumbers $phones): Response|RedirectResponse
    {
        // Онбординг: реєстрація → номер → режим соцмережі → ігри й сервери (лише якщо режим їх показує).
        if ($this->phoneStepPending($request->user(), $phones)) {
            return redirect()->route('start.phone');
        }
        if ($request->user()->pref('network_mode') === null) {
            return redirect()->route('start.mode');
        }

        $modules = app(ModuleManager::class);

        return Inertia::render('start/index', [
            'games' => $modules->enabled('games') ? Game::query()->published()->orderByDesc('popularity')->limit(18)->get()->map->toCard()->values() : [],
            'servers' => $modules->enabled('servers') ? GtaServer::query()->published()->orderByDesc('players_online')->limit(12)->get()->map->toCard()->values() : [],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'games' => ['array', 'max:8'],
            'games.*' => ['integer'],
            'servers' => ['array', 'max:8'],
            'servers.*' => ['integer'],
        ]);
        $user = $request->user();
        foreach (Game::query()->published()->whereIn('id', $data['games'] ?? [])->pluck('id') as $id) {
            Follow::query()->firstOrCreate(['user_id' => $user->id, 'kind' => Follow::GAME, 'subject_id' => $id]);
        }
        foreach (GtaServer::query()->published()->whereIn('id', $data['servers'] ?? [])->pluck('id') as $id) {
            Follow::query()->firstOrCreate(['user_id' => $user->id, 'kind' => Follow::SERVER, 'subject_id' => $id]);
        }
        $user->mergePref(['onboarded' => true]);

        return redirect()->route('feed');
    }

    /** Вибір режиму одразу після реєстрації (сторінка-«лендинг» з описом кожного режиму). */
    public function mode(Request $request, NetworkModes $modes): Response
    {
        return Inertia::render('start/mode', [
            'modes' => $modes->available(),
            'current' => $modes->for($request->user())['id'],
            'moduleNames' => $modes->moduleNames(),
        ]);
    }

    public function chooseMode(Request $request, NetworkModes $modes): RedirectResponse
    {
        $data = $request->validate([
            'mode' => ['required', 'string', 'in:'.implode(',', array_column($modes->available(), 'id'))],
        ]);
        $user = $request->user();
        $user->mergePref(['network_mode' => $data['mode']]);

        return $this->afterMode($user, $modes);
    }

    /** Перший крок після реєстрації — «Твій номер»: випадковий безкоштовний або купити гарний. */
    public function phone(Request $request, PhoneController $phone): Response
    {
        return Inertia::render('start/phone', $phone->pickerProps($request->user()));
    }

    /** Після номера (або «Пізніше») — вибір режиму, далі за планом онбордингу. */
    public function phoneDone(Request $request, NetworkModes $modes): RedirectResponse
    {
        $user = $request->user();
        $user->mergePref(['phone_prompt' => false, 'phone_step' => 'done']);
        if ($user->pref('network_mode') === null) {
            return redirect()->route('start.mode');
        }

        return $this->afterMode($user, $modes);
    }

    /** Новачок ще не пройшов крок номера (і модуль «Телефон» увімкнено). */
    private function phoneStepPending(User $user, PhoneNumbers $phones): bool
    {
        return $user->pref('onboarded') === false && $user->pref('phone_step') !== 'done'
            && app(ModuleManager::class)->enabled('phone') && $phones->current($user) === null;
    }

    private function afterMode(User $user, NetworkModes $modes): RedirectResponse
    {
        // Ігри й сервери — якщо вони є в режимі; інакше одразу до стрічки.
        $visible = $modes->modulesFor($user);
        if ($user->pref('onboarded') === false && (in_array('games', $visible, true) || in_array('servers', $visible, true))) {
            return redirect()->route('start');
        }
        $user->mergePref(['onboarded' => true]);

        return redirect()->route('feed');
    }

    public function skip(Request $request): RedirectResponse
    {
        $request->user()->mergePref(['onboarded' => true]);

        return redirect()->route('feed');
    }
}
