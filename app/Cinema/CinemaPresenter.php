<?php

namespace App\Cinema;

use App\Models\User;
use App\Social\Presenter;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/** JSON кінопорталу для сайту й застосунку. */
final class CinemaPresenter
{
    /** Коротка картка (каталог, рядки, запис у стрічці). */
    public static function card(Title $t): array
    {
        return [
            'id' => $t->id,
            'type' => $t->type,
            'name' => $t->name,
            'originalName' => $t->original_name,
            'year' => $t->year,
            'poster' => Tmdb::image($t->poster_path, 'w342'),
            'backdrop' => Tmdb::image($t->backdrop_path, 'w780'),
            'rating' => $t->vote_average ?: null,
            'localRating' => $t->local_rating,
            'hasPlayer' => $t->kodik_link !== null,
            'genres' => $t->relationLoaded('genres') ? $t->genres->pluck('name')->take(3)->values()->all() : [],
        ];
    }

    /** @param iterable<Title> $titles */
    public static function cards(iterable $titles): array
    {
        return collect($titles)->map(fn (Title $t) => self::card($t))->values()->all();
    }

    /** Картки за id (для записів у стрічці) — один запит. @return Collection<int, array> */
    public static function cardsById(array $ids): Collection
    {
        if (! $ids) {
            return collect();
        }

        return Title::query()->whereIn('id', array_unique($ids))->with('genres')->get()->mapWithKeys(fn (Title $t) => [$t->id => self::card($t)]);
    }

    public static function full(Title $t, User $me): array
    {
        $t->loadMissing(['genres', 'credits.person', 'videos', 'seasons']);
        $credits = $t->credits->groupBy('job');
        $review = DB::table('cinema_reviews')->where('title_id', $t->id)->where('user_id', $me->id)->first();
        $progress = DB::table('cinema_progress')->where('title_id', $t->id)->where('user_id', $me->id)->first();

        return self::card($t) + [
            'overview' => (string) $t->overview,
            'tagline' => $t->tagline,
            'releaseDate' => $t->release_date?->toDateString(),
            'runtime' => $t->runtime,
            'countries' => $t->countries ?? [],
            'status' => $t->status,
            'voteCount' => $t->vote_count,
            'localRatingCount' => $t->local_rating_count,
            'seasonsCount' => $t->seasons_count,
            'episodesCount' => $t->episodes_count,
            'backdropLarge' => Tmdb::image($t->backdrop_path, 'w1280'),
            'trailer' => $t->trailer_key,
            'videos' => $t->videos->map(fn ($v) => ['key' => $v->key, 'name' => $v->name, 'type' => $v->type])->values()->all(),
            'cast' => ($credits['cast'] ?? collect())->map(fn ($c) => self::credit($c))->values()->all(),
            'crew' => collect(['creator', 'director', 'writer'])->flatMap(fn ($job) => ($credits[$job] ?? collect())->map(fn ($c) => self::credit($c)))->values()->all(),
            'seasons' => $t->seasons->map(fn ($s) => [
                'number' => $s->number,
                'name' => $s->name,
                'episodes' => $s->episodes_count,
                'poster' => Tmdb::image($s->poster_path, 'w185'),
                'airDate' => $s->air_date?->toDateString(),
            ])->values()->all(),
            'inWatchlist' => DB::table('cinema_watchlist')->where('title_id', $t->id)->where('user_id', $me->id)->exists(),
            'myReview' => $review ? ['rating' => (int) $review->rating, 'body' => (string) $review->body] : null,
            'progress' => $progress ? ['season' => $progress->season, 'episode' => $progress->episode, 'position' => (int) $progress->position, 'duration' => $progress->duration] : null,
            'translations' => collect($t->kodik_translations ?? [])->map(fn ($tr, $i) => ['index' => $i, 'title' => $tr['title'] ?? 'Озвучка', 'quality' => $tr['quality'] ?? null])->values()->all(),
            'social' => self::social($t, $me),
            'isPublished' => $t->is_published,
        ];
    }

    private static function credit(Credit $c): array
    {
        return [
            'personId' => $c->person_id,
            'name' => $c->person->name ?? '',
            'photo' => Tmdb::image($c->person->profile_path ?? null, 'w185'),
            'role' => $c->job === 'cast' ? $c->character : match ($c->job) {
                'director' => 'Режисер', 'writer' => 'Сценарист', 'creator' => 'Творець', default => $c->job,
            },
        ];
    }

    /**
     * Соцмережа й родини на сторінці фільму: хто з друзів і з моєї
     * родини вже оцінив, хто хоче подивитись.
     */
    public static function social(Title $t, User $me): array
    {
        $friendIds = DB::table('social_friends')->where('user_id', $me->id)->pluck('friend_id');
        $familyIds = DB::table('family_members')->whereIn('family_id', DB::table('family_members')->where('user_id', $me->id)->select('family_id'))
            ->where('user_id', '!=', $me->id)->pluck('user_id');
        $circle = $friendIds->merge($familyIds)->unique()->values();

        $reviews = $circle->isEmpty() ? collect() : DB::table('cinema_reviews')->where('title_id', $t->id)->whereIn('user_id', $circle)
            ->orderByDesc('updated_at')->limit(12)->get();
        $wants = $circle->isEmpty() ? collect() : DB::table('cinema_watchlist')->where('title_id', $t->id)->whereIn('user_id', $circle)->limit(12)->pluck('user_id');
        $users = Presenter::users($reviews->pluck('user_id')->merge($wants)->all());

        return [
            'ratings' => $reviews->map(fn ($r) => [
                'user' => Presenter::userShort($users[$r->user_id] ?? null),
                'rating' => (int) $r->rating,
                'family' => $familyIds->contains($r->user_id),
            ])->values()->all(),
            'wantToWatch' => $wants->map(fn ($id) => Presenter::userShort($users[$id] ?? null))->filter()->values()->all(),
        ];
    }

    public static function person(Person $p): array
    {
        $credits = Credit::query()->where('person_id', $p->id)->with(['title.genres'])->get()
            ->filter(fn ($c) => $c->title && $c->title->is_published)
            ->unique('title_id')->sortByDesc(fn ($c) => $c->title->popularity);

        return [
            'id' => $p->id,
            'name' => $p->name,
            'photo' => Tmdb::image($p->profile_path, 'h632'),
            'biography' => (string) $p->biography,
            'birthday' => $p->birthday?->toDateString(),
            'deathday' => $p->deathday?->toDateString(),
            'placeOfBirth' => $p->place_of_birth,
            'knownFor' => $p->known_for,
            'titles' => $credits->map(fn ($c) => self::card($c->title) + ['role' => $c->job === 'cast' ? $c->character : null])->values()->all(),
        ];
    }
}
