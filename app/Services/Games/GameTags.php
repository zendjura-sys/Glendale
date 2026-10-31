<?php

namespace App\Services\Games;

use App\Models\Game;
use App\Models\Post;
use App\Support\Plugins\Plugins;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * #Згадки ігор у текстах: #cs2, #dota-2, #minecraft — за slug, назвою без пробілів і псевдонімами.
 * Записи з такими тегами видно на сторінці гри.
 */
class GameTags
{
    private const PATTERN = '/(?<![\p{L}\p{N}&#])#([\p{L}\p{N}][\p{L}\p{N}_\-]{1,39})/u';

    /**
     * Теги з тексту (як написано, без «#»).
     *
     * @return list<string>
     */
    public static function extract(?string $text): array
    {
        if ($text === null || preg_match_all(self::PATTERN, $text, $m) < 1) {
            return [];
        }

        return array_values(array_unique(array_map(fn (string $t) => rtrim($t, '-_'), $m[1])));
    }

    public static function normalize(string $tag): string
    {
        return (string) preg_replace('/[^\p{L}\p{N}]/u', '', mb_strtolower($tag));
    }

    /**
     * Ігри для тегів тексту: тег (як написано) → картка гри.
     *
     * @return array<string, array{tag: string, slug: string, name: string}>
     */
    public function resolve(?string $text): array
    {
        $tags = self::extract($text);
        if ($tags === [] || ! app(Plugins::class)->on('game_tags')) {
            return [];
        }
        $index = $this->index();
        $ids = [];
        foreach ($tags as $tag) {
            if (isset($index[self::normalize($tag)])) {
                $ids[$tag] = $index[self::normalize($tag)];
            }
        }
        if ($ids === []) {
            return [];
        }
        $games = Game::query()->whereIn('id', array_values($ids))->get(['id', 'slug', 'name'])->keyBy('id');
        $out = [];
        foreach ($ids as $tag => $id) {
            if ($game = $games->get($id)) {
                $out[$tag] = ['tag' => $tag, 'slug' => $game->slug, 'name' => $game->name];
            }
        }

        return $out;
    }

    /** Оновити зв’язок запису з іграми після збереження. */
    public function sync(Post $post): void
    {
        $ids = array_values(array_unique(array_map(fn (string $tag) => $this->index()[self::normalize($tag)] ?? 0, self::extract($post->body))));
        $ids = array_values(array_filter($ids));
        DB::table('post_game')->where('post_id', $post->id)->delete();
        if ($ids !== []) {
            DB::table('post_game')->insert(array_map(fn (int $id) => ['post_id' => $post->id, 'game_id' => $id], array_slice($ids, 0, 5)));
        }
    }

    /**
     * Нормалізований тег → id гри (slug, назва, псевдоніми). Кеш на годину.
     *
     * @return array<string, int>
     */
    public function index(): array
    {
        /** @var array<string, int> */
        return Cache::remember('games.tags', now()->addHour(), function () {
            $map = [];
            Game::query()->published()->orderBy('popularity')->select(['id', 'slug', 'name', 'aliases'])->cursor()->each(function (Game $g) use (&$map) {
                foreach ([$g->slug, $g->name, ...explode(' | ', (string) $g->aliases)] as $name) {
                    $key = self::normalize((string) $name);
                    if (mb_strlen($key) >= 2 && ! isset($map[$key])) {
                        $map[$key] = $g->id;
                    }
                }
            });

            return $map;
        });
    }
}
