<?php

namespace App\Http\Controllers;

use App\Models\Game;
use App\Models\GtaServer;
use App\Models\PartyPost;
use App\Models\User;
use App\Models\UserBlock;
use App\Notifications\PartyInvite;
use App\Services\FriendshipService;
use App\Services\Party\PartyBoard;
use App\Services\Presence\DiscordPresence;
use App\Services\Presence\PlayingStatus;
use App\Services\Presence\SteamPresence;
use App\Support\Profile\GamerIds;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\RateLimiter;
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
            'ids' => GamerIds::form($user),
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

    /**
     * «Граємо зараз»: друзі, що саме зараз у тій самій грі чи на тому самому сервері.
     */
    public function friends(Request $request, FriendshipService $friendships): JsonResponse
    {
        $user = $this->user($request);
        $mine = $user->playing();

        return response()->json([
            'playing' => $mine,
            'friends' => $mine === null ? [] : $this->sameGame($user, $mine, $friendships)
                ->map(fn (User $f) => ['id' => $f->id, 'name' => $f->name, 'username' => $f->username, 'avatar_url' => $f->avatar_url])->values(),
        ]);
    }

    /**
     * Голосова з друзями в одній грі: паті «Граємо зараз» з голосовою кімнатою (або вже відкрита своя)
     * і запрошення друзям, які зараз у тій самій грі.
     */
    public function voice(Request $request, FriendshipService $friendships, PartyBoard $board): RedirectResponse|JsonResponse
    {
        $user = $this->user($request);
        $mine = $user->playing();
        abort_if($mine === null || $mine['id'] === null, 422, 'Спершу вкажіть, у що граєте.');
        $column = $mine['kind'] === 'server' ? 'gta_server_id' : 'game_id';
        $party = PartyPost::query()->open()->where('user_id', $user->id)->where($column, $mine['id'])
            ->where('created_at', '>=', now()->subHours(6))->latest('id')->first()
            ?? $board->create($user, [
                'title' => 'Граємо зараз: '.$mine['label'],
                'note' => 'Голосова для друзів, що зараз у грі.',
                'slots' => 10,
                $column => (int) $mine['id'],
                'mic_required' => false,
            ]);
        $invited = 0;
        foreach ($this->sameGame($user, $mine, $friendships)->take(9) as $friend) {
            if ($party->hasMember($friend) || UserBlock::either($user, $friend)) {
                continue;
            }
            // Одне запрошення в це паті на людину.
            if (RateLimiter::tooManyAttempts($key = 'party-invite:'.$party->id.':'.$friend->id, 1)) {
                continue;
            }
            RateLimiter::hit($key, 86400);
            $friend->notify(new PartyInvite($user, $party));
            $invited++;
        }
        $url = '/party/'.$party->id;
        if ($request->wantsJson()) {
            return response()->json(['party_id' => $party->id, 'url' => $url, 'invited' => $invited]);
        }
        Inertia::flash('toast', ['type' => 'success', 'message' => $invited > 0 ? "Голосову створено, запрошено друзів: {$invited}." : 'Голосову створено. Друзів у цій грі зараз немає — поділіться посиланням.']);

        return redirect($url);
    }

    /**
     * @param  array<string, mixed>  $mine
     * @return Collection<int, User>
     */
    private function sameGame(User $user, array $mine, FriendshipService $friendships): Collection
    {
        return User::query()->whereKey($friendships->friendIds($user))
            ->where('playing_kind', $mine['kind'])->where('playing_ref_id', $mine['id'])
            ->where('playing_until', '>', now())
            ->limit(30)->get();
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

    /** Ігрові ID (Xbox, PlayStation, Epic, Riot…) — зберігаються лише надіслані поля. */
    public function consoles(Request $request): RedirectResponse
    {
        GamerIds::save($request->user(), $request->validate(GamerIds::rules(), GamerIds::messages()));

        return $this->done('Ігрові ID збережено.');
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
