<?php

namespace App\Services\Games;

use App\Models\Game;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * «Гра року» спільноти: номінації, голосування в грудні (один голос у номінації), результати з 1 січня.
 * Номінанти — ігри каталогу, що підходять номінації (жанр, платформа, рік виходу).
 */
class GameAwards
{
    /** @var array<string, array{label: string, hint: string}> */
    public const CATEGORIES = [
        'goty' => ['label' => 'Гра року', 'hint' => 'Головна номінація — будь-яка гра, у яку ви грали цього року.'],
        'newcomer' => ['label' => 'Новинка року', 'hint' => 'Ігри, що вийшли цього року.'],
        'shooter' => ['label' => 'Найкращий шутер', 'hint' => 'Шутери й королівські битви.'],
        'strategy' => ['label' => 'Стратегія чи MOBA', 'hint' => 'Стратегії, тактика, MOBA, Tower Defense.'],
        'survival' => ['label' => 'Виживання й відкритий світ', 'hint' => 'Виживання, пісочниці, відкриті світи.'],
        'coop' => ['label' => 'Найкращий кооператив', 'hint' => 'Ігри, які найкраще проходити з друзями.'],
        'mobile' => ['label' => 'Найкраща мобільна', 'hint' => 'Ігри для телефона.'],
        'anticipated' => ['label' => 'Найочікуваніша', 'hint' => 'Ще не вийшли — чекаємо наступного року.'],
    ];

    /** @var array<string, list<string>> */
    private const GENRES = [
        'shooter' => ['Шутер', 'Королівська битва'],
        'strategy' => ['Стратегія', 'MOBA', 'Тактика', 'Tower Defense'],
        'survival' => ['Виживання', 'Пісочниця', 'Відкритий світ'],
    ];

    /** Голосують акаунти, старші за тиждень, — менше накруток. */
    public const MIN_ACCOUNT_DAYS = 7;

    public function now(): CarbonImmutable
    {
        return CarbonImmutable::now('Europe/Kyiv');
    }

    /** Рік премії, який зараз на сторінці: у грудні — поточний (голосування), інакше — минулий (результати). */
    public function currentYear(): int
    {
        $now = $this->now();

        return $now->month === 12 ? $now->year : $now->year - 1;
    }

    /** @return 'soon'|'voting'|'results' */
    public function phase(int $year): string
    {
        $now = $this->now();

        return match (true) {
            $now->lt($this->opensAt($year)) => 'soon',
            $now->lt($this->closesAt($year)) => 'voting',
            default => 'results',
        };
    }

    public function opensAt(int $year): CarbonImmutable
    {
        return CarbonImmutable::create($year, 12, 1, 0, 0, 0, 'Europe/Kyiv') ?? $this->now();
    }

    public function closesAt(int $year): CarbonImmutable
    {
        return CarbonImmutable::create($year + 1, 1, 1, 0, 0, 0, 'Europe/Kyiv') ?? $this->now();
    }

    /**
     * Ігри, що підходять номінації.
     *
     * @return Builder<Game>
     */
    public function eligible(int $year, string $category): Builder
    {
        $query = Game::query()->published();

        return match ($category) {
            'newcomer' => $query->whereYear('released', $year),
            'anticipated' => $query->where(fn ($q) => $q->whereNull('released')->orWhere('released', '>', CarbonImmutable::create($year, 12, 31))),
            'mobile' => $query->where('category', 'mobile'),
            'coop' => $query->where(fn ($q) => $q->whereJsonContains('modes', 'coop')->orWhereJsonContains('genres', 'Кооператив')),
            'shooter', 'strategy', 'survival' => $query->where(function ($q) use ($category) {
                foreach (self::GENRES[$category] as $genre) {
                    $q->orWhereJsonContains('genres', $genre);
                }
            }),
            default => $query,
        };
    }

    /**
     * Номінанти для вибору (з пошуком), без лічильників голосів — щоб не голосували «за лідером».
     *
     * @return list<array<string, mixed>>
     */
    public function candidates(int $year, string $category, string $search = ''): array
    {
        $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $search).'%';

        return array_values($this->eligible($year, $category)
            ->when($search !== '', fn ($q) => $q->where(fn ($w) => $w->where('name', 'like', $like)->orWhere('aliases', 'like', $like)))
            ->orderByDesc('popularity')->limit(24)->get()
            ->map(fn (Game $g) => $g->toCard())->all());
    }

    /**
     * Мій вибір у кожній номінації.
     *
     * @return array<string, array<string, mixed>>
     */
    public function mine(User $user, int $year): array
    {
        $votes = DB::table('goty_votes')->where('year', $year)->where('user_id', $user->id)->pluck('game_id', 'category');
        $games = Game::query()->whereIn('id', $votes->values())->get()->keyBy('id');
        $out = [];
        foreach ($votes as $category => $gameId) {
            $game = $games->get($gameId);
            if ($game !== null) {
                $out[(string) $category] = $game->toCard();
            }
        }

        return $out;
    }

    /** Голос (або зміна голосу) у номінації. */
    public function vote(User $user, int $year, string $category, Game $game): void
    {
        abort_unless(isset(self::CATEGORIES[$category]), 422, 'Такої номінації немає.');
        abort_unless($this->phase($year) === 'voting', 422, 'Голосування зараз закрите.');
        abort_if($user->created_at !== null && $user->created_at->gt($this->now()->subDays(self::MIN_ACCOUNT_DAYS)), 422, 'Голосувати можна через тиждень після реєстрації.');
        abort_unless($this->eligible($year, $category)->whereKey($game->id)->exists(), 422, 'Ця гра не підходить номінації.');
        DB::table('goty_votes')->updateOrInsert(
            ['year' => $year, 'category' => $category, 'user_id' => $user->id],
            ['game_id' => $game->id, 'updated_at' => now(), 'created_at' => now()],
        );
    }

    public function unvote(User $user, int $year, string $category): void
    {
        abort_unless($this->phase($year) === 'voting', 422, 'Голосування зараз закрите.');
        DB::table('goty_votes')->where('year', $year)->where('category', $category)->where('user_id', $user->id)->delete();
    }

    /**
     * Підсумки: п’ять лідерів кожної номінації з відсотками.
     *
     * @return array<string, array{total: int, top: list<array<string, mixed>>}>
     */
    public function results(int $year): array
    {
        $rows = DB::table('goty_votes')->where('year', $year)
            ->select('category', 'game_id', DB::raw('count(*) as votes'))
            ->groupBy('category', 'game_id')->get();
        $games = Game::query()->whereIn('id', $rows->pluck('game_id')->unique())->get()->keyBy('id');
        $out = [];
        foreach (array_keys(self::CATEGORIES) as $category) {
            $list = $rows->where('category', $category)->sortByDesc('votes')->values();
            $total = (int) $list->sum('votes');
            $top = [];
            foreach ($list->take(5) as $row) {
                $game = $games->get($row->game_id);
                if ($game === null) {
                    continue;
                }
                $top[] = [...$game->toCard(), 'votes' => (int) $row->votes, 'percent' => $total > 0 ? (int) round($row->votes * 100 / $total) : 0];
            }
            $out[$category] = ['total' => $total, 'top' => $top];
        }

        return $out;
    }

    /**
     * Роки, за які вже є підсумки (для перемикача).
     *
     * @return list<int>
     */
    public function archive(): array
    {
        return array_values(DB::table('goty_votes')->distinct()->orderByDesc('year')->pluck('year')
            ->map(fn ($y) => (int) $y)
            ->filter(fn (int $y) => $this->phase($y) === 'results')
            ->all());
    }

    /** Скільки людей проголосувало хоча б раз. */
    public function voters(int $year): int
    {
        return DB::table('goty_votes')->where('year', $year)->distinct()->count('user_id');
    }
}
