<?php

namespace App\Services\Music;

use App\Services\Spotify\SpotifyClient;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * «Про виконавця», як в Apple Music: фото, короткий опис, місто, дата народження чи заснування,
 * жанри й підписники. Джерела — Вікіпедія (українська, потім англійська) з Wikidata та
 * Spotify (якщо адмін додав ключі застосунку). Усе кешується на тиждень; збій — порожні поля.
 */
class ArtistInfo
{
    /** Слова в описі статті, що підтверджують: це саме музикант, а не тезка. */
    private const MUSIC_WORDS = '/(music|singer|rapper|band|group|DJ|producer|composer|songwriter|musician|duo|vocalist|співа|гурт|репер|музикант|композитор|діджей|продюсер|виконав|гурту|група|рок|поп|метал|хіп-хоп)/iu';

    public function __construct(private readonly SpotifyClient $spotify) {}

    /**
     * @return array{bio: ?string, bio_url: ?string, image_url: ?string, origin: ?string, born: ?string, formed: ?string, genres: list<string>, followers: int, spotify_url: ?string}
     */
    public function get(string $name): array
    {
        return Cache::remember('music.artist-info.'.md5(mb_strtolower($name)), now()->addWeek(), function () use ($name) {
            $wiki = $this->wikipedia($name, 'uk') ?? $this->wikipedia($name, 'en');
            $facts = $wiki && $wiki['wikidata'] ? $this->wikidata($wiki['wikidata']) : [];
            $spotify = null;
            try {
                $spotify = $this->spotify->configured() ? $this->spotify->artist($name) : null;
            } catch (Throwable) {
                $spotify = null;
            }

            return [
                'bio' => $wiki['extract'] ?? null,
                'bio_url' => $wiki['url'] ?? null,
                'image_url' => $spotify['image'] ?? $wiki['image'] ?? null,
                'origin' => $facts['origin'] ?? null,
                'born' => $facts['born'] ?? null,
                'formed' => $facts['formed'] ?? null,
                'genres' => array_slice($spotify['genres'] ?? [], 0, 4),
                'followers' => $spotify['followers'] ?? 0,
                'spotify_url' => $spotify['url'] ?? null,
            ];
        });
    }

    /**
     * @return array{extract: string, url: ?string, image: ?string, wikidata: ?string}|null
     */
    private function wikipedia(string $name, string $lang): ?array
    {
        try {
            $http = Http::timeout(6)->acceptJson()->withHeaders(['User-Agent' => 'GameCon (https://gamecon.online)']);
            $titles = $http->get("https://{$lang}.wikipedia.org/w/api.php", [
                'action' => 'query', 'list' => 'search', 'srsearch' => $name, 'srlimit' => 5, 'format' => 'json',
            ])->json('query.search') ?? [];
            foreach ($titles as $row) {
                $title = (string) ($row['title'] ?? '');
                // Назва статті має починатися з імені («Imagine Dragons», «Adele (співачка)»).
                if (! str_starts_with(mb_strtolower($title), mb_strtolower($name))) {
                    continue;
                }
                $page = $http->get("https://{$lang}.wikipedia.org/api/rest_v1/page/summary/".rawurlencode(str_replace(' ', '_', $title)))->json();
                if (! is_array($page) || ($page['type'] ?? '') === 'disambiguation') {
                    continue;
                }
                $about = ($page['description'] ?? '').' '.mb_substr((string) ($page['extract'] ?? ''), 0, 300);
                if (! preg_match(self::MUSIC_WORDS, $about) || blank($page['extract'] ?? null)) {
                    continue;
                }

                return [
                    'extract' => (string) $page['extract'],
                    'url' => $page['content_urls']['desktop']['page'] ?? null,
                    'image' => $page['originalimage']['source'] ?? $page['thumbnail']['source'] ?? null,
                    'wikidata' => $page['wikibase_item'] ?? null,
                ];
            }
        } catch (Throwable) {
            return null;
        }

        return null;
    }

    /**
     * Місто, дата народження чи заснування з Wikidata.
     *
     * @return array{origin?: string, born?: string, formed?: string}
     */
    private function wikidata(string $id): array
    {
        try {
            $http = Http::timeout(6)->acceptJson()->withHeaders(['User-Agent' => 'GameCon (https://gamecon.online)']);
            $claims = $http->get('https://www.wikidata.org/w/api.php', [
                'action' => 'wbgetentities', 'ids' => $id, 'props' => 'claims', 'format' => 'json',
            ])->json("entities.{$id}.claims") ?? [];
            $value = fn (string $p) => $claims[$p][0]['mainsnak']['datavalue']['value'] ?? null;
            $date = fn ($v) => is_array($v) && isset($v['time']) ? substr(ltrim((string) $v['time'], '+'), 0, 10) : null;

            $facts = array_filter([
                'born' => $date($value('P569')),
                'formed' => $date($value('P571')),
            ]);
            // P740 — де заснований гурт, P19 — місце народження.
            $place = $value('P740')['id'] ?? $value('P19')['id'] ?? null;
            if ($place) {
                $labels = $http->get('https://www.wikidata.org/w/api.php', [
                    'action' => 'wbgetentities', 'ids' => $place, 'props' => 'labels', 'languages' => 'uk|en', 'format' => 'json',
                ])->json("entities.{$place}.labels") ?? [];
                $label = $labels['uk']['value'] ?? $labels['en']['value'] ?? null;
                if ($label) {
                    $facts['origin'] = (string) $label;
                }
            }

            return $facts;
        } catch (Throwable) {
            return [];
        }
    }
}
