<?php

namespace App\Services\Music;

use App\Models\Track;
use App\Services\Spotify\SpotifyClient;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * «Про виконавця», як в Apple Music: фото, короткий опис, місто, дата народження чи заснування,
 * жанри, підписники й схожі виконавці. Джерела працюють разом: Вікіпедія (українська, потім
 * англійська) з Wikidata, MusicBrainz, Spotify, Discogs і Last.fm (якщо адмін додав ключі).
 * Для кожного поля — найнадійніше значення (MetaMatch, збіг джерел — бонус). Особу звіряємо:
 * MBID ↔ Wikidata (посилання MusicBrainz і P434), а також посилання MusicBrainz на Spotify й Discogs,
 * тож тезка з іншої статті чи іншого акаунта відкидається. Усе кешується на тиждень; збій — порожні поля.
 */
class ArtistInfo
{
    /** Слова в описі статті, що підтверджують: це саме музикант, а не тезка. */
    private const MUSIC_WORDS = '/(music|singer|rapper|band|group|DJ|producer|composer|songwriter|musician|duo|vocalist|співа|гурт|репер|музикант|композитор|діджей|продюсер|виконав|гурту|група|рок|поп|метал|хіп-хоп)/iu';

    /** Бонус довіри джерелу, особу якого підтвердило посилання з MusicBrainz. */
    private const VERIFIED_BONUS = 10;

    public function __construct(
        private readonly SpotifyClient $spotify,
        private readonly MusicBrainz $musicbrainz,
        private readonly Discogs $discogs,
        private readonly LastFm $lastfm,
    ) {}

    /**
     * @return array{bio: ?string, bio_url: ?string, image_url: ?string, origin: ?string, born: ?string, formed: ?string, genres: list<string>, followers: int, spotify_url: ?string, mbid: ?string, similar: list<string>}
     */
    public function get(string $name): array
    {
        return Cache::remember($this->key($name), now()->addWeek(), fn () => $this->resolve($name));
    }

    /**
     * Лише з кешу (без мережі) — для карток виконавців на сторінках каталогу.
     *
     * @return array<string, mixed>|null
     */
    public function cached(string $name): ?array
    {
        $info = Cache::get($this->key($name));

        return is_array($info) ? $info : null;
    }

    public function cachedImage(string $name): ?string
    {
        $image = $this->cached($name)['image_url'] ?? null;

        return is_string($image) && $image !== '' ? $image : null;
    }

    private function key(string $name): string
    {
        return 'music.artist-info.'.md5(mb_strtolower($name));
    }

    /**
     * @return array{bio: ?string, bio_url: ?string, image_url: ?string, origin: ?string, born: ?string, formed: ?string, genres: list<string>, followers: int, spotify_url: ?string, mbid: ?string, similar: list<string>}
     */
    private function resolve(string $name): array
    {
        // MusicBrainz: MBID з розпізнаних треків (відбиток AcoustID — найнадійніше), інакше пошук за ім'ям.
        $hint = Track::query()->where('artist', $name)->whereNotNull('artist_mbid')->value('artist_mbid');
        $mb = $this->safe(function () use ($name, $hint) {
            $id = $hint ?: ($this->musicbrainz->searchArtists($name)[0]['id'] ?? null);

            return is_string($id) && $id !== '' ? $this->musicbrainz->artist($id) : null;
        });
        $links = $this->links($mb);

        // Вікіпедія: стаття тезки (інший елемент Wikidata, ніж у MusicBrainz) відкидається.
        $wiki = $this->wikipedia($name, 'uk') ?? $this->wikipedia($name, 'en');
        if ($links['wikidata'] !== null && ($wiki === null || $wiki['wikidata'] !== $links['wikidata'])) {
            $wiki = $this->wikipediaByWikidata($links['wikidata']);
        }
        $entity = $wiki['wikidata'] ?? $links['wikidata'];
        $facts = $entity ? $this->wikidata($entity) : [];

        // P434 у Wikidata — MBID виконавця. Не збігся: якщо MBID підтверджений відбитком, тезка — стаття;
        // інакше тезка — знайдений за ім'ям запис MusicBrainz, і беремо той, на який вказує Wikidata.
        if ($mb !== null && isset($facts['mbid']) && $facts['mbid'] !== ($mb['id'] ?? null)) {
            if ($hint) {
                $wiki = null;
                $facts = [];
            } else {
                $mb = $this->safe(fn () => $this->musicbrainz->artist($facts['mbid']));
                $links = $this->links($mb);
            }
        } elseif ($mb === null && isset($facts['mbid']) && $this->musicbrainz->enabled()) {
            $mb = $this->safe(fn () => $this->musicbrainz->artist($facts['mbid']));
            $links = $this->links($mb);
        }
        $wikiVerified = $wiki !== null && $mb !== null && ($links['wikidata'] === $wiki['wikidata'] || ($facts['mbid'] ?? null) === ($mb['id'] ?? null));

        $spotify = $this->safe(fn () => $this->spotify->configured() ? $this->spotify->artist($name) : null);
        if ($spotify !== null && $links['spotify'] !== null && $spotify['id'] !== $links['spotify']) {
            $spotify = null;
        }
        $discogs = $this->safe(fn () => $this->discogs->configured() ? $this->discogs->artist($name, $links['discogs']) : null);
        if ($discogs !== null && $links['discogs'] !== null && $discogs['id'] !== $links['discogs']) {
            $discogs = null;
        }
        $lastfm = $this->safe(fn () => $this->lastfm->configured() ? $this->lastfm->artist($name, isset($mb['id']) ? (string) $mb['id'] : null) : null);
        if ($lastfm !== null && ! MetaMatch::sameArtist((string) ($lastfm['name'] ?? ''), $name)) {
            $lastfm = null;
        }

        $bonus = fn (bool $verified) => $verified ? self::VERIFIED_BONUS : 0;
        $candidates = [];
        $add = function (string $field, mixed $value, string $source, float $score) use (&$candidates) {
            if (filled($value)) {
                $candidates[] = ['field' => $field, 'value' => $value, 'source' => $source, 'score' => $score];
            }
        };

        // Фото: Spotify > Wikidata (P18) > Вікіпедія > Discogs; у Last.fm — лише заглушки, не беремо.
        $add('image', $spotify['image'] ?? null, 'spotify', 70 + $bonus($links['spotify'] !== null));
        $add('image', $facts['image'] ?? null, 'wikidata', 65 + $bonus($wikiVerified));
        $add('image', $wiki['image'] ?? null, 'wikipedia', 60 + $bonus($wikiVerified));
        $add('image', $discogs['image'] ?? null, 'discogs', 55 + $bonus($links['discogs'] !== null));

        $add('bio', $wiki !== null ? ['text' => $wiki['extract'], 'url' => $wiki['url']] : null, 'wikipedia', 70 + $bonus($wikiVerified));
        $add('bio', $this->lastfmBio($lastfm), 'lastfm', 55);
        $add('bio', isset($discogs['profile']) ? ['text' => $discogs['profile'], 'url' => null] : null, 'discogs', 45 + $bonus($links['discogs'] !== null));

        $add('origin', $facts['origin'] ?? null, 'wikidata', 70);
        $add('origin', $mb['begin-area']['name'] ?? $mb['area']['name'] ?? null, 'musicbrainz', 65);
        $add('born', $facts['born'] ?? null, 'wikidata', 70);
        $add('formed', $facts['formed'] ?? null, 'wikidata', 70);
        $begin = $mb['life-span']['begin'] ?? null;
        if (is_string($begin) && $begin !== '') {
            $add(strtolower((string) ($mb['type'] ?? '')) === 'person' ? 'born' : 'formed', $begin, 'musicbrainz', 65);
        }

        $winners = MetaMatch::pick($candidates);
        $bio = $winners['bio']['value'] ?? null;
        $similar = $lastfm['similar']['artist'] ?? [];

        return [
            'bio' => is_array($bio) ? (string) $bio['text'] : null,
            'bio_url' => is_array($bio) && is_string($bio['url'] ?? null) ? $bio['url'] : null,
            'image_url' => $this->text($winners['image']['value'] ?? null),
            'origin' => $this->text($winners['origin']['value'] ?? null),
            'born' => $this->text($winners['born']['value'] ?? null),
            'formed' => $this->text($winners['formed']['value'] ?? null),
            'genres' => $this->genres([
                [60, $spotify['genres'] ?? []],
                [55, $mb !== null ? MusicBrainz::genres($mb) : []],
                [50, LastFm::genres($lastfm)],
            ]),
            'followers' => $spotify['followers'] ?? 0,
            'spotify_url' => $spotify['url'] ?? null,
            'mbid' => isset($mb['id']) ? (string) $mb['id'] : null,
            'similar' => array_values(array_slice(array_filter(array_map(
                fn ($a) => is_array($a) ? trim((string) ($a['name'] ?? '')) : '',
                is_array($similar) ? $similar : [],
            )), 0, 10)),
        ];
    }

    private function text(mixed $value): ?string
    {
        return is_string($value) && $value !== '' ? $value : null;
    }

    /**
     * Жанри з кількох джерел: довіра джерела мінус місце в списку, однакові — складаються. До чотирьох.
     *
     * @param  list<array{0: int, 1: list<string>}>  $sources
     * @return list<string>
     */
    private function genres(array $sources): array
    {
        $scores = [];
        $names = [];
        foreach ($sources as [$weight, $list]) {
            foreach (array_slice($list, 0, 6) as $i => $genre) {
                $key = MetaMatch::normalize((string) $genre);
                if ($key === '') {
                    continue;
                }
                $scores[$key] = ($scores[$key] ?? 0) + $weight - 5 * $i;
                $names[$key] ??= MusicBrainz::genreName((string) $genre);
            }
        }
        arsort($scores);

        return array_values(array_map(fn ($key) => $names[$key], array_slice(array_keys($scores), 0, 4)));
    }

    /**
     * Посилання з MusicBrainz: Wikidata (Q…), Spotify (ID виконавця), Discogs (ID виконавця).
     *
     * @param  array<string, mixed>|null  $mb
     * @return array{wikidata: ?string, spotify: ?string, discogs: ?int}
     */
    private function links(?array $mb): array
    {
        $links = ['wikidata' => null, 'spotify' => null, 'discogs' => null];
        foreach ((array) ($mb['relations'] ?? []) as $relation) {
            $url = is_array($relation) ? (string) ($relation['url']['resource'] ?? '') : '';
            if (preg_match('#wikidata\.org/wiki/(Q\d+)#', $url, $m)) {
                $links['wikidata'] = $m[1];
            } elseif (preg_match('#open\.spotify\.com/artist/([A-Za-z0-9]+)#', $url, $m)) {
                $links['spotify'] = $m[1];
            } elseif (preg_match('#discogs\.com/artist/(\d+)#', $url, $m)) {
                $links['discogs'] = (int) $m[1];
            }
        }

        return $links;
    }

    /**
     * Коротка біографія Last.fm без HTML і приписки «Read more on Last.fm».
     *
     * @param  array<string, mixed>|null  $lastfm
     * @return array{text: string, url: ?string}|null
     */
    private function lastfmBio(?array $lastfm): ?array
    {
        $summary = (string) ($lastfm['bio']['summary'] ?? '');
        $text = trim(html_entity_decode(strip_tags((string) preg_replace('/<a href="[^"]*last\.fm[^"]*">.*?<\/a>\.?/s', '', $summary))));

        return $text !== '' ? ['text' => $text, 'url' => is_string($lastfm['url'] ?? null) ? $lastfm['url'] : null] : null;
    }

    /**
     * @template T
     *
     * @param  callable(): T  $call
     * @return T|null
     */
    private function safe(callable $call): mixed
    {
        try {
            return $call();
        } catch (Throwable) {
            return null;
        }
    }

    /**
     * @return array{extract: string, url: ?string, image: ?string, wikidata: ?string}|null
     */
    private function wikipedia(string $name, string $lang): ?array
    {
        try {
            $titles = $this->http()->get("https://{$lang}.wikipedia.org/w/api.php", [
                'action' => 'query', 'list' => 'search', 'srsearch' => $name, 'srlimit' => 5, 'format' => 'json',
            ])->json('query.search') ?? [];
            foreach ($titles as $row) {
                $title = (string) ($row['title'] ?? '');
                // Назва статті має починатися з імені («Imagine Dragons», «Adele (співачка)»).
                if (! str_starts_with(mb_strtolower($title), mb_strtolower($name))) {
                    continue;
                }
                $page = $this->summary($lang, $title, true);
                if ($page !== null) {
                    return $page;
                }
            }
        } catch (Throwable) {
            return null;
        }

        return null;
    }

    /**
     * Стаття за елементом Wikidata (особу вже підтвердив MusicBrainz): українська, потім англійська.
     *
     * @return array{extract: string, url: ?string, image: ?string, wikidata: ?string}|null
     */
    private function wikipediaByWikidata(string $id): ?array
    {
        try {
            $links = $this->http()->get('https://www.wikidata.org/w/api.php', [
                'action' => 'wbgetentities', 'ids' => $id, 'props' => 'sitelinks', 'sitefilter' => 'ukwiki|enwiki', 'format' => 'json',
            ])->json("entities.{$id}.sitelinks") ?? [];
            foreach (['uk', 'en'] as $lang) {
                $title = $links[$lang.'wiki']['title'] ?? null;
                if (is_string($title) && ($page = $this->summary($lang, $title, false)) !== null) {
                    return [...$page, 'wikidata' => $id];
                }
            }
        } catch (Throwable) {
            return null;
        }

        return null;
    }

    /**
     * @return array{extract: string, url: ?string, image: ?string, wikidata: ?string}|null
     */
    private function summary(string $lang, string $title, bool $checkMusic): ?array
    {
        $page = $this->http()->get("https://{$lang}.wikipedia.org/api/rest_v1/page/summary/".rawurlencode(str_replace(' ', '_', $title)))->json();
        if (! is_array($page) || ($page['type'] ?? '') === 'disambiguation' || blank($page['extract'] ?? null)) {
            return null;
        }
        $about = ($page['description'] ?? '').' '.mb_substr((string) ($page['extract'] ?? ''), 0, 300);
        if ($checkMusic && ! preg_match(self::MUSIC_WORDS, $about)) {
            return null;
        }

        return [
            'extract' => (string) $page['extract'],
            'url' => $page['content_urls']['desktop']['page'] ?? null,
            'image' => $page['originalimage']['source'] ?? $page['thumbnail']['source'] ?? null,
            'wikidata' => $page['wikibase_item'] ?? null,
        ];
    }

    /**
     * Місто, дата народження чи заснування, фото (P18 через Commons) і MBID (P434) з Wikidata.
     *
     * @return array{origin?: string, born?: string, formed?: string, image?: string, mbid?: string}
     */
    private function wikidata(string $id): array
    {
        try {
            $http = $this->http();
            $claims = $http->get('https://www.wikidata.org/w/api.php', [
                'action' => 'wbgetentities', 'ids' => $id, 'props' => 'claims', 'format' => 'json',
            ])->json("entities.{$id}.claims") ?? [];
            $value = fn (string $p) => $claims[$p][0]['mainsnak']['datavalue']['value'] ?? null;
            $date = fn ($v) => is_array($v) && isset($v['time']) ? substr(ltrim((string) $v['time'], '+'), 0, 10) : null;
            $image = $value('P18');
            $mbid = $value('P434');

            $facts = array_filter([
                'born' => $date($value('P569')),
                'formed' => $date($value('P571')),
                'image' => is_string($image) && $image !== '' ? 'https://commons.wikimedia.org/wiki/Special:FilePath/'.rawurlencode(str_replace(' ', '_', $image)).'?width=600' : null,
                'mbid' => is_string($mbid) && $mbid !== '' ? $mbid : null,
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

    private function http(): PendingRequest
    {
        return Http::timeout(6)->acceptJson()->withHeaders(['User-Agent' => 'GameCon (https://gamecon.online)']);
    }
}
