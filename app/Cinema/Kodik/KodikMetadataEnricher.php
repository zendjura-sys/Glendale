<?php

namespace App\Cinema\Kodik;

use App\Cinema\Shikimori;
use App\Cinema\Tmdb;
use Illuminate\Support\Facades\Http;

final class KodikMetadataEnricher
{
    public function enrich(array $item): array
    {
        $material = is_array($item['material_data'] ?? null) ? $item['material_data'] : [];
        $imdb = $item['imdb_id'] ?? $material['imdb_id'] ?? null;
        if (Tmdb::configured() && is_string($imdb) && preg_match('/^tt[0-9]+$/', $imdb)) {
            try {
                $series = str_contains((string) ($item['type'] ?? ''), 'serial');
                $found = Tmdb::get('find/'.$imdb, ['external_source' => 'imdb_id']);
                $matches = $found[$series ? 'tv_results' : 'movie_results'] ?? [];
                if (is_array($matches) && count($matches) === 1 && ! empty($matches[0]['id'])) {
                    $data = Tmdb::get(($series ? 'tv/' : 'movie/').(int) $matches[0]['id']);
                    $extra = [
                        'localized_name' => $data[$series ? 'name' : 'title'] ?? null,
                        'title_en' => $data[$series ? 'original_name' : 'original_title'] ?? null,
                        'description' => $data['overview'] ?? null,
                        'poster_url' => Tmdb::image($data['poster_path'] ?? null),
                        'duration' => $data['runtime'] ?? $data['episode_run_time'][0] ?? null,
                    ];
                    $material = array_replace($material, array_filter($extra, fn ($v) => $v !== null && $v !== ''));
                }
            } catch (\Throwable) {
                // Enrichment is optional; provider diagnostics must not expose credentials.
            }
        }
        $shikimori = $item['shikimori_id'] ?? $material['shikimori_id'] ?? null;
        if (is_numeric($shikimori) && (int) $shikimori > 0
            && (empty($material['description']) || empty($material['poster_url']))) {
            try {
                $response = Http::timeout(10)->connectTimeout(5)->acceptJson()
                    ->withHeaders(['User-Agent' => 'GameConnect CineCon (+https://gamecon.online)'])
                    ->get(Shikimori::API.'/animes/'.(int) $shikimori);
                $data = $response->successful() ? $response->json() : null;
                if (is_array($data) && (int) ($data['id'] ?? 0) === (int) $shikimori) {
                    $material['localized_name'] ??= $data['russian'] ?? $data['name'] ?? null;
                    if (empty($material['description'])) {
                        $material['description'] = trim(strip_tags((string) ($data['description'] ?? '')));
                    }
                    if (empty($material['poster_url'])) {
                        $image = (string) ($data['image']['original'] ?? '');
                        $material['poster_url'] = $image === '' ? null
                            : (str_starts_with($image, '/') ? 'https://shikimori.one'.$image : $image);
                    }
                }
            } catch (\Throwable) {
                // Kodik metadata and playable sources remain usable.
            }
        }
        $item['material_data'] = $material;

        return $item;
    }
}

