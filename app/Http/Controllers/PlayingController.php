<?php

namespace App\Http\Controllers;

use App\Models\Game;
use App\Models\GtaServer;
use App\Models\User;
use App\Services\Presence\DiscordPresence;
use App\Services\Presence\PlayingStatus;
use App\Services\Presence\SteamPresence;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * «Граю в…»: налаштування автоматичного статусу (Discord, Steam, телефон) і ручний вибір.
 */
class PlayingController extends Controller
{
    public function __construct(private readonly PlayingStatus $status) {}

    /** Стан для діалогу налаштувань. */
    public function show(Request $request, DiscordPresence $discord, SteamPresence $steam): JsonResponse
    {
        $user = $this->user($request);

        return response()->json([
            'playing' => $user->playing(),
            'auto' => $user->playing_auto,
            'discord' => ['linked' => $user->discord_id !== null, 'available' => $discord->configured()],
            'steam' => ['linked' => $user->steam_id !== null, 'available' => $steam->configured(), 'profile' => $user->steam_id ? 'https://steamcommunity.com/profiles/'.$user->steam_id : null],
            'xbox' => (string) $user->pref('xbox', ''),
            'playstation' => (string) $user->pref('playstation', ''),
            'hours' => PlayingStatus::MANUAL_HOURS,
        ]);
    }

    /** Пошук сервера GTA чи гри для ручного вибору. */
    public function search(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));
        $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $q).'%';

        return response()->json([
            'servers' => GtaServer::query()->where('status', GtaServer::STATUS_PUBLISHED)
                ->when($q !== '', fn ($query) => $query->where('name', 'like', $like))
                ->orderByDesc('players_online')->limit(8)->get()
                ->map(fn (GtaServer $s) => ['kind' => 'server', 'id' => $s->id, 'label' => $s->name, 'icon' => $s->icon, 'hint' => $s->platform === 'mobile' ? 'GTA · телефон' : 'GTA · ПК'])->values(),
            'games' => Game::query()->published()
                ->when($q !== '', fn ($query) => $query->where(fn ($w) => $w->where('name', 'like', $like)->orWhere('aliases', 'like', $like)))
                ->orderByDesc('popularity')->limit(8)->get()
                ->map(fn (Game $g) => ['kind' => 'game', 'id' => $g->id, 'label' => $g->name, 'icon' => $g->cover, 'hint' => Game::CATEGORIES[$g->category] ?? ''])->values(),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'kind' => ['required', Rule::in(['server', 'game'])],
            'id' => ['required', 'integer'],
            'note' => ['nullable', 'string', 'max:60'],
            'hours' => ['required', 'integer', Rule::in(PlayingStatus::MANUAL_HOURS)],
        ]);
        $this->status->manual($this->user($request), (string) $data['kind'], (int) $data['id'], $data['note'] ?? null, (int) $data['hours']);

        return $this->done('Статус «Граю в…» оновлено.');
    }

    public function destroy(Request $request): RedirectResponse
    {
        $this->status->clear($this->user($request));

        return $this->done('Статус прибрано.');
    }

    public function auto(Request $request): RedirectResponse
    {
        $data = $request->validate(['auto' => ['required', 'boolean']]);
        // Свіжі дані: статус міг поставити бот чи Steam після завантаження сесії.
        $user = $this->user($request)->fresh() ?? $this->user($request);
        $user->forceFill(['playing_auto' => (bool) $data['auto']])->save();
        if (! $data['auto'] && $user->playing_source !== null && $user->playing_source !== PlayingStatus::SOURCE_MANUAL) {
            $this->status->clear($user);
        }

        return $this->done($data['auto'] ? 'Автоматичний статус увімкнено.' : 'Автоматичний статус вимкнено.');
    }

    public function linkSteam(Request $request, SteamPresence $steam): RedirectResponse
    {
        $data = $request->validate(['profile' => ['required', 'string', 'max:200']]);
        $steam->link($this->user($request), (string) $data['profile']);

        return $this->done('Steam прив’язано. Статус з’явиться, щойно ви запустите гру.');
    }

    public function consoles(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'xbox' => ['nullable', 'string', 'max:16', 'regex:/^[A-Za-z0-9 ]*$/'],
            'playstation' => ['nullable', 'string', 'max:16', 'regex:/^[A-Za-z0-9_-]*$/'],
        ]);
        $xbox = trim((string) ($data['xbox'] ?? ''));
        $playstation = trim((string) ($data['playstation'] ?? ''));
        $request->user()->mergePref([
            'xbox' => $xbox !== '' ? $xbox : null,
            'playstation' => $playstation !== '' ? $playstation : null,
        ]);

        return $this->done('Xbox і PlayStation збережено.');
    }

    public function unlinkSteam(Request $request, SteamPresence $steam): RedirectResponse
    {
        $steam->unlink($this->user($request));

        return $this->done('Steam відв’язано.');
    }

    /**
     * Застосунок на Android повідомляє гру на екрані (або що гри немає — package = null).
     */
    public function mobile(Request $request): JsonResponse
    {
        $data = $request->validate([
            'package' => ['nullable', 'string', 'max:160', 'regex:/^[A-Za-z0-9_.]+$/'],
            'label' => ['nullable', 'string', 'max:120'],
        ]);
        $user = $this->user($request);
        $target = isset($data['package']) ? $this->status->fromPackage((string) $data['package'], $data['label'] ?? null) : null;
        $this->status->apply($user, $target, PlayingStatus::SOURCE_MOBILE, 20);

        return response()->json(['playing' => $user->fresh()?->playing()]);
    }

    /** Пакети ігор каталогу, які застосунок може розпізнати (крім категорії «Ігри» самого Android). */
    public function packages(): JsonResponse
    {
        return response()->json(['packages' => $this->status->knownPackages()]);
    }

    private function done(string $message): RedirectResponse
    {
        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);

        return back();
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return $user;
    }
}
