<?php

namespace App\Support\Profile;

use App\Models\Track;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Пісня на сторінці людини: власна чи з медіатеки; грає лише після натискання (без автозапуску).
 */
class ProfileTrack
{
    /** @return array<string, mixed>|null */
    public static function of(User $user): ?array
    {
        $id = $user->pref('profile_track');
        if (! is_numeric($id)) {
            return null;
        }
        $track = Track::query()->find((int) $id);

        return $track !== null && ! $track->processing ? $track->toCard() : null;
    }

    /** Поставити пісню (свою або з медіатеки) чи прибрати (null). */
    public static function set(User $user, ?int $trackId): void
    {
        if ($trackId !== null) {
            $allowed = Track::query()->whereKey($trackId)->where('user_id', $user->id)->exists()
                || DB::table('music_library')->where('user_id', $user->id)->where('track_id', $trackId)->exists();
            abort_unless($allowed, 422, 'Оберіть пісню зі своєї медіатеки.');
        }
        $user->mergePref(['profile_track' => $trackId]);
    }
}
