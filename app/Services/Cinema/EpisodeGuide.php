<?php

namespace App\Services\Cinema;

use App\Models\Movie;
use Illuminate\Support\Facades\Cache;
use Throwable;

/**
 * Посерійний режим: сезони й серії серіалу (аніме, мультсеріалу) для вибору конкретної серії в плеєрі.
 * Беремо з Videoseed або Kodik, інакше — один сезон із загальної кількості серій. Кеш — 12 годин.
 */
class EpisodeGuide
{
    public function __construct(
        private readonly VideoseedClient $videoseed,
        private readonly KodikClient $kodik,
    ) {}

    /**
     * @return list<array{number: int, episodes: list<int>}>
     */
    public function seasons(Movie $movie): array
    {
        if (! in_array($movie->type, ['serial', 'anime', 'cartoon', 'documentary'], true) && ($movie->episodes_count ?? 0) <= 1) {
            return [];
        }

        $map = Cache::remember('cinema.episodes.'.$movie->id, now()->addHours(12), fn () => $this->fetch($movie));
        $out = [];
        foreach ($map as $season => $episodes) {
            $out[] = ['number' => (int) $season, 'episodes' => array_map('intval', $episodes)];
        }

        return $out;
    }

    /**
     * @return array<int, list<int>>
     */
    private function fetch(Movie $movie): array
    {
        $criteria = ['kinopoisk_id' => $movie->kinopoisk_id, 'imdb_id' => $movie->imdb_id, 'tmdb_id' => $movie->tmdb_id];
        $providers = $movie->sources->pluck('provider')->unique();

        try {
            if ($providers->contains('videoseed') && $this->videoseed->configured() && ($seasons = $this->videoseed->episodes($criteria)) !== []) {
                return $seasons;
            }
            if ($providers->contains('kodik') && $this->kodik->configured()) {
                $seasons = $this->kodik->episodes(array_filter([
                    'kinopoisk_id' => $movie->kinopoisk_id,
                    'shikimori_id' => $movie->kinopoisk_id ? null : $movie->shikimori_id,
                    'imdb_id' => $movie->kinopoisk_id || $movie->shikimori_id ? null : $movie->imdb_id,
                ]));
                if ($seasons !== []) {
                    return $seasons;
                }
            }
        } catch (Throwable $e) {
            report($e);
        }

        $count = (int) ($movie->episodes_count ?? 0);

        return $count > 1 ? [1 => range(1, min($count, 2000))] : [];
    }
}
