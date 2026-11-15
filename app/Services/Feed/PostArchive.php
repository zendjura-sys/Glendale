<?php

namespace App\Services\Feed;

use App\Models\Post;
use App\Models\User;

/**
 * Автоархів старих записів: автор обирає, скільки днів запис лишається на стіні.
 * Записи не видаляються — лише ховаються в архів, звідки їх можна повернути.
 */
class PostArchive
{
    /** Варіанти автоархіву в днях (0 — вимкнено). */
    public const OPTIONS = [0, 30, 90, 180, 365];

    public function autoDays(User $user): int
    {
        $days = (int) ($user->preferences['auto_archive'] ?? 0);

        return in_array($days, self::OPTIONS, true) ? $days : 0;
    }

    /** Перенести в архів старі записи всіх, хто ввімкнув автоархів. Повертає кількість. */
    public function run(): int
    {
        $total = 0;
        User::query()->whereNotNull('preferences')->where('preferences', 'like', '%auto_archive%')->select(['id', 'preferences'])
            ->chunkById(200, function ($users) use (&$total) {
                foreach ($users as $user) {
                    $days = $this->autoDays($user);
                    if ($days === 0) {
                        continue;
                    }
                    // Лише власні записи на своїй стіні; закріплені, чернетки й заплановані лишаються.
                    $total += Post::query()
                        ->where('author_id', $user->id)
                        ->where('wall_type', $user->getMorphClass())
                        ->where('wall_id', $user->id)
                        ->whereNull('archived_at')
                        ->where('is_draft', false)
                        ->where('is_pinned', false)
                        ->where('created_at', '<', now()->subDays($days))
                        ->update(['archived_at' => now()]);
                }
            });

        return $total;
    }
}
