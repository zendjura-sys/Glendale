<?php

namespace App\Cinema\Kodik;

use App\Cinema\Title;
use Illuminate\Support\Collection;

final class KodikIdentityResolver
{
    private const YEAR_TOLERANCE = 1;

    /** @var list<string> */
    private const STRONG_FIELDS = [
        'kodik_id',
        'kinopoisk_id',
        'shikimori_id',
        'imdb_id',
        'mdl_id',
        'worldart_id',
    ];

    /** @param array<string, mixed> $item */
    public function resolve(array $item): KodikIdentityResolution
    {
        $identifiers = $this->identifiers($item);
        $strongMatches = collect();

        foreach (self::STRONG_FIELDS as $priority => $field) {
            $value = $identifiers[$field] ?? null;
            if ($value === null) {
                continue;
            }

            foreach ($this->titlesByIdentifier($field, $value) as $title) {
                $strongMatches->push([
                    'title' => $title,
                    'field' => $field,
                    'priority' => $priority,
                ]);
            }
        }

        if ($strongMatches->isNotEmpty()) {
            $candidateIds = $strongMatches->pluck('title.id')->unique()->values()->all();
            $bestPriority = $strongMatches->min('priority');
            $best = $strongMatches->where('priority', $bestPriority)->unique('title.id')->values();
            if ($best->count() !== 1) {
                return KodikIdentityResolution::ambiguous('duplicate_strong_id', $candidateIds);
            }

            $match = $best->first();
            $reason = $match['field'].(count($candidateIds) > 1 ? '_replace' : '');

            return KodikIdentityResolution::matched($match['title'], $reason, $candidateIds);
        }

        return $this->resolveByName($item, $identifiers);
    }

    /** @param array<string, mixed> $item @param array<string, string|null> $identifiers */
    private function resolveByName(array $item, array $identifiers): KodikIdentityResolution
    {
        $names = collect($this->itemNames($item))->map($this->normalizeName(...))->filter()->unique();
        if ($names->isEmpty()) {
            return KodikIdentityResolution::new();
        }

        $type = $this->titleType($item);
        $query = Title::query()->select([
            'id', 'type', 'name', 'original_name', 'alt_names', 'year',
            'kodik_id', 'kinopoisk_id', 'shikimori_id', 'imdb_id', 'mdl_id', 'worldart_link',
        ]);
        if ($type !== null) {
            $query->where('type', $type);
        }

        $nameMatches = $query->get()->filter(function (Title $title) use ($names): bool {
            $titleNames = collect([$title->name, $title->original_name, ...($title->alt_names ?? [])])
                ->map($this->normalizeName(...))->filter()->unique();

            return $titleNames->intersect($names)->isNotEmpty();
        })->values();

        if ($nameMatches->isEmpty()) {
            return KodikIdentityResolution::new();
        }

        $year = $this->year($item);
        $withinYear = $nameMatches->filter(fn (Title $title): bool => $year === null
            || $title->year === null
            || abs((int) $title->year - $year) <= self::YEAR_TOLERANCE)->values();

        if ($withinYear->count() > 1) {
            return KodikIdentityResolution::ambiguous('multiple_name_candidates', $withinYear->pluck('id')->all());
        }

        if ($withinYear->count() === 1) {
            /** @var Title $title */
            $title = $withinYear->first();
            $reason = $this->hasIdentifierMismatch($title, $identifiers) ? 'name_year_replace' : 'name_year';

            return KodikIdentityResolution::matched($title, $reason, [$title->id]);
        }

        if ($nameMatches->count() === 1) {
            /** @var Title $title */
            $title = $nameMatches->first();

            return KodikIdentityResolution::matched($title, 'name_replace_year_mismatch', [$title->id]);
        }

        return KodikIdentityResolution::ambiguous('multiple_name_candidates', $nameMatches->pluck('id')->all());
    }

    /** @return Collection<int, Title> */
    private function titlesByIdentifier(string $field, string $value): Collection
    {
        if ($field !== 'worldart_id') {
            return Title::query()->where($field, $value)->get();
        }

        return Title::query()->whereNotNull('worldart_link')->get()
            ->filter(fn (Title $title): bool => $this->worldArtId($title->worldart_link) === $value)
            ->values();
    }

    /** @param array<string, mixed> $item @return array<string, string|null> */
    private function identifiers(array $item): array
    {
        $material = is_array($item['material_data'] ?? null) ? $item['material_data'] : [];

        return [
            'kodik_id' => $this->identifier($item['kodik_id'] ?? $item['id'] ?? null),
            'kinopoisk_id' => $this->identifier($item['kinopoisk_id'] ?? $material['kinopoisk_id'] ?? null),
            'shikimori_id' => $this->identifier($item['shikimori_id'] ?? $material['shikimori_id'] ?? null),
            'imdb_id' => $this->identifier($item['imdb_id'] ?? $material['imdb_id'] ?? null),
            'mdl_id' => $this->identifier($item['mdl_id'] ?? $material['mdl_id'] ?? null),
            'worldart_id' => $this->worldArtId($item['worldart_link'] ?? $material['worldart_link'] ?? $item['worldart_id'] ?? null),
        ];
    }

    /** @param array<string, mixed> $item @return list<string> */
    private function itemNames(array $item): array
    {
        $material = is_array($item['material_data'] ?? null) ? $item['material_data'] : [];
        $names = [
            $item['title'] ?? null,
            $item['title_orig'] ?? null,
            $item['other_title'] ?? null,
            $material['title'] ?? null,
            $material['title_en'] ?? null,
            $material['title_ru'] ?? null,
        ];
        foreach ([$item['other_titles'] ?? [], $material['other_titles'] ?? []] as $otherNames) {
            if (is_array($otherNames)) {
                array_push($names, ...$otherNames);
            }
        }

        return array_values(array_filter($names, fn ($name): bool => is_string($name) && trim($name) !== ''));
    }

    private function normalizeName(mixed $name): string
    {
        if (! is_string($name)) {
            return '';
        }

        return trim((string) preg_replace('/[^\p{L}\p{N}]+/u', ' ', mb_strtolower($name)));
    }

    /** @param array<string, mixed> $item */
    private function year(array $item): ?int
    {
        $value = $item['year'] ?? (is_array($item['material_data'] ?? null) ? $item['material_data']['year'] ?? null : null);

        return is_numeric($value) ? (int) $value : null;
    }

    /** @param array<string, mixed> $item */
    private function titleType(array $item): ?string
    {
        $type = (string) ($item['type'] ?? '');
        if ($type === '') {
            return null;
        }

        return str_contains($type, 'serial') ? 'series' : 'movie';
    }

    /** @param array<string, string|null> $identifiers */
    private function hasIdentifierMismatch(Title $title, array $identifiers): bool
    {
        foreach (self::STRONG_FIELDS as $field) {
            $incoming = $identifiers[$field] ?? null;
            if ($incoming === null) {
                continue;
            }
            $stored = $field === 'worldart_id'
                ? $this->worldArtId($title->worldart_link)
                : $this->identifier($title->{$field});
            if ($stored !== null && $stored !== $incoming) {
                return true;
            }
        }

        return false;
    }

    private function identifier(mixed $value): ?string
    {
        if (! is_scalar($value)) {
            return null;
        }
        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }

    private function worldArtId(mixed $value): ?string
    {
        $value = $this->identifier($value);
        if ($value === null) {
            return null;
        }
        if (preg_match('/(?:[?&]id=|\/)(\d+)(?:\D|$)/', $value, $match)) {
            return $match[1];
        }

        return ctype_digit($value) ? $value : null;
    }
}
