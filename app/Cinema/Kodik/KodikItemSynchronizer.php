<?php

namespace App\Cinema\Kodik;

use App\Cinema\CinemaSettings;
use App\Cinema\CinemaSyncEvent;
use App\Cinema\CinemaSyncRun;
use App\Cinema\Kodik;
use App\Cinema\KodikSource;
use App\Cinema\PlayerSources;
use App\Cinema\Season;
use App\Cinema\Episode;
use App\Cinema\Title;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class KodikItemSynchronizer
{
    private readonly KodikImportPolicy $policy;

    public function __construct(
        private readonly KodikIdentityResolver $resolver,
        ?KodikImportPolicy $policy = null,
    ) {
        $this->policy = $policy ?? new KodikImportPolicy;
    }

    /** @param array<string, mixed> $item */
    public function sync(array $item, CinemaSyncRun $run): KodikItemSyncResult
    {
        if ($this->resolver->resolve($item)->status === 'new') {
            $item = app(KodikMetadataEnricher::class)->enrich($item);
        }
        $settings = $this->policy->normalize(CinemaSettings::kodikImportPolicy());
        $decision = $this->policy->evaluate($item, $settings);
        if (! $decision->accepted) {
            $event = $this->event($run, null, 'skipped', 'rejected', $item, (string) $decision->reason);

            return new KodikItemSyncResult('rejected', null, $event);
        }

        $sources = $this->sourceRows($item);
        if ($sources === []) {
            $event = $this->event($run, null, 'skipped', 'rejected', $item, 'missing_iframe');

            return new KodikItemSyncResult('rejected', null, $event);
        }

        $resolution = $this->resolver->resolve($item);
        if ($resolution->status === 'ambiguous') {
            $event = $this->event($run, null, 'identity_conflict', 'ambiguous', $item, $resolution->reason, [
                'candidate_ids' => $resolution->candidateIds,
            ]);

            return new KodikItemSyncResult('ambiguous', null, $event);
        }

        if ($resolution->title !== null && ! $settings['update_existing']) {
            $event = $this->event($run, $resolution->title, 'skipped', 'rejected', $item, 'updates_disabled');

            return new KodikItemSyncResult('rejected', $resolution->title, $event);
        }

        return DB::transaction(function () use ($item, $run, $resolution, $sources, $settings): KodikItemSyncResult {
            $created = $resolution->status === 'new';
            $title = $resolution->title ?? new Title;

            if ($created) {
                $title->forceFill($this->newTitleAttributes($item, (bool) $settings['auto_publish']));
            }
            $title->forceFill($this->identityAttributes($item) + [
                'kodik_sync_status' => 'attached',
                'kodik_last_error' => null,
                'kodik_checked_at' => now(),
                'kodik_synced_at' => now(),
            ])->save();

            foreach ($sources as $source) {
                $model = KodikSource::query()->firstOrNew([
                    'kodik_id' => $source['kodik_id'],
                    'translation_id' => $source['translation_id'],
                ]);
                $model->forceFill($source + ['title_id' => $title->id])->save();
            }

            $this->syncEpisodes($title, $item);
            PlayerSources::refreshKodikAggregate($title);
            $title->refresh();
            $action = $created ? 'created' : 'updated';
            $event = $this->event($run, $title, $action, 'succeeded', $item, $resolution->reason, [
                'sources' => count($sources),
                'replacement_candidates' => $resolution->candidateIds,
            ]);

            return new KodikItemSyncResult($action, $title, $event);
        });
    }

    /** Add provider episodes while retaining manually entered and enriched fields. */
    private function syncEpisodes(Title $title, array $item): void
    {
        if (! $title->isSeries() || ! is_array($item['seasons'] ?? null)) {
            return;
        }
        foreach ($item['seasons'] as $seasonNumber => $data) {
            if (! is_numeric($seasonNumber) || (int) $seasonNumber < 0 || (int) $seasonNumber > 200 || ! is_array($data)) {
                continue;
            }
            $season = Season::query()->firstOrCreate(
                ['title_id' => $title->id, 'number' => (int) $seasonNumber],
                ['name' => 'Сезон '.$seasonNumber],
            );
            $episodes = is_array($data['episodes'] ?? null) ? $data['episodes'] : [];
            foreach ($episodes as $number => $episodeData) {
                if (! is_numeric($number) || (int) $number < 1 || (int) $number > 5000) {
                    continue;
                }
                $episodeData = is_array($episodeData) ? $episodeData : ['link' => $episodeData];
                $link = Kodik::normalizeLink((string) ($episodeData['link'] ?? ''));
                if (! $this->validIframe($link)) {
                    continue;
                }
                $episode = Episode::query()->firstOrNew(['season_id' => $season->id, 'number' => (int) $number]);
                $episode->title_id = $title->id;
                foreach (['name' => $episodeData['title'] ?? null,
                    'still_path' => $episodeData['screenshots'][0] ?? null] as $field => $value) {
                    if (! $episode->{$field} && is_string($value) && $value !== '') {
                        $episode->{$field} = mb_substr($value, 0, 255);
                    }
                }
                $episode->save();
            }
            $season->episodes_count = max((int) $season->episodes_count, (int) $season->episodes()->max('number'));
            $season->save();
        }
        $title->forceFill([
            'seasons_count' => $title->seasons()->count(),
            'episodes_count' => Episode::query()->where('title_id', $title->id)->count(),
        ])->save();
    }

    /** @param array<string, mixed> $item @return list<array<string, mixed>> */
    private function sourceRows(array $item): array
    {
        $variants = is_array($item['translations'] ?? null) && array_is_list($item['translations'])
            ? $item['translations'] : [$item];
        $rows = [];

        foreach ($variants as $variant) {
            if (! is_array($variant)) {
                continue;
            }
            $data = array_replace($item, Arr::except($variant, ['translations']));
            $link = Kodik::normalizeLink((string) ($data['link'] ?? $data['iframe_url'] ?? ''));
            if (! $this->validIframe($link)) {
                continue;
            }
            $translation = is_array($data['translation'] ?? null) ? $data['translation'] : [];
            $translationId = (string) ($translation['id'] ?? $data['translation_id'] ?? $data['id_translation'] ?? 0);
            $kodikId = (string) ($item['kodik_id'] ?? $item['id'] ?? hash('sha256', $link));
            $material = is_array($item['material_data'] ?? null) ? $item['material_data'] : [];

            $rows[] = [
                'kodik_id' => $kodikId,
                'content_type' => $item['type'] ?? null,
                'translation_id' => $translationId,
                'translation_title' => $translation['title'] ?? $data['translation_title'] ?? 'Озвучка',
                'translation_type' => $translation['type'] ?? $data['translation_type'] ?? null,
                'quality' => $data['quality'] ?? null,
                'link' => $link,
                'last_season' => $this->positiveInt($data['last_season'] ?? null),
                'last_episode' => $this->positiveInt($data['last_episode'] ?? null),
                'availability' => Arr::only($data, ['seasons', 'episodes']),
                'material' => Arr::only($material, ['title', 'title_en', 'title_ru', 'year', 'description', 'poster_url', 'countries', 'genres', 'rating', 'imdb_rating', 'shikimori_rating']),
                'source_updated_at' => $this->date($data['updated_at'] ?? null),
                'payload_hash' => hash('sha256', json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)),
                'is_available' => true,
            ];
        }

        return $rows;
    }

    /** @param array<string, mixed> $item @return array<string, mixed> */
    private function newTitleAttributes(array $item, bool $autoPublish): array
    {
        $material = is_array($item['material_data'] ?? null) ? $item['material_data'] : [];
        $type = str_contains((string) ($item['type'] ?? ''), 'serial') ? 'series' : 'movie';
        $name = $material['localized_name'] ?? $item['title'] ?? $material['title'] ?? $item['title_orig'] ?? 'Без назви';
        $original = $item['title_orig'] ?? $material['title_en'] ?? null;
        $altNames = collect([
            $item['other_title'] ?? null,
            $material['title_ru'] ?? null,
            $material['title_en'] ?? null,
            ...(is_array($item['other_titles'] ?? null) ? $item['other_titles'] : []),
        ])->filter(fn ($value) => is_string($value) && trim($value) !== '')
            ->map(fn ($value) => trim($value))->unique(fn ($value) => mb_strtolower($value))->values()->all();

        return [
            'type' => $type,
            'category' => $this->category((string) ($item['type'] ?? ''), $type),
            'name' => (string) $name,
            'original_name' => $original,
            'alt_names' => $altNames,
            'runtime' => $this->positiveInt($material['duration'] ?? null),
            'year' => $this->positiveInt($item['year'] ?? $material['year'] ?? null),
            'overview' => $material['description'] ?? $item['description'] ?? null,
            'poster_path' => $material['poster_url'] ?? $material['poster'] ?? $item['poster'] ?? null,
            'countries' => is_array($material['countries'] ?? null) ? $material['countries'] : null,
            'status' => $material['status'] ?? null,
            'seasons_count' => $this->positiveInt($item['last_season'] ?? null),
            'episodes_count' => $this->positiveInt($item['last_episode'] ?? null),
            'is_published' => $autoPublish,
        ];
    }

    /** @param array<string, mixed> $item @return array<string, mixed> */
    private function identityAttributes(array $item): array
    {
        $material = is_array($item['material_data'] ?? null) ? $item['material_data'] : [];
        $attributes = [];
        $values = [
            'kodik_id' => $item['kodik_id'] ?? $item['id'] ?? null,
            'kinopoisk_id' => $item['kinopoisk_id'] ?? $material['kinopoisk_id'] ?? null,
            'shikimori_id' => $item['shikimori_id'] ?? $material['shikimori_id'] ?? null,
            'imdb_id' => $item['imdb_id'] ?? $material['imdb_id'] ?? null,
            'mdl_id' => $item['mdl_id'] ?? $material['mdl_id'] ?? null,
            'worldart_link' => $item['worldart_link'] ?? $material['worldart_link'] ?? null,
        ];
        foreach ($values as $field => $value) {
            if ($value !== null && $value !== '') {
                $attributes[$field] = in_array($field, ['shikimori_id', 'mdl_id'], true) ? (int) $value : (string) $value;
            }
        }

        return $attributes;
    }

    /** @param array<string, mixed> $item @param array<string, mixed> $context */
    private function event(CinemaSyncRun $run, ?Title $title, string $action, string $status, array $item, string $message, array $context = []): CinemaSyncEvent
    {
        return CinemaSyncEvent::create([
            'run_id' => $run->id,
            'title_id' => $title?->id,
            'action' => $action,
            'status' => $status,
            'identifiers' => Arr::only($item, ['id', 'kodik_id', 'kinopoisk_id', 'shikimori_id', 'imdb_id', 'mdl_id', 'worldart_link']),
            'context' => $context,
            'message' => $message,
        ]);
    }

    private function category(string $kodikType, string $type): string
    {
        if (str_contains($kodikType, 'anime')) {
            return 'anime';
        }
        if (str_contains($kodikType, 'cartoon')) {
            return $type === 'series' ? 'toon' : 'cartoon';
        }

        return $type;
    }

    private function validIframe(string $link): bool
    {
        return $link !== '' && filter_var($link, FILTER_VALIDATE_URL) !== false
            && in_array(parse_url($link, PHP_URL_SCHEME), ['http', 'https'], true);
    }

    private function positiveInt(mixed $value): ?int
    {
        return is_numeric($value) && (int) $value > 0 ? (int) $value : null;
    }

    private function date(mixed $value): ?Carbon
    {
        if (! is_string($value) || trim($value) === '') {
            return null;
        }
        try {
            return Carbon::parse($value);
        } catch (\Throwable) {
            return null;
        }
    }
}

