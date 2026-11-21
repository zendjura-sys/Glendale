<?php

namespace App\Services\Profile;

use App\Models\User;
use App\Models\UserCosmetic;
use App\Notifications\LevelUp;
use App\Services\Achievements;
use App\Services\Quests\SeasonPass;

/**
 * Рівень профілю: досвід з активності (App\Services\Achievements), назви рівнів, нагороди
 * за віхи (косметика в інвентар сезонного пропуску) і сповіщення про новий рівень.
 */
class ProfileLevel
{
    /** Рівень → нагорода (косметика з config/season_pass.php). */
    public const REWARDS = [
        5 => ['type' => 'frame', 'value' => 'lvl_bronze'],
        10 => ['type' => 'frame', 'value' => 'lvl_veteran'],
        15 => ['type' => 'frame', 'value' => 'lvl_legend'],
        25 => ['type' => 'badge', 'value' => 'lvl_myth'],
    ];

    public function __construct(private readonly Achievements $achievements) {}

    /**
     * Звірити рівень: видати нагороди за пройдені віхи й сповістити про новий рівень (раз на рівень).
     * Перший виклик лише запам'ятовує рівень — щоб старі акаунти не отримали лавину сповіщень.
     */
    public function sync(User $user): int
    {
        $level = $this->achievements->for($user)['level'];
        $seen = $user->pref('level_seen');
        foreach (self::REWARDS as $at => $reward) {
            if ($level >= $at) {
                UserCosmetic::query()->firstOrCreate(
                    ['user_id' => $user->id, 'type' => $reward['type'], 'value' => $reward['value']],
                    ['source' => 'level:'.$at],
                );
            }
        }
        if (! is_int($seen) || $level > $seen) {
            if (is_int($seen)) {
                $user->notify(new LevelUp($level, $this->achievements->for($user)['title']));
            }
            $user->mergePref(['level_seen' => $level]);
        }

        return $level;
    }

    /**
     * Сторінка «Рівень і досвід».
     *
     * @return array<string, mixed>
     */
    public function page(User $user): array
    {
        $this->sync($user);
        $data = $this->achievements->for($user);
        $pass = app(SeasonPass::class);

        return [
            'level' => $data['level'],
            'title' => $data['title'],
            'xp' => $data['xp'],
            'level_xp' => $data['level_xp'],
            'next_xp' => $data['next_xp'],
            'sources' => array_values(array_filter($data['sources'] ?? [], fn (array $s) => $s['per'] > 0)),
            'titles' => collect($this->achievements->titles())->map(fn (string $name, int $from) => ['from' => $from, 'name' => $name, 'xp' => $this->achievements->xpFor($from)])->values(),
            'rewards' => collect(self::REWARDS)->map(fn (array $r, int $at) => ['level' => $at, 'reward' => $pass->reward($r), 'reached' => $data['level'] >= $at])->values(),
            'earned' => $data['earned'],
            'total' => $data['total'],
        ];
    }
}
