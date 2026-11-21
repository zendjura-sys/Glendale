<?php

namespace App\Services;

use App\Models\User;
use App\Support\Plugins\Plugins;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;

/**
 * Секретні досягнення: умову не показуємо — лише знайти. Відкриті зберігаються в налаштуваннях людини.
 */
class SecretAchievements
{
    /** Ті, що відкриває сам браузер (пасхалки); решту — лише сервер. */
    public const CLIENT = ['konami'];

    public const ALL = ['konami', 'night_owl', 'pumpkin'];

    /**
     * @return list<string>
     */
    public function of(User $user): array
    {
        $list = $user->pref('secrets');

        return is_array($list) ? array_values(array_filter($list, fn ($key) => is_string($key) && in_array($key, self::ALL, true))) : [];
    }

    /** Відкрити; true — якщо це вперше. */
    public function unlock(User $user, string $key): bool
    {
        if (! in_array($key, self::ALL, true) || ! app(Plugins::class)->on('secret_achievements')) {
            return false;
        }
        $have = $this->of($user);
        if (in_array($key, $have, true)) {
            return false;
        }
        $user->mergePref(['secrets' => [...$have, $key]]);
        Cache::forget("achievements.{$user->id}");

        return true;
    }

    /** Запис опубліковано: «Нічна сова» (3–5 ранку за Києвом) і «Гарбуз» (на Хелловін). */
    public function afterPost(User $user, ?CarbonImmutable $now = null): void
    {
        $now = ($now ?? CarbonImmutable::now())->setTimezone('Europe/Kyiv');
        if ($now->hour >= 3 && $now->hour < 5) {
            $this->unlock($user, 'night_owl');
        }
        if ($now->format('md') === '1031') {
            $this->unlock($user, 'pumpkin');
        }
    }
}
