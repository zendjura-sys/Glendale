<?php

namespace App\Services\Games;

use App\Models\Game;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * Каталог мультиплеєрних ігор: стартовий список і щоденне оновлення з IGDB (основне джерело) або RAWG.
 * Ключі — в адмінці (Інтеграції → Каталог ігор) або в .env (IGDB_CLIENT_ID / IGDB_CLIENT_SECRET, RAWG_KEY).
 */
class GameCatalog
{
    /** Платформи RAWG для кожного розділу каталогу. */
    private const GROUPS = [
        'pc' => ['platforms' => '4'],
        'mobile' => ['platforms' => '21,3'],
        'console' => ['parent_platforms' => '2,3,7'],
    ];

    /** Магазини RAWG → наші ключі посилань. */
    private const STORES = [1 => 'steam', 2 => 'xbox', 3 => 'playstation', 4 => 'appstore', 5 => 'gog', 6 => 'nintendo', 7 => 'xbox', 8 => 'gplay', 9 => 'itch', 11 => 'epic'];

    /** Платформи RAWG (slug) → наші. */
    private const PLATFORMS = [
        'pc' => 'pc', 'macos' => 'mac', 'linux' => 'linux', 'android' => 'android', 'ios' => 'ios',
        'playstation5' => 'playstation', 'playstation4' => 'playstation', 'playstation3' => 'playstation',
        'xbox-series-x' => 'xbox', 'xbox-one' => 'xbox', 'xbox360' => 'xbox', 'nintendo-switch' => 'switch',
    ];

    public function __construct(private readonly SiteSettings $settings, private readonly Igdb $igdb) {}

    public function key(): ?string
    {
        $value = $this->settings->secret('rawg_key') ?? config('services.rawg.key');

        return is_string($value) && $value !== '' ? $value : null;
    }

    /** Чи є хоч одне джерело для автооновлення. */
    public function configured(): bool
    {
        return $this->igdb->configured() || $this->key() !== null;
    }

    public function source(): ?string
    {
        return $this->igdb->configured() ? 'IGDB' : ($this->key() !== null ? 'RAWG' : null);
    }

    /** Перевірка ключа RAWG з адмінки. */
    public function test(): bool
    {
        return $this->request('games', ['page_size' => 1]) !== null;
    }

    /**
     * Оновлює каталог: популярні мультиплеєрні ігри кожного розділу, потім посилання на магазини.
     *
     * @return array{games: int, links: int}
     */
    public function sync(int $pages = 5, int $linkLimit = 150): array
    {
        if ($this->igdb->configured()) {
            return $this->syncIgdb($pages);
        }
        if ($this->key() === null) {
            return ['games' => 0, 'links' => 0];
        }

        $count = 0;
        foreach (self::GROUPS as $category => $filter) {
            for ($page = 1; $page <= $pages; $page++) {
                $data = $this->request('games', [...$filter, 'tags' => 'multiplayer', 'ordering' => '-added', 'page_size' => 40, 'page' => $page]);
                $results = is_array($data['results'] ?? null) ? $data['results'] : [];
                foreach ($results as $row) {
                    if (is_array($row) && $this->upsert($row, $category)) {
                        $count++;
                    }
                }
                if (empty($data['next'])) {
                    break;
                }
            }
        }

        $links = 0;
        Game::query()->whereNotNull('rawg_id')
            ->where(fn ($q) => $q->whereNull('links_checked_at')->orWhere('links_checked_at', '<', now()->subDays(30)))
            ->orderByDesc('popularity')
            ->limit($linkLimit)
            ->get()
            ->each(function (Game $game) use (&$links) {
                $data = $this->request("games/{$game->rawg_id}/stores", []);
                $found = [];
                foreach (is_array($data['results'] ?? null) ? $data['results'] : [] as $row) {
                    $store = self::STORES[(int) ($row['store_id'] ?? 0)] ?? null;
                    $url = is_string($row['url'] ?? null) ? trim($row['url']) : '';
                    if ($store && str_starts_with($url, 'https://')) {
                        $found[$store] = ['store' => $store, 'url' => $url];
                    }
                }
                // Посилання зі стартового списку (офіційний сайт тощо) лишаються, нові — додаються.
                $merged = [];
                foreach ([...($game->links ?? []), ...array_values($found)] as $link) {
                    $merged[$link['store']] = $link;
                }
                $game->update(['links' => array_values($merged), 'links_checked_at' => now()]);
                $links++;
            });

        return ['games' => $count, 'links' => $links];
    }

    /**
     * IGDB віддає разом з грою все для її картки, тож окремий прохід по посиланнях не потрібен.
     *
     * @return array{games: int, links: int}
     */
    private function syncIgdb(int $pages): array
    {
        $count = 0;
        $links = 0;
        foreach (array_keys(Igdb::GROUPS) as $category) {
            for ($page = 0; $page < $pages; $page++) {
                $rows = $this->igdb->games($category, $page * 250);
                $beat = $this->igdb->timeToBeat(array_values(array_filter(array_map(fn (array $r) => (int) ($r['id'] ?? 0), $rows ?? []))));
                foreach ($rows ?? [] as $row) {
                    $found = $this->upsertIgdb($row, $category, $beat[(int) ($row['id'] ?? 0)] ?? null);
                    if ($found !== null) {
                        $count++;
                        $links += $found;
                    }
                }
                if ($rows === null || count($rows) < 250) {
                    break;
                }
                usleep(300_000); // IGDB дозволяє 4 запити на секунду.
            }
        }

        return ['games' => $count, 'links' => $links];
    }

    /**
     * @param  array<string, mixed>  $row
     * @param  array{hastily: int|null, normally: int|null, completely: int|null}|null  $timeToBeat
     * @return int|null null — пропущено; інакше кількість знайдених посилань на магазини
     */
    private function upsertIgdb(array $row, string $category, ?array $timeToBeat): ?int
    {
        $igdbId = (int) ($row['id'] ?? 0);
        $name = trim((string) ($row['name'] ?? ''));
        $slug = Str::limit(Str::slug((string) ($row['slug'] ?? $name)), 120, '');
        if ($igdbId === 0 || $name === '' || $slug === '') {
            return null;
        }
        $data = IgdbMapper::map($row);
        $details = $data['details'];
        if ($timeToBeat !== null && array_filter($timeToBeat) !== []) {
            $details['time_to_beat'] = array_filter($timeToBeat);
        }

        $game = Game::query()->where('igdb_id', $igdbId)->first()
            ?? Game::query()->where('slug', $slug)->whereNull('igdb_id')->first()
            ?? new Game(['slug' => $slug, 'category' => $category]);

        // Посилання зі стартового списку лишаються, знайдені в IGDB — додаються або оновлюються.
        $merged = [];
        foreach ([...($game->links ?? []), ...array_values($data['links'])] as $link) {
            $merged[$link['store']] = $link;
        }
        $game->fill([
            'name' => Str::limit($name, 160, ''),
            'aliases' => $data['aliases'],
            'letter' => Game::letterOf($name),
            'platforms' => $data['platforms'] ?: $game->platforms,
            'genres' => $data['genres'] ?: $game->genres,
            'modes' => $data['modes'] ?: $game->modes,
            // Обкладинки зі стартового списку (банери Steam) лишаються — вони ширші й чіткіші.
            'cover' => $game->cover ?? $data['cover'],
            'released' => $data['released'] ?? $game->released,
            'rating' => $data['rating'] ?? $game->rating,
            'popularity' => max($data['popularity'], $game->popularity ?? 0),
            'links' => array_values($merged),
            'details' => $details,
            'links_checked_at' => now(),
            'igdb_id' => $igdbId,
        ]);
        if (! $game->exists && Game::query()->where('slug', $slug)->exists()) {
            $game->slug = Str::limit($slug, 110, '').'-'.$igdbId;
        }
        $game->save();

        return count($data['links']);
    }

    /**
     * Стартовий список популярних мультиплеєрних ігор — щоб каталог не був порожнім до ключа RAWG.
     */
    public function seed(): int
    {
        $count = 0;
        foreach (GameSeedList::all() as $row) {
            $game = Game::query()->firstOrNew(['slug' => $row['slug']]);
            if (! $game->exists) {
                $game->fill([
                    'name' => $row['name'],
                    'letter' => Game::letterOf($row['name']),
                    'category' => $row['category'],
                    'platforms' => $row['platforms'],
                    'genres' => $row['genres'],
                    'links' => $row['links'],
                    'cover' => $row['cover'] ?? null,
                    'popularity' => $row['popularity'],
                ])->save();
                $count++;
            }
        }

        return $count;
    }

    /**
     * @param  array<string, mixed>  $row
     */
    private function upsert(array $row, string $category): bool
    {
        $rawgId = (int) ($row['id'] ?? 0);
        $name = trim((string) ($row['name'] ?? ''));
        $slug = Str::limit((string) ($row['slug'] ?? Str::slug($name)), 120, '');
        if ($rawgId === 0 || $name === '' || $slug === '') {
            return false;
        }

        $platforms = [];
        foreach (is_array($row['platforms'] ?? null) ? $row['platforms'] : [] as $p) {
            $key = self::PLATFORMS[(string) ($p['platform']['slug'] ?? '')] ?? null;
            if ($key) {
                $platforms[$key] = $key;
            }
        }
        $genres = [];
        foreach (is_array($row['genres'] ?? null) ? $row['genres'] : [] as $g) {
            if (is_string($g['name'] ?? null)) {
                $genres[] = $g['name'];
            }
        }

        $game = Game::query()->where('rawg_id', $rawgId)->first()
            ?? Game::query()->where('slug', $slug)->whereNull('rawg_id')->first()
            ?? new Game(['slug' => $slug, 'category' => $category]);

        // Якщо гра є і на ПК, і на телефонах — розділ лишається той, де її знайшли першою (ПК раніше).
        $game->fill([
            'name' => Str::limit($name, 160, ''),
            'letter' => Game::letterOf($name),
            'platforms' => array_values($platforms) ?: $game->platforms,
            'genres' => array_slice($genres, 0, 5) ?: $game->genres,
            'cover' => is_string($row['background_image'] ?? null) ? $row['background_image'] : $game->cover,
            'released' => is_string($row['released'] ?? null) ? $row['released'] : $game->released,
            'rating' => is_numeric($row['rating'] ?? null) ? round((float) $row['rating'], 2) : $game->rating,
            'popularity' => max((int) ($row['added'] ?? 0), $game->popularity ?? 0),
            'rawg_id' => $rawgId,
        ]);
        if (! $game->exists && Game::query()->where('slug', $slug)->exists()) {
            $game->slug = Str::limit($slug, 110, '').'-'.$rawgId;
        }
        $game->save();

        return true;
    }

    /**
     * @param  array<string, mixed>  $query
     * @return array<string, mixed>|null
     */
    private function request(string $path, array $query): ?array
    {
        $key = $this->key();
        if ($key === null) {
            return null;
        }
        try {
            $response = Http::timeout(15)->acceptJson()
                ->get(rtrim((string) config('services.rawg.url', 'https://api.rawg.io/api'), '/').'/'.$path, [...$query, 'key' => $key]);
        } catch (ConnectionException) {
            return null;
        }
        $data = $response->successful() ? $response->json() : null;

        return is_array($data) ? $data : null;
    }
}
