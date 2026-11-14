<?php

namespace App\Services\Party;

use App\Models\Game;
use App\Models\PartyPost;
use App\Models\TeammateProfile;
use App\Models\User;
use App\Models\UserBlock;
use App\Notifications\PartyInvite;
use App\Services\FriendshipService;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Підбір тиммейтів 2.0: анкета гравця й сумісність із поясненням «чому підходить».
 *
 * Бали: спільні ігри (головне), мова, час гри, рівень, платформа, мікрофон, «шукає зараз» і онлайн.
 * Без спільної мови (коли обидва її вказали) людина в підбір не потрапляє — грати разом не вийде.
 */
class Teammates
{
    /** Скільки триває «Шукаю зараз». */
    public const LOOKING_HOURS = 2;

    /** Анкети, не оновлені стільки днів, у підбір не потрапляють (крім тих, хто шукає зараз). */
    public const STALE_DAYS = 60;

    public function __construct(private readonly FriendshipService $friendships) {}

    public function profile(User $user): ?TeammateProfile
    {
        return TeammateProfile::query()->where('user_id', $user->id)->first();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function save(User $user, array $data): TeammateProfile
    {
        $games = Game::query()->where('is_published', true)->whereIn('slug', $data['games'] ?? [])->limit(8)->pluck('id')->all();

        return TeammateProfile::query()->updateOrCreate(['user_id' => $user->id], [
            'games' => array_values(array_map('intval', $games)),
            'languages' => array_values(array_unique($data['languages'] ?? [])),
            'times' => array_values(array_unique($data['times'] ?? [])),
            'skill' => $data['skill'] ?? null,
            'platform' => $data['platform'] ?? null,
            'mic' => (bool) ($data['mic'] ?? false),
            'note' => filled($data['note'] ?? null) ? trim((string) $data['note']) : null,
            'visible' => (bool) ($data['visible'] ?? true),
        ]);
    }

    public function looking(User $user, bool $on): TeammateProfile
    {
        $profile = $this->profile($user);
        abort_unless($profile !== null, 422, 'Спершу заповніть анкету тиммейта.');
        $profile->update(['looking_until' => $on ? now()->addHours(self::LOOKING_HOURS) : null, 'visible' => $on ? true : $profile->visible]);

        return $profile;
    }

    /**
     * Найкращі тиммейти для людини (від найсумісніших).
     *
     * @return list<array<string, mixed>>
     */
    public function matches(User $viewer, ?int $gameId = null, int $limit = 30): array
    {
        $mine = $this->profile($viewer);
        if (! $mine) {
            return [];
        }

        $friends = array_flip($this->friendships->friendIds($viewer));
        $scored = $this->candidates($viewer)
            ->filter(fn (TeammateProfile $other) => $gameId === null || in_array($gameId, $other->games ?? [], true))
            ->map(fn (TeammateProfile $other) => [$other, $this->score($mine, $other)])
            ->filter(fn (array $pair) => $pair[1] !== null)
            ->sortByDesc(fn (array $pair) => $pair[1]['score'])
            ->take($limit)
            ->values();

        $games = $this->gameNames($scored->flatMap(fn (array $pair) => $pair[0]->games ?? [])->all());

        return array_values($scored->map(fn (array $pair) => $this->card($pair[0], $pair[1], $games, isset($friends[$pair[0]->user_id])))->all());
    }

    /**
     * Хто підходить у паті: ті, хто грає в гру паті, — спершу ті, хто шукає зараз.
     *
     * @return list<array<string, mixed>>
     */
    public function forParty(PartyPost $party, User $owner, int $limit = 8): array
    {
        $party->loadMissing('members');
        $taken = $party->members->pluck('user_id')->push($party->user_id)->all();

        return array_values(array_filter(
            $this->matches($owner, $party->game_id, $limit + count($taken)),
            fn (array $row) => ! in_array($row['user']['id'], $taken, true),
        ));
    }

    /** Запросити гравця у своє відкрите паті (сповіщення з посиланням). */
    public function invite(PartyPost $party, User $from, User $to): void
    {
        $party->loadMissing('members');
        abort_unless($party->user_id === $from->id, 403);
        abort_unless($party->isOpen(), 422, 'Оголошення вже закрите.');
        abort_if($party->members->count() + 1 >= $party->slots, 422, 'Місць більше немає.');
        abort_if($to->id === $from->id || $party->hasMember($to), 422, 'Ця людина вже в паті.');
        abort_if(UserBlock::either($from, $to), 403);
        abort_unless($this->profile($to)?->visible === true, 422, 'Людина не шукає тиммейтів.');

        $key = 'party-invite:'.$from->id;
        abort_if(RateLimiter::tooManyAttempts($key, 20), 429, 'Забагато запрошень — спробуйте пізніше.');
        RateLimiter::hit($key, 3600);
        $once = 'party-invite:'.$party->id.':'.$to->id;
        abort_if(RateLimiter::tooManyAttempts($once, 1), 422, 'Цю людину вже запрошено.');
        RateLimiter::hit($once, 86400);

        $to->notify(new PartyInvite($from, $party));
    }

    /**
     * Видимі анкети, крім своєї, заблокованих в обидва боки й давно не оновлених.
     *
     * @return Collection<int, TeammateProfile>
     */
    private function candidates(User $viewer): Collection
    {
        $blocked = UserBlock::query()->where('user_id', $viewer->id)->pluck('blocked_id')
            ->merge(UserBlock::query()->where('blocked_id', $viewer->id)->pluck('user_id'))->all();

        return TeammateProfile::query()
            ->with('user')
            ->where('visible', true)
            ->where('user_id', '!=', $viewer->id)
            ->whereNotIn('user_id', $blocked)
            ->where(fn ($q) => $q->where('updated_at', '>=', now()->subDays(self::STALE_DAYS))->orWhere('looking_until', '>', now()))
            ->orderByDesc('looking_until')
            ->latest('updated_at')
            ->limit(600)
            ->get()
            ->toBase();
    }

    /**
     * Сумісність двох анкет: бали 0–100 і причини-коди (підписи робить клієнт через tr()).
     * null — разом не пограють (немає спільної мови).
     *
     * @return array{score: int, reasons: list<array<string, mixed>>, games: list<int>}|null
     */
    public function score(TeammateProfile $a, TeammateProfile $b): ?array
    {
        $langA = $a->languages ?? [];
        $langB = $b->languages ?? [];
        if ($langA !== [] && $langB !== [] && array_intersect($langA, $langB) === []) {
            return null;
        }

        $score = 0;
        $reasons = [];
        $games = array_values(array_intersect($a->games ?? [], $b->games ?? []));
        if ($games !== []) {
            $score += 40 + min(10, (count($games) - 1) * 5);
        }
        if ($langA !== [] && $langB !== []) {
            $score += 12;
            $reasons[] = ['type' => 'language'];
        }
        $times = array_values(array_intersect($a->times ?? [], $b->times ?? []));
        if ($times !== []) {
            $score += 15;
            $reasons[] = ['type' => 'time', 'times' => $times];
        }
        $levels = array_keys(TeammateProfile::SKILLS);
        if ($a->skill && $b->skill) {
            $gap = abs((int) array_search($a->skill, $levels, true) - (int) array_search($b->skill, $levels, true));
            $score += [0 => 10, 1 => 5][$gap] ?? 0;
            if ($gap <= 1) {
                $reasons[] = ['type' => $gap === 0 ? 'skill_same' : 'skill_near'];
            }
        }
        if ($a->platform && $a->platform === $b->platform) {
            $score += 5;
            $reasons[] = ['type' => 'platform'];
        }
        if ($a->mic && $b->mic) {
            $score += 5;
            $reasons[] = ['type' => 'mic'];
        }
        if ($b->isLooking()) {
            $score += 10;
            $reasons[] = ['type' => 'looking'];
        }
        if ($b->user->is_online) {
            $score += 3;
        }

        return ['score' => min(100, $score), 'reasons' => $reasons, 'games' => $games];
    }

    /**
     * @param  array{score: int, reasons: list<array<string, mixed>>, games: list<int>}  $match
     * @param  array<int, string>  $names
     * @return array<string, mixed>
     */
    private function card(TeammateProfile $profile, array $match, array $names, bool $friend): array
    {
        $shared = array_values(array_filter(array_map(fn (int $id) => $names[$id] ?? null, $match['games'])));

        return [
            'user' => $profile->user->toCard(),
            'score' => $match['score'],
            'reasons' => [...array_map(fn (string $name) => ['type' => 'game', 'name' => $name], array_slice($shared, 0, 2)), ...$match['reasons']],
            'games' => array_values(array_filter(array_map(fn (int $id) => $names[$id] ?? null, $profile->games ?? []))),
            'skill' => $profile->skill,
            'platform' => $profile->platform,
            'mic' => $profile->mic,
            'note' => $profile->note,
            'looking' => $profile->isLooking(),
            'friend' => $friend,
        ];
    }

    /**
     * @param  array<int, int>  $ids
     * @return array<int, string>
     */
    private function gameNames(array $ids): array
    {
        return $ids === [] ? [] : Game::query()->whereIn('id', array_unique($ids))->pluck('name', 'id')->all();
    }

    /**
     * Анкета для форми (ігри — slug і назва).
     *
     * @return array<string, mixed>|null
     */
    public function form(User $user): ?array
    {
        $profile = $this->profile($user);
        if (! $profile) {
            return null;
        }
        $games = Game::query()->whereIn('id', $profile->games ?? [])->get(['slug', 'name']);

        return [
            'games' => array_values($games->map(fn (Game $g) => ['slug' => $g->slug, 'name' => $g->name])->all()),
            'languages' => $profile->languages ?? [],
            'times' => $profile->times ?? [],
            'skill' => $profile->skill,
            'platform' => $profile->platform,
            'mic' => $profile->mic,
            'note' => $profile->note,
            'visible' => $profile->visible,
            'looking_until' => $profile->isLooking() ? $profile->looking_until?->toIso8601String() : null,
        ];
    }
}
