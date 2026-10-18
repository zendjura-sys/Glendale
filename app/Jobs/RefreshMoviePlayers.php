<?php

namespace App\Jobs;

use App\Models\Movie;
use App\Services\Cinema\CinemaService;
use App\Support\Settings\SiteSettings;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Carbon;
use Throwable;

/**
 * Дотягує озвучки тайтлу, коли його відкривають, а плеєри давно не оновлювались: нові озвучки
 * Kodik / Videoseed / FlixCDN додаються, наявні не чіпаються (як «лише нові» у масовій проставці).
 */
class RefreshMoviePlayers implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    /** Оновлювати плеєри тайтлу не частіше, ніж раз на стільки днів. */
    public const STALE_DAYS = 3;

    public int $timeout = 120;

    public int $tries = 1;

    public int $uniqueFor = 3600;

    public function __construct(public readonly int $movieId) {}

    public function uniqueId(): string
    {
        return (string) $this->movieId;
    }

    public static function due(Movie $movie): bool
    {
        if ($movie->synced_at === null || $movie->synced_at->lt(Carbon::now()->subDays(self::STALE_DAYS))) {
            return true;
        }
        // Після оновлення пошуку (міграція ставить мітку) старі плеєри перечитуються одразу.
        $since = app(SiteSettings::class)->get('cinema_players_refetch_at');

        return is_string($since) && $movie->synced_at->lt(Carbon::parse($since));
    }

    public function handle(CinemaService $cinema): void
    {
        $movie = Movie::query()->find($this->movieId);
        if ($movie === null) {
            return;
        }
        try {
            foreach ($cinema->fetchPlayers($movie) as $provider => $sources) {
                if ($sources !== null && $sources !== []) {
                    $cinema->mergeSources($movie, $provider, $sources, false);
                }
            }
        } catch (Throwable $e) {
            report($e);
        }
        $movie->forceFill(['synced_at' => Carbon::now()])->saveQuietly();
    }
}
