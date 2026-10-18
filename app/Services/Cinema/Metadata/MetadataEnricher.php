<?php

namespace App\Services\Cinema\Metadata;

use App\Models\Movie;
use App\Services\Cinema\CinemaException;
use App\Services\Cinema\TmdbAutoParse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

/**
 * Збагачує фільм даними з IMDb (OMDb), Shikimori і TMDB.
 *
 * Порядок важливий: OMDb уточнює IMDb ID, за яким TMDB знаходить українську локалізацію.
 * TMDB має найвищий пріоритет для назви, опису, жанрів і зображень; рейтинги та ID оновлюються завжди.
 * Фільми, додані вручну, отримують лише порожні поля — правки адміністратора не перезаписуються.
 */
class MetadataEnricher
{
    private const ALWAYS = ['rating_imdb', 'rating_shikimori', 'rating_tmdb'];

    private const IDS = ['tmdb_id', 'imdb_id', 'shikimori_id'];

    private const TMDB_PREFERRED = ['description', 'genres', 'poster_url', 'backdrop_url', 'trailer_url', 'tagline'];

    public function __construct(
        private readonly OmdbProvider $omdb,
        private readonly ShikimoriProvider $shikimori,
        private readonly TmdbProvider $tmdb,
        private readonly TmdbAutoParse $tmdbRules,
    ) {}

    /**
     * @return list<MetadataProvider>
     */
    public function providers(): array
    {
        return [$this->omdb, $this->shikimori, $this->tmdb];
    }

    public function available(): bool
    {
        return collect($this->providers())->contains(fn (MetadataProvider $p) => $p->configured());
    }

    /**
     * @return array{providers: list<string>, changed: list<string>, errors: list<string>}
     */
    public function enrich(Movie $movie): array
    {
        $used = [];
        $changed = [];
        $errors = [];
        $manual = $movie->origin === 'manual';

        foreach ($this->providers() as $provider) {
            if (! $provider->configured() || Cache::has('cinema.meta.down.'.$provider->key())) {
                continue;
            }
            // TMDB можна вимкнути або обмежити полями в адмінці (Кіно → «Автопарсинг TMDB»).
            if ($provider instanceof TmdbProvider && ! $this->tmdbRules->config()['enabled']) {
                continue;
            }

            try {
                $data = $provider->lookup($movie);
            } catch (CinemaException $e) {
                $errors[] = $e->getMessage();
                if (in_array($e->status, [401, 429], true)) {
                    Cache::put('cinema.meta.down.'.$provider->key(), true, now()->addMinutes(15));
                }

                continue;
            }
            if (! $data) {
                continue;
            }

            $used[] = $provider->label();
            $isTmdb = $provider instanceof TmdbProvider;
            $localizedTitle = (bool) ($data['title_localized'] ?? false);
            unset($data['title_localized']);
            $tmdbFillOnly = $isTmdb && $this->tmdbRules->fillOnly();

            foreach ($data as $field => $value) {
                if ($isTmdb && ! $this->tmdbRules->allows($field)) {
                    continue;
                }
                $current = $movie->getAttribute($field);
                $overwrite = match (true) {
                    in_array($field, self::ALWAYS, true) => true,
                    in_array($field, self::IDS, true) => blank($current),
                    $manual, $tmdbFillOnly => blank($current),
                    $isTmdb && $field === 'title' => $localizedTitle && preg_match('/\p{Cyrillic}/u', (string) $value) === 1,
                    $isTmdb && in_array($field, self::TMDB_PREFERRED, true) => true,
                    default => blank($current),
                };

                if ($overwrite && $current != $value) {
                    $movie->setAttribute($field, $value);
                    $changed[] = $field;
                }
            }
        }

        $movie->enriched_at = Carbon::now();
        $movie->save();

        return ['providers' => $used, 'changed' => array_values(array_unique($changed)), 'errors' => $errors];
    }
}
