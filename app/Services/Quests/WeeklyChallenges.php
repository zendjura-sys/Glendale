<?php

namespace App\Services\Quests;

use App\Models\QuestClaim;
use App\Models\User;
use App\Support\Modules\ModuleManager;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;

/**
 * Челенджі тижня (№274): два великі завдання на тиждень (пн–нд за Києвом), однакові для всіх —
 * щоб було про що говорити й змагатися. Досвід іде в рівень і в очки сезону, як і завдання дня.
 * Нагорода — у quest_claims з ключем «w:…» і днем = понеділок тижня.
 */
class WeeklyChallenges
{
    public const PER_WEEK = 2;

    private const TZ = 'Europe/Kyiv';

    /**
     * Ціль на тиждень і досвід. Прогрес рахує DailyQuests::progress з понеділка.
     *
     * @var array<string, array{title: string, target: int, xp: int, module: string|null, icon: string}>
     */
    public const POOL = [
        'post' => ['title' => 'Опублікуйте 5 записів', 'target' => 5, 'xp' => 150, 'module' => 'feed', 'icon' => 'pen-line'],
        'comment' => ['title' => 'Залиште 20 коментарів', 'target' => 20, 'xp' => 120, 'module' => 'feed', 'icon' => 'message-circle'],
        'like' => ['title' => 'Вподобайте 40 записів', 'target' => 40, 'xp' => 100, 'module' => 'feed', 'icon' => 'heart'],
        'vote' => ['title' => 'Голосуйте за сервер 5 днів', 'target' => 5, 'xp' => 150, 'module' => 'servers', 'icon' => 'vote'],
        'moment' => ['title' => 'Поділіться 3 моментами', 'target' => 3, 'xp' => 180, 'module' => 'moments', 'icon' => 'clapperboard'],
        'party' => ['title' => 'Зіграйте в 3 паті', 'target' => 3, 'xp' => 150, 'module' => 'party', 'icon' => 'user-round-search'],
        'friend' => ['title' => 'Додайте 3 друзів', 'target' => 3, 'xp' => 120, 'module' => null, 'icon' => 'user-plus'],
        'photo' => ['title' => 'Завантажте 5 фото', 'target' => 5, 'xp' => 100, 'module' => 'photos', 'icon' => 'image'],
        'story' => ['title' => 'Опублікуйте 4 сторіс', 'target' => 4, 'xp' => 120, 'module' => null, 'icon' => 'circle-play'],
    ];

    public function __construct(
        private readonly DailyQuests $daily,
        private readonly ModuleManager $modules,
    ) {}

    public function weekStart(): Carbon
    {
        return Carbon::now(self::TZ)->startOfWeek(Carbon::MONDAY);
    }

    /**
     * Челенджі цього тижня — однакові для всіх (з розділів, що є в режимі людини).
     *
     * @return list<string>
     */
    public function picks(): array
    {
        $week = $this->weekStart()->toDateString();
        $pool = array_keys(array_filter(self::POOL, fn (array $c) => $c['module'] === null || $this->modules->enabled($c['module'])));
        usort($pool, fn (string $a, string $b) => crc32($week.'|'.$a) <=> crc32($week.'|'.$b));

        return array_slice($pool, 0, self::PER_WEEK);
    }

    /**
     * @return list<array{key: string, title: string, icon: string, target: int, progress: int, xp: int, done: bool, claimed: bool, finishers: int}>
     */
    public function board(User $user): array
    {
        $week = $this->weekStart();
        $claims = QuestClaim::query()->where('day', $week->toDateString())->where('quest', 'like', 'w:%');
        $mine = (clone $claims)->where('user_id', $user->id)->pluck('quest')->all();
        $finishers = (clone $claims)->selectRaw('quest, count(*) as n')->groupBy('quest')->pluck('n', 'quest')->all();
        $rows = [];
        foreach ($this->picks() as $key) {
            $challenge = self::POOL[$key];
            $progress = min($challenge['target'], $this->daily->progress($user, $key, $week));
            $rows[] = [
                'key' => $key,
                'title' => $challenge['title'],
                'icon' => $challenge['icon'],
                'target' => $challenge['target'],
                'progress' => $progress,
                'xp' => $challenge['xp'],
                'done' => $progress >= $challenge['target'],
                'claimed' => in_array('w:'.$key, $mine, true),
                // Скільки людей уже виконали — змагальний момент.
                'finishers' => (int) ($finishers['w:'.$key] ?? 0),
            ];
        }

        return $rows;
    }

    public function claim(User $user, string $key): int
    {
        if (! in_array($key, $this->picks(), true)) {
            throw ValidationException::withMessages(['quest' => 'Цього тижня такого челенджу немає.']);
        }
        $challenge = self::POOL[$key];
        $week = $this->weekStart();
        if ($this->daily->progress($user, $key, $week) < $challenge['target']) {
            throw ValidationException::withMessages(['quest' => 'Челендж ще не виконано.']);
        }
        $claim = QuestClaim::query()->firstOrCreate(
            ['user_id' => $user->id, 'quest' => 'w:'.$key, 'day' => $week->toDateString()],
            ['season' => $this->daily->season(), 'xp' => $challenge['xp']],
        );
        if (! $claim->wasRecentlyCreated) {
            throw ValidationException::withMessages(['quest' => 'Нагороду вже отримано.']);
        }
        Cache::forget("achievements.{$user->id}");

        return $challenge['xp'];
    }

    /** Кінець тижня — для таймера «Ще 3 дн.». */
    public function endsAt(): Carbon
    {
        return $this->weekStart()->addWeek();
    }
}
