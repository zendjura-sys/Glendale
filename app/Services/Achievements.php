<?php

namespace App\Services;

use App\Models\Clan;
use App\Models\Comment;
use App\Models\Family;
use App\Models\FamilyEventAttendance;
use App\Models\FamilyMember;
use App\Models\Like;
use App\Models\ListenParty;
use App\Models\Photo;
use App\Models\Post;
use App\Models\Story;
use App\Models\Track;
use App\Models\User;
use App\Models\WatchParty;
use App\Services\Moments\ClipOfWeek;
use App\Services\Quests\DailyQuests;
use App\Services\Quests\SeasonPass;
use App\Services\Servers\ServerVotes;
use App\Support\Modules\ModuleManager;
use App\Support\Plugins\Plugins;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Досягнення й рівні. Рахуються з реальної активності (без окремої таблиці), тож бейджі
 * одразу з’являються й у старих користувачів. Результат кешується на 10 хвилин.
 */
class Achievements
{
    /** Скільки досвіду дає кожна дія. */
    private const XP = [
        'posts' => 10, 'comments' => 2, 'likes' => 1, 'friends' => 5, 'days' => 1,
        'photos' => 3, 'tracks' => 8, 'stories' => 4, 'events' => 15, 'parties' => 10,
        'votes' => ServerVotes::XP,
        'quest_xp' => 1,
        'pass_xp' => 1,
        'referrals' => Referrals::XP,
    ];

    /** Назви рівнів: з якого рівня яка. */
    private const TITLES = [
        1 => 'Новачок', 3 => 'Гравець', 6 => 'Бувалий', 10 => 'Ветеран', 15 => 'Легенда', 25 => 'Міф GameCon',
    ];

    /**
     * Бейджі: лічильник, поріг, назва, опис, іконка Lucide.
     *
     * Бейдж із 'module' показується, лише якщо розділ є в режимі глядача (у «Класиці» — без сімей і кланів).
     *
     * @var list<array{key: string, stat: string, target: int, title: string, text: string, icon: string, module?: string}>
     */
    private const BADGES = [
        ['key' => 'first_post', 'stat' => 'posts', 'target' => 1, 'title' => 'Перший пост', 'text' => 'Опублікувати перший запис.', 'icon' => 'pen-line'],
        ['key' => 'posts_100', 'stat' => 'posts', 'target' => 100, 'title' => '100 постів', 'text' => 'Опублікувати 100 записів.', 'icon' => 'newspaper'],
        ['key' => 'friends_10', 'stat' => 'friends', 'target' => 10, 'title' => 'Компанія', 'text' => 'Мати 10 друзів.', 'icon' => 'users-round'],
        ['key' => 'friends_100', 'stat' => 'friends', 'target' => 100, 'title' => 'Душа компанії', 'text' => 'Мати 100 друзів.', 'icon' => 'party-popper'],
        ['key' => 'likes_100', 'stat' => 'likes', 'target' => 100, 'title' => 'Подобається людям', 'text' => 'Зібрати 100 вподобань на записах.', 'icon' => 'heart'],
        ['key' => 'likes_1000', 'stat' => 'likes', 'target' => 1000, 'title' => 'Зірка', 'text' => 'Зібрати 1000 вподобань на записах.', 'icon' => 'star'],
        ['key' => 'month', 'stat' => 'days', 'target' => 30, 'title' => 'Місяць у GameCon', 'text' => 'Бути з нами 30 днів.', 'icon' => 'calendar-check'],
        ['key' => 'year', 'stat' => 'days', 'target' => 365, 'title' => 'Рік у GameCon', 'text' => 'Бути з нами рік.', 'icon' => 'cake'],
        ['key' => 'family', 'stat' => 'in_family', 'target' => 1, 'title' => 'У сім’ї', 'text' => 'Вступити до сім’ї.', 'icon' => 'house', 'module' => 'families'],
        ['key' => 'family_leader', 'stat' => 'family_leader', 'target' => 1, 'title' => 'Лідер сім’ї', 'text' => 'Очолювати підтверджену сім’ю.', 'icon' => 'crown', 'module' => 'families'],
        ['key' => 'events_10', 'stat' => 'events', 'target' => 10, 'title' => 'Завжди на зборах', 'text' => 'Відвідати 10 подій сім’ї.', 'icon' => 'calendar-days', 'module' => 'families'],
        ['key' => 'clan_founder', 'stat' => 'clan_founder', 'target' => 1, 'title' => 'Засновник клану', 'text' => 'Створити клан або гільдію.', 'icon' => 'swords', 'module' => 'clans'],
        ['key' => 'musician', 'stat' => 'tracks', 'target' => 1, 'title' => 'Музикант', 'text' => 'Завантажити перший трек.', 'icon' => 'music', 'module' => 'music'],
        ['key' => 'photographer', 'stat' => 'photos', 'target' => 50, 'title' => 'Фотограф', 'text' => 'Завантажити 50 фото.', 'icon' => 'camera', 'module' => 'photos'],
        ['key' => 'stories', 'stat' => 'stories', 'target' => 10, 'title' => 'Сторісмейкер', 'text' => 'Опублікувати 10 сторіс.', 'icon' => 'circle-play'],
        ['key' => 'host', 'stat' => 'parties', 'target' => 1, 'title' => 'Ведучий', 'text' => 'Влаштувати спільний перегляд або прослуховування.', 'icon' => 'clapperboard'],
        ['key' => 'verified', 'stat' => 'verified', 'target' => 1, 'title' => 'Верифікований', 'text' => 'Мати підтверджений профіль.', 'icon' => 'badge-check'],
        ['key' => 'voter', 'stat' => 'votes', 'target' => 30, 'title' => 'Голос спільноти', 'text' => 'Проголосувати за сервери 30 разів.', 'icon' => 'vote', 'module' => 'servers'],
        ['key' => 'quests_30', 'stat' => 'quests', 'target' => 30, 'title' => 'Сезонний гравець', 'text' => 'Виконати 30 щоденних завдань.', 'icon' => 'target', 'module' => 'quests'],
        ['key' => 'invite_1', 'stat' => 'referrals', 'target' => 1, 'title' => 'Запросив друга', 'text' => 'Запросити друга, який підтвердив пошту.', 'icon' => 'user-plus'],
        ['key' => 'invite_5', 'stat' => 'referrals', 'target' => 5, 'title' => 'Збирач команди', 'text' => 'Запросити 5 друзів.', 'icon' => 'users-round'],
        ['key' => 'invite_25', 'stat' => 'referrals', 'target' => 25, 'title' => 'Амбасадор GameCon', 'text' => 'Запросити 25 друзів.', 'icon' => 'megaphone'],
        ['key' => 'clip_of_week', 'stat' => 'clip_wins', 'target' => 1, 'title' => 'Кліп тижня', 'text' => 'Ваш кліп переміг у «Кліпі тижня».', 'icon' => 'trophy', 'module' => 'moments'],
        ['key' => 'pioneer', 'stat' => 'pioneer', 'target' => 1, 'title' => 'Перші 100', 'text' => 'Бути серед перших ста користувачів.', 'icon' => 'rocket'],
    ];

    /**
     * Рівень, досвід і бейджі людини.
     *
     * @return array{level: int, title: string, xp: int, level_xp: int, next_xp: int, earned: int, total: int, badges: list<array<string, mixed>>}
     */
    public function for(User $user): array
    {
        /** @var array{level: int, title: string, xp: int, level_xp: int, next_xp: int, earned: int, total: int, badges: list<array<string, mixed>>} */
        $data = Cache::remember("achievements.{$user->id}", now()->addMinutes(10), fn () => $this->compute($user));
        $modules = app(ModuleManager::class);
        $data['badges'] = array_values(array_filter($data['badges'], fn (array $badge) => ! is_string($badge['module'] ?? null) || $modules->enabled($badge['module'])));
        $rarity = $this->rarity();
        $data['badges'] = array_map(fn (array $badge) => [...$badge, 'rarity' => $rarity[$badge['key']] ?? null], $data['badges']);
        $data['earned'] = count(array_filter($data['badges'], fn (array $badge) => (bool) ($badge['earned'] ?? false)));
        $data['total'] = count($data['badges']);

        return $data;
    }

    /**
     * @return array{level: int, title: string, xp: int, level_xp: int, next_xp: int, earned: int, total: int, badges: list<array<string, mixed>>}
     */
    private function compute(User $user): array
    {
        $stats = $this->stats($user);
        $xp = 0;
        foreach (self::XP as $stat => $points) {
            $xp += ($stats[$stat] ?? 0) * $points;
        }
        $level = $this->level($xp);

        $badges = [];
        foreach (self::BADGES as $badge) {
            $current = $stats[$badge['stat']] ?? 0;
            $badges[] = [
                'key' => $badge['key'],
                'title' => $badge['title'],
                'text' => $badge['text'],
                'icon' => $badge['icon'],
                'earned' => $current >= $badge['target'],
                'progress' => min($current, $badge['target']),
                'target' => $badge['target'],
                'module' => $badge['module'] ?? null,
            ];
        }
        $title = 'Новачок';
        foreach (self::TITLES as $from => $name) {
            if ($level >= $from) {
                $title = $name;
            }
        }

        return [
            'level' => $level,
            'title' => $title,
            'xp' => $xp,
            'level_xp' => $this->xpFor($level),
            'next_xp' => $this->xpFor($level + 1),
            'earned' => count(array_filter($badges, fn (array $b) => $b['earned'])),
            'total' => count($badges),
            'badges' => $badges,
        ];
    }

    /** Менше скількох активних людей — рідкість не показуємо (замало даних). */
    public const RARITY_MIN_USERS = 20;

    /**
     * Частка активних людей (у відсотках) з кожним бейджем.
     *
     * @return array<string, float>
     */
    public function rarity(): array
    {
        if (! app(Plugins::class)->on('badge_rarity')) {
            return [];
        }

        /** @var array<string, float> */
        return Cache::remember('achievements.rarity', now()->addHour(), fn () => DB::table('achievement_rarity')
            ->where('total', '>=', self::RARITY_MIN_USERS)->get()
            ->mapWithKeys(fn ($row) => [(string) $row->badge => round($row->holders / max(1, $row->total) * 100, 1)])
            ->all());
    }

    /** Перерахувати рідкість за людьми, що заходили за 90 днів. Повертає, скількох порахували. */
    public function recountRarity(): int
    {
        $holders = array_fill_keys(array_column(self::BADGES, 'key'), 0);
        $total = 0;
        User::query()->whereNull('banned_at')->where('last_seen_at', '>=', now()->subDays(90))
            ->orderBy('id')->chunkById(200, function ($users) use (&$holders, &$total) {
                foreach ($users as $user) {
                    $total++;
                    foreach ($this->compute($user)['badges'] as $badge) {
                        if ($badge['earned']) {
                            $holders[$badge['key']]++;
                        }
                    }
                }
            });
        $now = now();
        DB::table('achievement_rarity')->upsert(
            array_map(fn (string $key) => ['badge' => $key, 'holders' => $holders[$key], 'total' => $total, 'updated_at' => $now], array_keys($holders)),
            ['badge'], ['holders', 'total', 'updated_at'],
        );
        Cache::forget('achievements.rarity');

        return $total;
    }

    /** Досвід, потрібний для рівня: 50·(n−1)² — перші рівні швидкі, далі повільніше. */
    public function xpFor(int $level): int
    {
        return 50 * ($level - 1) ** 2;
    }

    public function level(int $xp): int
    {
        return (int) floor(sqrt(max(0, $xp) / 50)) + 1;
    }

    /**
     * @return array<string, int>
     */
    private function stats(User $user): array
    {
        $memberIds = FamilyMember::query()->where('user_id', $user->id)->pluck('id')->all();

        return [
            'posts' => Post::query()->where('author_id', $user->id)->where('is_draft', false)->where(fn ($query) => $query->whereNull('publish_at')->orWhere('publish_at', '<=', now()))->count(),
            'comments' => Comment::query()->where('user_id', $user->id)->count(),
            'likes' => Like::query()->where('likeable_type', 'post')
                ->whereIn('likeable_id', Post::query()->where('author_id', $user->id)->select('id'))
                ->where('user_id', '!=', $user->id)->count(),
            'friends' => count(app(FriendshipService::class)->friendIds($user)),
            'days' => $user->created_at ? (int) $user->created_at->diffInDays(now(), true) : 0,
            'photos' => Photo::query()->where('user_id', $user->id)->count(),
            'tracks' => Track::query()->where('user_id', $user->id)->count(),
            'stories' => Story::query()->where('user_id', $user->id)->count(),
            'events' => $memberIds === [] ? 0 : FamilyEventAttendance::query()->whereIn('member_id', $memberIds)->where('status', FamilyEventAttendance::STATUS_ATTENDED)->count(),
            'parties' => WatchParty::query()->where('host_id', $user->id)->count() + ListenParty::query()->where('host_id', $user->id)->count(),
            'in_family' => FamilyMember::query()->where('user_id', $user->id)->where('status', FamilyMember::STATUS_ACTIVE)->exists() ? 1 : 0,
            'family_leader' => Family::query()->where('owner_id', $user->id)->where('status', Family::STATUS_VERIFIED)->exists() ? 1 : 0,
            'clan_founder' => Clan::query()->where('owner_id', $user->id)->exists() ? 1 : 0,
            'verified' => $user->is_verified ? 1 : 0,
            'pioneer' => $user->id <= 100 ? 1 : 0,
            'votes' => app(ServerVotes::class)->countFor($user),
            'quest_xp' => app(DailyQuests::class)->totalXp($user),
            'pass_xp' => app(SeasonPass::class)->bonusXp($user),
            'quests' => app(DailyQuests::class)->completed($user),
            'referrals' => app(Referrals::class)->active($user),
            'clip_wins' => app(ClipOfWeek::class)->wins($user),
        ];
    }
}
