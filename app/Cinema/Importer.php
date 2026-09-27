<?php

namespace App\Cinema;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Імпорт із TMDB у власну базу кінопорталу: фільм/серіал з жанрами,
 * акторами й творцями, трейлерами, сезонами (серії сезону — при першому
 * відкритті), після чого — пошук плеєра Kodik. Повторний імпорт оновлює
 * той самий запис (tmdb_id + тип), нічого не дублює.
 */
final class Importer
{
    /** Скільки акторів зберігати на тайтл. */
    private const CAST = 20;

    public static function import(string $type, int $tmdbId, bool $withKodik = true): Title
    {
        $type = $type === 'series' || $type === 'tv' ? 'series' : 'movie';
        $endpoint = $type === 'series' ? "tv/{$tmdbId}" : "movie/{$tmdbId}";
        $data = Tmdb::get($endpoint, [
            'append_to_response' => 'credits,videos,external_ids',
            'include_video_language' => 'uk,en,null',
        ]);

        return DB::transaction(function () use ($type, $tmdbId, $data, $withKodik) {
            $date = $data['release_date'] ?? $data['first_air_date'] ?? null;
            $title = Title::query()->firstOrNew(['tmdb_id' => $tmdbId, 'type' => $type]);
            $title->fill([
                'name' => $data['title'] ?? $data['name'] ?? 'Без назви',
                'original_name' => $data['original_title'] ?? $data['original_name'] ?? null,
                'release_date' => $date ?: null,
                'year' => $date ? (int) substr($date, 0, 4) : null,
                'runtime' => $data['runtime'] ?? ($data['episode_run_time'][0] ?? null),
                'overview' => $data['overview'] ?? null,
                'tagline' => $data['tagline'] ?? null,
                'poster_path' => $data['poster_path'] ?? $title->poster_path,
                'backdrop_path' => $data['backdrop_path'] ?? $title->backdrop_path,
                'vote_average' => round((float) ($data['vote_average'] ?? 0), 1),
                'vote_count' => (int) ($data['vote_count'] ?? 0),
                'popularity' => (float) ($data['popularity'] ?? 0),
                'imdb_id' => $data['imdb_id'] ?? ($data['external_ids']['imdb_id'] ?? null),
                'original_language' => $data['original_language'] ?? null,
                'countries' => collect($data['production_countries'] ?? [])->pluck('name')->merge($data['origin_country'] ?? [])->unique()->values()->all(),
                'status' => $data['status'] ?? null,
                'seasons_count' => $data['number_of_seasons'] ?? null,
                'episodes_count' => $data['number_of_episodes'] ?? null,
            ]);
            $title->save();

            self::syncGenres($title, $data['genres'] ?? []);
            $title->update(['category' => Title::categorize($type, array_map('intval', array_column($data['genres'] ?? [], 'id')), $data['original_language'] ?? null)]);
            self::syncCredits($title, $data);
            self::syncVideos($title, $data['videos']['results'] ?? []);
            if ($type === 'series') {
                self::syncSeasons($title, $data['seasons'] ?? []);
            }

            if ($withKodik && Kodik::configured()) {
                Kodik::attach($title);
            }

            return $title->fresh();
        });
    }

    /** Серії сезону — з TMDB, коли сезон уперше відкривають. */
    public static function importSeason(Title $title, Season $season): Season
    {
        $data = Tmdb::get("tv/{$title->tmdb_id}/season/{$season->number}");
        foreach ($data['episodes'] ?? [] as $e) {
            Episode::query()->updateOrCreate(
                ['season_id' => $season->id, 'number' => (int) $e['episode_number']],
                [
                    'title_id' => $title->id,
                    'name' => $e['name'] ?? null,
                    'overview' => $e['overview'] ?? null,
                    'still_path' => $e['still_path'] ?? null,
                    'air_date' => ($e['air_date'] ?? null) ?: null,
                    'runtime' => $e['runtime'] ?? null,
                ],
            );
        }
        $season->update(['episodes_loaded_at' => now(), 'episodes_count' => count($data['episodes'] ?? []) ?: $season->episodes_count]);

        return $season->fresh();
    }

    /** Біографія й фільмографія — при першому відкритті сторінки людини. */
    public static function loadPerson(Person $person): Person
    {
        if (! $person->tmdb_id) {
            return $person;
        }
        $data = Tmdb::get("person/{$person->tmdb_id}");
        $person->update([
            'biography' => ($data['biography'] ?? '') ?: $person->biography,
            'birthday' => ($data['birthday'] ?? null) ?: null,
            'deathday' => ($data['deathday'] ?? null) ?: null,
            'place_of_birth' => $data['place_of_birth'] ?? null,
            'known_for' => $data['known_for_department'] ?? $person->known_for,
            'profile_path' => $data['profile_path'] ?? $person->profile_path,
            'details_loaded_at' => now(),
        ]);

        return $person->fresh();
    }

    /**
     * Списки TMDB для адмінки: популярне, трендове, пошук.
     *
     * @return list<array{tmdbId:int, type:string, name:string, year:?int, poster:?string, overview:string, imported:bool}>
     */
    public static function browse(string $list, int $page = 1, ?string $query = null): array
    {
        $data = match ($list) {
            'search' => Tmdb::get('search/multi', ['query' => (string) $query, 'page' => $page]),
            'popular_movies' => Tmdb::get('movie/popular', ['page' => $page]),
            'popular_series' => Tmdb::get('tv/popular', ['page' => $page]),
            'top_movies' => Tmdb::get('movie/top_rated', ['page' => $page]),
            'top_series' => Tmdb::get('tv/top_rated', ['page' => $page]),
            'now_playing' => Tmdb::get('movie/now_playing', ['page' => $page]),
            default => Tmdb::get('trending/all/week', ['page' => $page]),
        };
        $implicitType = match ($list) {
            'popular_series', 'top_series' => 'series',
            'popular_movies', 'top_movies', 'now_playing' => 'movie',
            default => null,
        };

        $rows = collect($data['results'] ?? [])
            ->map(function ($r) use ($implicitType) {
                $media = $r['media_type'] ?? null;
                if ($media === 'person') {
                    return null;
                }
                $type = $implicitType ?? ($media === 'tv' ? 'series' : 'movie');
                $date = $r['release_date'] ?? $r['first_air_date'] ?? null;

                return [
                    'tmdbId' => (int) $r['id'],
                    'type' => $type,
                    'name' => $r['title'] ?? $r['name'] ?? '',
                    'year' => $date ? (int) substr($date, 0, 4) : null,
                    'poster' => Tmdb::image($r['poster_path'] ?? null, 'w185'),
                    'overview' => Str::limit((string) ($r['overview'] ?? ''), 180),
                ];
            })->filter()->values();

        $imported = Title::query()->whereIn('tmdb_id', $rows->pluck('tmdbId'))->get(['tmdb_id', 'type'])
            ->map(fn ($t) => $t->type.':'.$t->tmdb_id)->flip();

        return $rows->map(fn ($r) => $r + ['imported' => isset($imported[$r['type'].':'.$r['tmdbId']])])->all();
    }

    /** Розібрати посилання TMDB (…/movie/603-matrix, …/tv/1399) або «tv:1399». */
    public static function parseReference(string $input): ?array
    {
        $input = trim($input);
        if (preg_match('#themoviedb\.org/(movie|tv)/(\d+)#', $input, $m)) {
            return [$m[1] === 'tv' ? 'series' : 'movie', (int) $m[2]];
        }
        if (preg_match('#^(movie|tv|series|film|serial)[:\s]+(\d+)$#i', $input, $m)) {
            return [in_array(strtolower($m[1]), ['tv', 'series', 'serial'], true) ? 'series' : 'movie', (int) $m[2]];
        }

        return null;
    }

    private static function syncGenres(Title $title, array $genres): void
    {
        $ids = [];
        foreach ($genres as $g) {
            $genre = Genre::query()->firstOrCreate(
                ['tmdb_id' => (int) $g['id']],
                ['name' => Str::ucfirst((string) $g['name']), 'slug' => Str::slug((string) $g['name']).'-'.$g['id']],
            );
            $ids[] = $genre->id;
        }
        $title->genres()->sync($ids);
    }

    private static function syncCredits(Title $title, array $data): void
    {
        $rows = [];
        foreach (array_slice($data['credits']['cast'] ?? [], 0, self::CAST) as $i => $c) {
            $rows[] = ['person' => $c, 'job' => 'cast', 'character' => $c['character'] ?? null, 'position' => $i];
        }
        foreach ($data['created_by'] ?? [] as $i => $c) {
            $rows[] = ['person' => $c, 'job' => 'creator', 'character' => null, 'position' => $i];
        }
        $crew = collect($data['credits']['crew'] ?? []);
        foreach ($crew->where('job', 'Director')->take(3)->values() as $i => $c) {
            $rows[] = ['person' => $c, 'job' => 'director', 'character' => null, 'position' => $i];
        }
        foreach ($crew->whereIn('job', ['Screenplay', 'Writer'])->unique('id')->take(4)->values() as $i => $c) {
            $rows[] = ['person' => $c, 'job' => 'writer', 'character' => null, 'position' => $i];
        }

        Credit::query()->where('title_id', $title->id)->delete();
        foreach ($rows as $row) {
            $p = $row['person'];
            $person = Person::query()->updateOrCreate(
                ['tmdb_id' => (int) $p['id']],
                [
                    'name' => $p['name'] ?? '—',
                    'profile_path' => $p['profile_path'] ?? null,
                    'known_for' => $p['known_for_department'] ?? null,
                    'popularity' => (float) ($p['popularity'] ?? 0),
                ],
            );
            Credit::query()->create([
                'title_id' => $title->id,
                'person_id' => $person->id,
                'job' => $row['job'],
                'character' => $row['character'],
                'position' => $row['position'],
            ]);
        }
    }

    private static function syncVideos(Title $title, array $videos): void
    {
        $youtube = collect($videos)->where('site', 'YouTube')
            ->sortBy(fn ($v) => [($v['iso_639_1'] ?? '') === 'uk' ? 0 : 1, ($v['type'] ?? '') === 'Trailer' ? 0 : 1])
            ->take(6)->values();
        Video::query()->where('title_id', $title->id)->delete();
        foreach ($youtube as $v) {
            Video::query()->create([
                'title_id' => $title->id,
                'provider' => 'youtube',
                'key' => $v['key'],
                'name' => $v['name'] ?? null,
                'type' => $v['type'] ?? null,
                'language' => $v['iso_639_1'] ?? null,
            ]);
        }
        $title->update(['trailer_key' => $youtube->first()['key'] ?? null]);
    }

    private static function syncSeasons(Title $title, array $seasons): void
    {
        foreach ($seasons as $s) {
            if ((int) ($s['season_number'] ?? 0) === 0) {
                continue; // «Спецвипуски» не показуємо
            }
            Season::query()->updateOrCreate(
                ['title_id' => $title->id, 'number' => (int) $s['season_number']],
                [
                    'name' => $s['name'] ?? null,
                    'overview' => $s['overview'] ?? null,
                    'poster_path' => $s['poster_path'] ?? null,
                    'air_date' => ($s['air_date'] ?? null) ?: null,
                    'episodes_count' => (int) ($s['episode_count'] ?? 0),
                ],
            );
        }
    }
}
