<?php

namespace Tests\Feature\Cinema;

use App\Cinema\Kodik\KodikImportPolicy;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class KodikImportPolicyTest extends TestCase
{
    public function test_safe_defaults_accept_complete_item_and_do_not_filter_existing_catalog_shape(): void
    {
        $policy = new KodikImportPolicy;
        $decision = $policy->evaluate($this->item(), []);
        $settings = $policy->normalize([]);

        $this->assertTrue($decision->accepted);
        $this->assertNull($decision->reason);
        $this->assertTrue($settings['allow_camrip']);
        $this->assertTrue($settings['allow_lgbt']);
        $this->assertTrue($settings['update_existing']);
        $this->assertTrue($settings['auto_publish']);
        $this->assertFalse($settings['require_poster']);
        $this->assertFalse($settings['require_description']);
        $this->assertSame([], $settings['types']);
    }

    #[DataProvider('rejectedFilters')]
    public function test_each_filter_returns_explainable_rejection(array $settings, array $changes, string $reason): void
    {
        $decision = (new KodikImportPolicy)->evaluate(array_replace_recursive($this->item(), $changes), $settings);

        $this->assertFalse($decision->accepted);
        $this->assertSame($reason, $decision->reason);
    }

    public static function rejectedFilters(): array
    {
        return [
            'type' => [['types' => ['anime-serial']], [], 'type_not_allowed'],
            'year from' => [['year_from' => 2025], [], 'year_too_old'],
            'year to' => [['year_to' => 2020], [], 'year_too_new'],
            'allowed country' => [['allowed_countries' => ['Японія']], [], 'country_not_allowed'],
            'blocked country' => [['blocked_countries' => ['США']], [], 'country_blocked'],
            'allowed genre' => [['allowed_genres' => ['комедія']], [], 'genre_not_allowed'],
            'blocked genre' => [['blocked_genres' => ['драма']], [], 'genre_blocked'],
            'translation id' => [['translation_ids' => [999]], [], 'translation_not_allowed'],
            'blocked translation' => [['blocked_translation_ids' => [77]], [], 'translation_blocked'],
            'translation type' => [['translation_types' => ['subtitles']], [], 'translation_type_not_allowed'],
            'kinopoisk rating' => [['ratings' => ['kinopoisk' => 8.0]], [], 'rating_too_low:kinopoisk'],
            'imdb rating' => [['ratings' => ['imdb' => 8.0]], [], 'rating_too_low:imdb'],
            'shikimori rating' => [['ratings' => ['shikimori' => 8.0]], [], 'rating_too_low:shikimori'],
            'mydramalist rating' => [['ratings' => ['mydramalist' => 8.0]], [], 'rating_too_low:mydramalist'],
            'mpaa' => [['rating_mpaa' => ['G']], [], 'mpaa_not_allowed'],
            'minimal age' => [['max_minimal_age' => 12], [], 'minimal_age_too_high'],
            'anime kind' => [['anime_kinds' => ['movie']], [], 'anime_kind_not_allowed'],
            'mdl tag' => [['mydramalist_tags' => ['Friendship']], [], 'mydramalist_tag_not_allowed'],
            'anime status' => [['anime_statuses' => ['ongoing']], [], 'anime_status_not_allowed'],
            'drama status' => [['drama_statuses' => ['ongoing']], [], 'drama_status_not_allowed'],
            'studio' => [['anime_studios' => ['Kyoto Animation']], [], 'anime_studio_not_allowed'],
            'license' => [['anime_licensed_by' => ['Wakanim']], [], 'anime_license_not_allowed'],
            'camrip' => [['allow_camrip' => false], ['camrip' => true], 'camrip_forbidden'],
            'lgbt' => [['allow_lgbt' => false], ['lgbt' => true], 'lgbt_forbidden'],
            'region' => [['required_available_in' => ['UA']], ['blocked_countries' => ['UA']], 'region_unavailable'],
            'poster' => [['require_poster' => true], ['material_data' => ['poster_url' => null]], 'poster_required'],
            'description' => [['require_description' => true], ['material_data' => ['description' => null]], 'description_required'],
            'blacklist' => [['blacklisted_ids' => ['movie-42']], [], 'blacklisted'],
            'iframe' => [[], ['link' => 'javascript:alert(1)'], 'missing_iframe'],
        ];
    }

    public function test_allow_and_deny_lists_require_all_configured_constraints(): void
    {
        $policy = new KodikImportPolicy;
        $settings = [
            'types' => ['foreign-movie'],
            'allowed_countries' => ['США', 'Канада'],
            'allowed_genres' => ['драма'],
            'translation_ids' => [77],
            'translation_types' => ['voice'],
            'required_available_in' => ['UA'],
        ];

        $this->assertTrue($policy->evaluate($this->item(), $settings)->accepted);
        $this->assertSame(
            'country_blocked',
            $policy->evaluate($this->item(), $settings + ['blocked_countries' => ['США']])->reason,
        );
    }

    public function test_normalization_drops_unknown_values_and_coerces_scalars(): void
    {
        $settings = (new KodikImportPolicy)->normalize([
            'types' => 'foreign-movie',
            'translation_ids' => ['77', 0, null],
            'year_from' => '2020',
            'allow_camrip' => 0,
            'unknown' => 'discard me',
        ]);

        $this->assertSame(['foreign-movie'], $settings['types']);
        $this->assertSame(['77'], $settings['translation_ids']);
        $this->assertSame(2020, $settings['year_from']);
        $this->assertFalse($settings['allow_camrip']);
        $this->assertArrayNotHasKey('unknown', $settings);
    }

    private function item(): array
    {
        return [
            'id' => 'movie-42',
            'type' => 'foreign-movie',
            'title' => 'Приклад',
            'year' => 2024,
            'link' => 'https://kodik.info/video/42/720p',
            'camrip' => false,
            'lgbt' => false,
            'blocked_countries' => [],
            'translation' => ['id' => 77, 'title' => 'Українська', 'type' => 'voice'],
            'material_data' => [
                'countries' => ['США'],
                'genres' => ['драма', 'трилер'],
                'kinopoisk_rating' => 7.5,
                'imdb_rating' => 7.4,
                'shikimori_rating' => 7.3,
                'mydramalist_rating' => 7.2,
                'rating_mpaa' => 'PG-13',
                'minimal_age' => 16,
                'anime_kind' => 'tv',
                'mydramalist_tags' => ['Violence'],
                'anime_status' => 'released',
                'drama_status' => 'released',
                'anime_studios' => ['J.C.Staff'],
                'anime_licensed_by' => ['Русский Репортаж'],
                'poster_url' => 'https://example.test/poster.jpg',
                'description' => 'Опис',
            ],
        ];
    }
}
