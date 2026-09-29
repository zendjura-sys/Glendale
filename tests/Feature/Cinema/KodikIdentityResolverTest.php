<?php

namespace Tests\Feature\Cinema;

use App\Cinema\Kodik\KodikIdentityResolver;
use App\Cinema\Title;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class KodikIdentityResolverTest extends TestCase
{
    use RefreshDatabase;

    public function test_matches_every_supported_strong_identity(): void
    {
        $cases = [
            ['title' => ['kodik_id' => 'kodik-1'], 'item' => ['id' => 'kodik-1'], 'reason' => 'kodik_id'],
            ['title' => ['kinopoisk_id' => 'kp-2'], 'item' => ['kinopoisk_id' => 'kp-2'], 'reason' => 'kinopoisk_id'],
            ['title' => ['shikimori_id' => 303], 'item' => ['shikimori_id' => 303], 'reason' => 'shikimori_id'],
            ['title' => ['imdb_id' => 'tt0000404'], 'item' => ['imdb_id' => 'tt0000404'], 'reason' => 'imdb_id'],
            ['title' => ['mdl_id' => 505], 'item' => ['mdl_id' => 505], 'reason' => 'mdl_id'],
            [
                'title' => ['worldart_link' => 'https://www.world-art.ru/animation/animation.php?id=606'],
                'item' => ['worldart_link' => 'https://www.world-art.ru/animation/animation.php?id=606'],
                'reason' => 'worldart_id',
            ],
        ];

        foreach ($cases as $index => $case) {
            $title = Title::create($case['title'] + [
                'tmdb_id' => 3000 + $index,
                'type' => 'movie',
                'name' => 'Тайтл '.$index,
            ]);

            $resolution = app(KodikIdentityResolver::class)->resolve($case['item']);

            $this->assertSame('matched', $resolution->status);
            $this->assertSame($title->id, $resolution->title?->id);
            $this->assertSame($case['reason'], $resolution->reason);
        }
    }

    public function test_matches_normalized_cyrillic_latin_and_alternative_names_with_year(): void
    {
        $title = Title::create([
            'tmdb_id' => 3100,
            'type' => 'series',
            'name' => 'Мисливець × Мисливець',
            'original_name' => 'Hunter x Hunter',
            'alt_names' => ['Охотник х Охотник'],
            'year' => 2011,
        ]);
        $resolver = app(KodikIdentityResolver::class);

        foreach (['мисливець мисливець', 'HUNTER-X-HUNTER', 'Охотник х Охотник'] as $name) {
            $resolution = $resolver->resolve(['type' => 'anime-serial', 'title' => $name, 'year' => 2011]);
            $this->assertSame('matched', $resolution->status);
            $this->assertSame($title->id, $resolution->title?->id);
            $this->assertSame('name_year', $resolution->reason);
        }
    }

    public function test_two_strong_ids_pointing_to_different_titles_is_conflict(): void
    {
        $first = Title::create(['tmdb_id' => 3201, 'type' => 'movie', 'name' => 'Перший', 'imdb_id' => 'tt3201']);
        $second = Title::create(['tmdb_id' => 3202, 'type' => 'movie', 'name' => 'Другий', 'kinopoisk_id' => 'kp-3202']);

        $resolution = app(KodikIdentityResolver::class)->resolve([
            'imdb_id' => 'tt3201',
            'kinopoisk_id' => 'kp-3202',
        ]);

        $this->assertSame('conflict', $resolution->status);
        $this->assertSame('strong_ids_disagree', $resolution->reason);
        $this->assertEqualsCanonicalizing([$first->id, $second->id], $resolution->candidateIds);
    }

    public function test_name_match_with_different_strong_id_is_conflict(): void
    {
        $title = Title::create([
            'tmdb_id' => 3301,
            'type' => 'movie',
            'name' => 'Дюна',
            'imdb_id' => 'tt1160419',
            'year' => 2021,
        ]);

        $resolution = app(KodikIdentityResolver::class)->resolve([
            'type' => 'foreign-movie',
            'title' => 'Дюна',
            'year' => 2021,
            'imdb_id' => 'tt0087182',
        ]);

        $this->assertSame('conflict', $resolution->status);
        $this->assertSame('strong_id_mismatch', $resolution->reason);
        $this->assertSame([$title->id], $resolution->candidateIds);
    }

    public function test_multiple_name_candidates_are_ambiguous(): void
    {
        $first = Title::create(['tmdb_id' => 3401, 'type' => 'movie', 'name' => 'Тест', 'year' => 2020]);
        $second = Title::create(['tmdb_id' => 3402, 'type' => 'movie', 'name' => 'Тест', 'year' => 2021]);

        $resolution = app(KodikIdentityResolver::class)->resolve(['type' => 'foreign-movie', 'title' => 'Тест', 'year' => 2020]);

        $this->assertSame('ambiguous', $resolution->status);
        $this->assertSame('multiple_name_candidates', $resolution->reason);
        $this->assertEqualsCanonicalizing([$first->id, $second->id], $resolution->candidateIds);
    }

    public function test_same_name_with_year_outside_tolerance_is_conflict(): void
    {
        $title = Title::create(['tmdb_id' => 3501, 'type' => 'movie', 'name' => 'Носферату', 'year' => 1922]);

        $resolution = app(KodikIdentityResolver::class)->resolve([
            'type' => 'foreign-movie',
            'title' => 'Носферату',
            'year' => 2024,
        ]);

        $this->assertSame('conflict', $resolution->status);
        $this->assertSame('year_mismatch', $resolution->reason);
        $this->assertSame([$title->id], $resolution->candidateIds);
    }

    public function test_unknown_identity_is_new(): void
    {
        $resolution = app(KodikIdentityResolver::class)->resolve([
            'id' => 'new-kodik-id',
            'type' => 'foreign-movie',
            'title' => 'Цілком новий фільм',
            'year' => 2026,
        ]);

        $this->assertSame('new', $resolution->status);
        $this->assertNull($resolution->title);
        $this->assertSame([], $resolution->candidateIds);
    }
}
