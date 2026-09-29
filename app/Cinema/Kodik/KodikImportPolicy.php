<?php

namespace App\Cinema\Kodik;

final class KodikImportPolicy
{
    private const DEFAULTS = [
        'types' => [],
        'year_from' => null,
        'year_to' => null,
        'allowed_countries' => [],
        'blocked_countries' => [],
        'allowed_genres' => [],
        'blocked_genres' => [],
        'translation_ids' => [],
        'blocked_translation_ids' => [],
        'translation_types' => [],
        'ratings' => [],
        'rating_mpaa' => [],
        'max_minimal_age' => null,
        'anime_kinds' => [],
        'mydramalist_tags' => [],
        'anime_statuses' => [],
        'drama_statuses' => [],
        'anime_studios' => [],
        'anime_licensed_by' => [],
        'allow_camrip' => true,
        'allow_lgbt' => true,
        'required_available_in' => [],
        'require_poster' => false,
        'require_description' => false,
        'blacklisted_ids' => [],
        'update_existing' => true,
        'auto_publish' => true,
    ];

    private const LIST_KEYS = [
        'types', 'allowed_countries', 'blocked_countries', 'allowed_genres',
        'blocked_genres', 'translation_ids', 'blocked_translation_ids',
        'translation_types', 'rating_mpaa', 'anime_kinds', 'mydramalist_tags',
        'anime_statuses', 'drama_statuses', 'anime_studios',
        'anime_licensed_by', 'required_available_in', 'blacklisted_ids',
    ];

    private const BOOL_KEYS = [
        'allow_camrip', 'allow_lgbt', 'require_poster',
        'require_description', 'update_existing', 'auto_publish',
    ];

    /** @param array<string, mixed> $settings @return array<string, mixed> */
    public function normalize(array $settings): array
    {
        $normalized = self::DEFAULTS;

        foreach (self::LIST_KEYS as $key) {
            if (! array_key_exists($key, $settings)) {
                continue;
            }
            $values = is_array($settings[$key]) ? $settings[$key] : [$settings[$key]];
            $normalized[$key] = collect($values)
                ->filter(fn ($value) => is_scalar($value) && trim((string) $value) !== '' && trim((string) $value) !== '0')
                ->map(fn ($value) => trim((string) $value))
                ->unique(fn ($value) => mb_strtolower($value))
                ->values()->all();
        }

        foreach (['year_from', 'year_to', 'max_minimal_age'] as $key) {
            if (array_key_exists($key, $settings) && is_numeric($settings[$key])) {
                $normalized[$key] = (int) $settings[$key];
            }
        }

        foreach (self::BOOL_KEYS as $key) {
            if (! array_key_exists($key, $settings)) {
                continue;
            }
            $value = filter_var($settings[$key], FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);
            $normalized[$key] = $value ?? self::DEFAULTS[$key];
        }

        $ratings = is_array($settings['ratings'] ?? null) ? $settings['ratings'] : [];
        foreach (['kinopoisk', 'imdb', 'shikimori', 'mydramalist'] as $source) {
            if (isset($ratings[$source]) && is_numeric($ratings[$source])) {
                $normalized['ratings'][$source] = max(0.0, min(10.0, (float) $ratings[$source]));
            }
        }

        return $normalized;
    }

    /** @param array<string, mixed> $item @param array<string, mixed> $settings */
    public function evaluate(array $item, array $settings = []): KodikImportDecision
    {
        $settings = $this->normalize($settings);
        $material = is_array($item['material_data'] ?? null) ? $item['material_data'] : [];

        if (! $this->validIframe((string) ($item['link'] ?? $item['iframe_url'] ?? ''))) {
            return KodikImportDecision::rejected('missing_iframe');
        }
        if (! $this->allowed([(string) ($item['type'] ?? '')], $settings['types'])) {
            return KodikImportDecision::rejected('type_not_allowed');
        }

        $year = $this->number($item['year'] ?? $material['year'] ?? null);
        if ($settings['year_from'] !== null && ($year === null || $year < $settings['year_from'])) {
            return KodikImportDecision::rejected('year_too_old');
        }
        if ($settings['year_to'] !== null && ($year === null || $year > $settings['year_to'])) {
            return KodikImportDecision::rejected('year_too_new');
        }

        $countries = $this->strings($material['countries'] ?? $item['countries'] ?? []);
        if (! $this->allowed($countries, $settings['allowed_countries'])) {
            return KodikImportDecision::rejected('country_not_allowed');
        }
        if ($this->intersects($countries, $settings['blocked_countries'])) {
            return KodikImportDecision::rejected('country_blocked');
        }

        $genres = $this->strings($material['all_genres'] ?? $material['genres'] ?? $item['genres'] ?? []);
        if (! $this->allowed($genres, $settings['allowed_genres'])) {
            return KodikImportDecision::rejected('genre_not_allowed');
        }
        if ($this->intersects($genres, $settings['blocked_genres'])) {
            return KodikImportDecision::rejected('genre_blocked');
        }

        [$translationIds, $translationTypes] = $this->translations($item);
        if (! $this->allowed($translationIds, $settings['translation_ids'])) {
            return KodikImportDecision::rejected('translation_not_allowed');
        }
        if ($this->intersects($translationIds, $settings['blocked_translation_ids'])) {
            return KodikImportDecision::rejected('translation_blocked');
        }
        if (! $this->allowed($translationTypes, $settings['translation_types'])) {
            return KodikImportDecision::rejected('translation_type_not_allowed');
        }

        foreach ($settings['ratings'] as $source => $minimum) {
            $rating = $this->number($material[$source.'_rating'] ?? $item[$source.'_rating'] ?? null);
            if ($rating === null || $rating < $minimum) {
                return KodikImportDecision::rejected('rating_too_low:'.$source);
            }
        }

        if (! $this->allowed($this->strings($material['rating_mpaa'] ?? $item['rating_mpaa'] ?? []), $settings['rating_mpaa'])) {
            return KodikImportDecision::rejected('mpaa_not_allowed');
        }
        $minimalAge = $this->number($material['minimal_age'] ?? $item['minimal_age'] ?? null);
        if ($settings['max_minimal_age'] !== null && ($minimalAge === null || $minimalAge > $settings['max_minimal_age'])) {
            return KodikImportDecision::rejected('minimal_age_too_high');
        }

        $checks = [
            ['anime_kind', 'anime_kinds', 'anime_kind_not_allowed'],
            ['mydramalist_tags', 'mydramalist_tags', 'mydramalist_tag_not_allowed'],
            ['anime_status', 'anime_statuses', 'anime_status_not_allowed'],
            ['drama_status', 'drama_statuses', 'drama_status_not_allowed'],
            ['anime_studios', 'anime_studios', 'anime_studio_not_allowed'],
            ['anime_licensed_by', 'anime_licensed_by', 'anime_license_not_allowed'],
        ];
        foreach ($checks as [$field, $setting, $reason]) {
            if (! $this->allowed($this->strings($material[$field] ?? $item[$field] ?? []), $settings[$setting])) {
                return KodikImportDecision::rejected($reason);
            }
        }

        if (! $settings['allow_camrip'] && filter_var($item['camrip'] ?? false, FILTER_VALIDATE_BOOL)) {
            return KodikImportDecision::rejected('camrip_forbidden');
        }
        if (! $settings['allow_lgbt'] && filter_var($item['lgbt'] ?? false, FILTER_VALIDATE_BOOL)) {
            return KodikImportDecision::rejected('lgbt_forbidden');
        }

        $blockedRegions = $this->strings($item['blocked_countries'] ?? []);
        if ($this->intersects($blockedRegions, $settings['required_available_in'])) {
            return KodikImportDecision::rejected('region_unavailable');
        }
        if ($settings['require_poster'] && trim((string) ($material['poster_url'] ?? $material['poster'] ?? $item['poster'] ?? '')) === '') {
            return KodikImportDecision::rejected('poster_required');
        }
        if ($settings['require_description'] && trim((string) ($material['description'] ?? $item['description'] ?? '')) === '') {
            return KodikImportDecision::rejected('description_required');
        }

        $ids = $this->strings([
            $item['id'] ?? null, $item['kodik_id'] ?? null, $item['kinopoisk_id'] ?? null,
            $item['imdb_id'] ?? null, $item['shikimori_id'] ?? null,
            $item['mdl_id'] ?? null, $item['worldart_link'] ?? null,
        ]);
        if ($this->intersects($ids, $settings['blacklisted_ids'])) {
            return KodikImportDecision::rejected('blacklisted');
        }

        return KodikImportDecision::accepted();
    }

    /** @param list<string> $actual @param list<string> $allowed */
    private function allowed(array $actual, array $allowed): bool
    {
        return $allowed === [] || $this->intersects($actual, $allowed);
    }

    /** @param list<string> $left @param list<string> $right */
    private function intersects(array $left, array $right): bool
    {
        $left = array_map(fn ($value) => mb_strtolower(trim($value)), $left);
        $right = array_map(fn ($value) => mb_strtolower(trim($value)), $right);

        return array_intersect($left, $right) !== [];
    }

    /** @return list<string> */
    private function strings(mixed $value): array
    {
        $values = is_array($value) ? $value : [$value];

        return collect($values)->filter(fn ($item) => is_scalar($item) && trim((string) $item) !== '')
            ->map(fn ($item) => trim((string) $item))->values()->all();
    }

    /** @param array<string, mixed> $item @return array{0:list<string>,1:list<string>} */
    private function translations(array $item): array
    {
        $translations = is_array($item['translations'] ?? null) && array_is_list($item['translations'])
            ? $item['translations'] : [$item['translation'] ?? []];
        $ids = [];
        $types = [];
        foreach ($translations as $translation) {
            if (! is_array($translation)) {
                continue;
            }
            $id = $translation['id'] ?? $translation['translation_id'] ?? null;
            $type = $translation['type'] ?? $translation['translation_type'] ?? null;
            if ($id !== null && $id !== '') {
                $ids[] = (string) $id;
            }
            if ($type !== null && $type !== '') {
                $types[] = (string) $type;
            }
        }

        return [array_values(array_unique($ids)), array_values(array_unique($types))];
    }

    private function number(mixed $value): ?float
    {
        return is_numeric($value) ? (float) $value : null;
    }

    private function validIframe(string $link): bool
    {
        return filter_var($link, FILTER_VALIDATE_URL) !== false
            && in_array(parse_url($link, PHP_URL_SCHEME), ['http', 'https'], true);
    }
}

final readonly class KodikImportDecision
{
    private function __construct(public bool $accepted, public ?string $reason) {}

    public static function accepted(): self
    {
        return new self(true, null);
    }

    public static function rejected(string $reason): self
    {
        return new self(false, $reason);
    }
}
