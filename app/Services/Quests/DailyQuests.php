<?php

namespace App\Services\Quests;

use App\Models\Comment;
use App\Models\Friendship;
use App\Models\Like;
use App\Models\Moment;
use App\Models\PartyMember;
use App\Models\PartyPost;
use App\Models\Photo;
use App\Models\Post;
use App\Models\QuestClaim;
use App\Models\ServerVote;
use App\Models\Story;
use App\Models\User;
use App\Services\Servers\ServerVotes;
use App\Support\Modules\ModuleManager;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Щоденні завдання: щодня три завдання з пулу (з GameCon+ — ще одне бонусне) (для кожного — свої), прогрес — за реальною
 * активністю за сьогодні, нагорода — досвід у рівень і очки сезону. Сезон — календарний місяць.
 */
class DailyQuests
{
    public const PER_DAY = 3;

    /** Бонусні завдання GameCon+ не потрапляють у таблицю сезону. */
    public const BONUS_SEASON = 'bonus';

    private const TZ = 'Europe/Kyiv';

    /**
     * Пул: назва, ціль, досвід, модуль сайту (без нього завдання не випадає), іконка Lucide.
     *
     * @var array<string, array{title: string, target: int, xp: int, module: string|null, icon: string}>
     */
    public const POOL = [
        'post' => ['title' => 'Опублікуйте запис', 'target' => 1, 'xp' => 20, 'module' => 'feed', 'icon' => 'pen-line'],
        'comment' => ['title' => 'Залиште 3 коментарі', 'target' => 3, 'xp' => 15, 'module' => 'feed', 'icon' => 'message-circle'],
        'like' => ['title' => 'Вподобайте 5 записів', 'target' => 5, 'xp' => 10, 'module' => 'feed', 'icon' => 'heart'],
        'vote' => ['title' => 'Проголосуйте за сервер', 'target' => 1, 'xp' => 15, 'module' => 'servers', 'icon' => 'vote'],
        'moment' => ['title' => 'Поділіться моментом', 'target' => 1, 'xp' => 25, 'module' => 'moments', 'icon' => 'clapperboard'],
        'party' => ['title' => 'Створіть паті або приєднайтеся до неї', 'target' => 1, 'xp' => 20, 'module' => 'party', 'icon' => 'user-round-search'],
        'friend' => ['title' => 'Додайте друга', 'target' => 1, 'xp' => 10, 'module' => null, 'icon' => 'user-plus'],
        'photo' => ['title' => 'Завантажте фото', 'target' => 1, 'xp' => 10, 'module' => 'photos', 'icon' => 'image'],
        'story' => ['title' => 'Опублікуйте сторіс', 'target' => 1, 'xp' => 15, 'module' => null, 'icon' => 'circle-play'],
    ];

    public function __construct(private readonly ModuleManager $modules) {}

    public function today(): Carbon
    {
        return Carbon::now(self::TZ)->startOfDay();
    }

    public function season(?Carbon $at = null): string
    {
        return ($at ?? Carbon::now(self::TZ))->format('Y-m');
    }

    /**
     * Три завдання дня для людини — однакові протягом дня, різні в різних людей.
     *
     * @return list<string>
     */
    public function picks(User $user): array
    {
        $pool = array_keys(array_filter(self::POOL, fn (array $q) => $q['module'] === null || $this->modules->enabled($q['module'])));
        usort($pool, fn (string $a, string $b) => crc32($user->id.'|'.$this->today()->toDateString().'|'.$a) <=> crc32($user->id.'|'.$this->today()->toDateString().'|'.$b));

        // GameCon+: четверте, бонусне завдання — досвід у рівень, але без очок сезону.
        return array_slice($pool, 0, self::PER_DAY + ($user->isPlus() ? 1 : 0));
    }

    /**
     * Завдання дня з прогресом.
     *
     * @return list<array{key: string, title: string, icon: string, target: int, progress: int, xp: int, done: bool, claimed: bool, bonus: bool}>
     */
    public function board(User $user): array
    {
        $claimed = QuestClaim::query()->where('user_id', $user->id)->where('day', $this->today()->toDateString())->pluck('quest')->all();
        $rows = [];
        foreach ($this->picks($user) as $i => $key) {
            $quest = self::POOL[$key];
            $progress = min($quest['target'], $this->progress($user, $key));
            $rows[] = [
                'key' => $key,
                'title' => $quest['title'],
                'icon' => $quest['icon'],
                'target' => $quest['target'],
                'progress' => $progress,
                'xp' => $quest['xp'],
                'done' => $progress >= $quest['target'],
                'claimed' => in_array($key, $claimed, true),
                'bonus' => $i >= self::PER_DAY,
            ];
        }

        return $rows;
    }

    public function claim(User $user, string $key): int
    {
        $picks = $this->picks($user);
        if (! in_array($key, $picks, true)) {
            throw ValidationException::withMessages(['quest' => 'Сьогодні такого завдання немає.']);
        }
        $quest = self::POOL[$key];
        if ($this->progress($user, $key) < $quest['target']) {
            throw ValidationException::withMessages(['quest' => 'Завдання ще не виконано.']);
        }
        $created = QuestClaim::query()->firstOrCreate(
            ['user_id' => $user->id, 'quest' => $key, 'day' => $this->today()->toDateString()],
            ['season' => array_search($key, $picks, true) >= self::PER_DAY ? self::BONUS_SEASON : $this->season(), 'xp' => $quest['xp']],
        );
        if (! $created->wasRecentlyCreated) {
            throw ValidationException::withMessages(['quest' => 'Нагороду вже отримано.']);
        }
        Cache::forget("achievements.{$user->id}");

        return $quest['xp'];
    }

    /** Увесь досвід із завдань (для рівня в Achievements). */
    public function totalXp(User $user): int
    {
        return (int) QuestClaim::query()->where('user_id', $user->id)->sum('xp');
    }

    public function completed(User $user): int
    {
        return QuestClaim::query()->where('user_id', $user->id)->count();
    }

    /**
     * Таблиця сезону: топ-50 і місце людини.
     *
     * @return array{season: string, ends_at: string, top: list<array{place: int, points: int, user: array<string, mixed>}>, me: array{place: int|null, points: int}}
     */
    public function leaderboard(User $viewer, ?string $season = null): array
    {
        $season ??= $this->season();
        $rows = QuestClaim::query()->where('season', $season)
            ->select('user_id', DB::raw('sum(xp) as points'))
            ->groupBy('user_id')->orderByDesc('points')->orderBy('user_id')->limit(50)->get();
        $users = User::query()->whereIn('id', $rows->pluck('user_id'))->get()->keyBy('id');
        $top = [];
        foreach ($rows as $i => $row) {
            $user = $users->get($row->user_id);
            if ($user instanceof User) {
                $top[] = ['place' => $i + 1, 'points' => (int) $row->getAttribute('points'), 'user' => $user->toCard()];
            }
        }
        $mine = (int) QuestClaim::query()->where('season', $season)->where('user_id', $viewer->id)->sum('xp');
        $place = $mine > 0
            ? 1 + DB::query()->fromSub(QuestClaim::query()->where('season', $season)->select('user_id')->groupBy('user_id')->havingRaw('sum(xp) > ?', [$mine]), 'ahead')->count()
            : null;

        return [
            'season' => $season,
            'ends_at' => Carbon::createFromFormat('Y-m', $season, self::TZ)->endOfMonth()->toIso8601String(),
            'top' => $top,
            'me' => ['place' => $place, 'points' => $mine],
        ];
    }

    public function progress(User $user, string $key): int
    {
        $from = $this->today()->utc();
        $since = fn ($query, string $column = 'created_at') => $query->where($column, '>=', $from);

        return match ($key) {
            'post' => $since(Post::query()->where('author_id', $user->id)->where('is_draft', false))->count(),
            'comment' => $since(Comment::query()->where('user_id', $user->id))->count(),
            'like' => $since(Like::query()->where('user_id', $user->id)->where('likeable_type', 'post'))->count(),
            'vote' => ServerVote::query()->where('user_id', $user->id)->where('voted_on', app(ServerVotes::class)->today())->count(),
            'moment' => $since(Moment::query()->where('user_id', $user->id))->count(),
            'party' => $since(PartyPost::query()->where('user_id', $user->id))->count() + $since(PartyMember::query()->where('user_id', $user->id))->count(),
            'friend' => $since(Friendship::query()->where('requester_id', $user->id))->count(),
            'photo' => $since(Photo::query()->where('user_id', $user->id))->count(),
            'story' => $since(Story::query()->where('user_id', $user->id))->count(),
            default => 0,
        };
    }
}
