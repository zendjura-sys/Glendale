<?php

namespace App\Notifications\Concerns;

use App\Models\User;

/**
 * Соціальні сповіщення мовчать у вибрані години. Нагадування про події лишаються.
 */
class QuietHours
{
    /**
     * @return list<string>
     */
    public static function channels(object $notifiable): array
    {
        if ($notifiable instanceof User && $notifiable->inQuietHours()) {
            return [];
        }

        return ['database'];
    }
}
