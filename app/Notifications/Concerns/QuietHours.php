<?php

namespace App\Notifications\Concerns;

use App\Support\NotifyPrefs;

/**
 * Соціальні сповіщення мовчать у вибрані години. Нагадування про події лишаються.
 */
class QuietHours
{
    /**
     * @return list<string>
     */
    public static function channels(object $notifiable, ?string $kind = null): array
    {
        return NotifyPrefs::channels($notifiable, $kind);
    }
}
