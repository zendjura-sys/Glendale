<?php

namespace App\Services\Search;

use App\Models\Article;
use App\Models\Clan;
use App\Models\Community;
use App\Models\Family;
use App\Models\Game;
use App\Models\GameGuide;
use App\Models\GtaServer;
use App\Models\Movie;
use App\Models\Podcast;
use App\Models\Post;
use App\Models\Tournament;
use App\Models\Track;
use App\Models\User;
use App\Services\FriendshipService;
use App\Support\Modules\ModuleManager;
use App\Support\Plugins\Plugins;
use Illuminate\Database\Eloquent\Builder;

/**
 * Один пошук по людях, записах, іграх, кіно, музиці, серверах, спільнотах, кланах і сім’ях (№233: ще
 * записи, виправлення розкладки й сторінка /search з розділами). Розділ є, лише коли його модуль увімкнено.
 */
class SiteSearch
{
    public function __construct(private readonly ModuleManager $modules) {}

    /** Розділи пошуку в порядку показу → модуль, без якого розділу немає (null — є завжди). */
    public const KINDS = [
        'user' => null,
        'post' => 'feed',
        'community' => 'communities',
        'game' => 'games',
        'movie' => 'cinema',
        'track' => 'music',
        'server' => 'servers',
        'clan' => 'clans',
        'family' => 'families',
        'article' => 'articles',
        'guide' => 'games',
        'tournament' => 'servers',
        'podcast' => 'plugin:podcasts',
    ];

    /** Латинська розкладка ↔ українська (ЙЦУКЕН): «ghbdsn» → «привіт». */
    private const LAYOUT = [
        'q' => 'й', 'w' => 'ц', 'e' => 'у', 'r' => 'к', 't' => 'е', 'y' => 'н', 'u' => 'г', 'i' => 'ш', 'o' => 'щ', 'p' => 'з',
        '[' => 'х', ']' => 'ї', 'a' => 'ф', 's' => 'і', 'd' => 'в', 'f' => 'а', 'g' => 'п', 'h' => 'р', 'j' => 'о', 'k' => 'л',
        'l' => 'д', ';' => 'ж', "'" => 'є', 'z' => 'я', 'x' => 'ч', 'c' => 'с', 'v' => 'м', 'b' => 'и', 'n' => 'т', 'm' => 'ь',
        ',' => 'б', '.' => 'ю', '`' => 'ґ',
    ];

    /**
     * Пошук із виправленням розкладки: якщо за запитом нічого, а в іншій розкладці є — віддаємо те.
     *
     * @return array{q: string, fixed: string|null, hits: list<array{kind: string, title: string, hint: string, href: string}>}
     */
    public function search(string $q, ?User $viewer = null, int $per = 3, ?string $only = null): array
    {
        $hits = $this->hits($q, $viewer, $per, $only);
        if ($hits === []) {
            $swapped = self::swapLayout($q);
            if ($swapped !== null && $swapped !== $q) {
                $alt = $this->hits($swapped, $viewer, $per, $only);
                if ($alt !== []) {
                    return ['q' => $q, 'fixed' => $swapped, 'hits' => $alt];
                }
            }
        }

        return ['q' => $q, 'fixed' => null, 'hits' => $hits];
    }

    /** Той самий набір клавіш в іншій розкладці (лише коли запит цілком в одній із них). */
    public static function swapLayout(string $q): ?string
    {
        $lower = mb_strtolower($q);
        $chars = mb_str_split($lower);
        $toUk = self::LAYOUT;
        $toEn = array_flip(self::LAYOUT);
        foreach ([$toUk, $toEn] as $map) {
            $letters = array_filter($chars, fn (string $c) => trim($c) !== '' && ! is_numeric($c));
            if ($letters !== [] && array_diff($letters, array_keys($map)) === []) {
                return implode('', array_map(fn (string $c) => $map[$c] ?? $c, $chars));
            }
        }

        return null;
    }

    /**
     * @return list<array{kind: string, title: string, hint: string, href: string}>
     */
    public function hits(string $q, ?User $viewer = null, int $per = 3, ?string $only = null): array
    {
        $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $q).'%';
        $hits = [];
        $wants = fn (string $kind) => ($only === null || $only === $kind) && $this->available($kind);

        if ($wants('user')) {
            User::query()->whereNull('banned_at')->whereNull('frozen_at')->where(fn (Builder $w) => $w
                ->where('username', 'like', $like)
                ->orWhere('first_name', 'like', $like)
                ->orWhere('last_name', 'like', $like)
                ->orWhere('name', 'like', $like))
                ->orderByDesc('last_seen_at')->limit($only === null ? $per + 2 : $per)->get()
                ->each(function (User $user) use (&$hits) {
                    $hits[] = ['kind' => 'user', 'title' => $user->name, 'hint' => '@'.$user->username, 'href' => '/'.$user->username];
                });
        }
        // Записи — лише ті, що людина й так бачить у стрічці (друзі, списки, закриті спільноти, блокування).
        if ($wants('post') && mb_strlen($q) >= 3) {
            $friendIds = $viewer ? app(FriendshipService::class)->friendIds($viewer) : [];
            Post::query()->visibleTo($viewer, $friendIds)
                ->where(fn (Builder $w) => $w->where('subscribers_only', false)->when($viewer, fn ($w) => $w->orWhere('author_id', $viewer?->id)))
                ->where('body', 'like', $like)->with('author')->latest('id')->limit($per)->get()
                ->each(function (Post $post) use (&$hits, $q) {
                    $hits[] = ['kind' => 'post', 'title' => self::excerpt((string) $post->body, $q), 'hint' => $post->author?->name ?? 'Запис', 'href' => '/posts/'.$post->id];
                });
        }
        if ($wants('community')) {
            Community::query()->where('is_listed', true)->where('name', 'like', $like)->orderByDesc('members_count')->limit($per)->get()
                ->each(function (Community $community) use (&$hits) {
                    $hits[] = ['kind' => 'community', 'title' => $community->name, 'hint' => 'Спільнота', 'href' => '/c/'.$community->slug];
                });
        }
        if ($wants('game')) {
            Game::query()->published()->where('name', 'like', $like)->orderByDesc('popularity')->limit($per)->get()
                ->each(function (Game $game) use (&$hits) {
                    $hits[] = ['kind' => 'game', 'title' => $game->name, 'hint' => 'Гра', 'href' => '/games/'.$game->slug];
                });
        }
        if ($wants('movie')) {
            Movie::query()->published()->search($q)->limit($per)->get()
                ->each(function (Movie $movie) use (&$hits) {
                    $hits[] = ['kind' => 'movie', 'title' => $movie->title, 'hint' => 'Кіно', 'href' => '/cinema/'.$movie->slug];
                });
        }
        if ($wants('track')) {
            Track::query()->where('title', 'like', $like)->limit($per)->get()
                ->each(function (Track $track) use (&$hits) {
                    $hits[] = ['kind' => 'track', 'title' => $track->title, 'hint' => 'Музика', 'href' => '/music?q='.urlencode($track->title)];
                });
        }
        if ($wants('server')) {
            GtaServer::query()->where('status', GtaServer::STATUS_PUBLISHED)->where('name', 'like', $like)->limit($per)->get()
                ->each(function (GtaServer $server) use (&$hits) {
                    $hits[] = ['kind' => 'server', 'title' => $server->name, 'hint' => 'Сервер', 'href' => '/servers/'.$server->slug];
                });
        }
        if ($wants('clan')) {
            Clan::query()->where('name', 'like', $like)->limit($per)->get()
                ->each(function (Clan $clan) use (&$hits) {
                    $hits[] = ['kind' => 'clan', 'title' => $clan->name, 'hint' => 'Клан', 'href' => '/clans/'.$clan->slug];
                });
        }
        if ($wants('family')) {
            Family::query()->where('name', 'like', $like)->limit($per)->get()
                ->each(function (Family $family) use (&$hits) {
                    $hits[] = ['kind' => 'family', 'title' => $family->name, 'hint' => 'Сім’я', 'href' => '/f/'.$family->slug];
                });
        }

        if ($wants('article')) {
            Article::query()->published()->where(fn (Builder $w) => $w->where('title', 'like', $like)->orWhere('excerpt', 'like', $like))
                ->latest('published_at')->limit($per)->get()
                ->each(function (Article $article) use (&$hits) {
                    $hits[] = ['kind' => 'article', 'title' => $article->title, 'hint' => 'Стаття', 'href' => '/articles/'.$article->slug];
                });
        }
        if ($wants('guide')) {
            GameGuide::query()->where('title', 'like', $like)->whereHas('game', fn ($g) => $g->published())->with('game')->latest('id')->limit($per)->get()
                ->each(function (GameGuide $guide) use (&$hits) {
                    $hits[] = ['kind' => 'guide', 'title' => $guide->title, 'hint' => 'Гайд · '.$guide->game?->name, 'href' => '/games/'.$guide->game?->slug];
                });
        }
        if ($wants('tournament')) {
            Tournament::query()->where('status', '!=', Tournament::CANCELLED)->where('title', 'like', $like)->latest('id')->limit($per)->get()
                ->each(function (Tournament $tournament) use (&$hits) {
                    $hits[] = ['kind' => 'tournament', 'title' => $tournament->title, 'hint' => 'Турнір', 'href' => '/tournaments/'.$tournament->id];
                });
        }
        if ($wants('podcast')) {
            Podcast::query()->where('title', 'like', $like)->orderByDesc('subscribers_count')->limit($per)->get()
                ->each(function (Podcast $podcast) use (&$hits) {
                    $hits[] = ['kind' => 'podcast', 'title' => $podcast->title, 'hint' => 'Подкаст', 'href' => '/podcasts/'.$podcast->id];
                });
        }

        return $hits;
    }

    /** Розділ є в режимі глядача: увімкнено модуль (або плагін для «plugin:…»). */
    public function available(string $kind): bool
    {
        if (! array_key_exists($kind, self::KINDS)) {
            return false;
        }
        $need = self::KINDS[$kind];
        if ($need === null) {
            return true;
        }

        return str_starts_with($need, 'plugin:')
            ? app(Plugins::class)->on(substr($need, 7))
            : $this->modules->enabled($need);
    }

    /** Уривок запису навколо знайденого слова (до ~90 символів). */
    private static function excerpt(string $body, string $q): string
    {
        $text = trim((string) preg_replace('/\s+/u', ' ', strip_tags($body)));
        $at = mb_stripos($text, $q);
        $from = $at === false ? 0 : max(0, $at - 30);
        $cut = mb_substr($text, $from, 90);

        return ($from > 0 ? '…' : '').$cut.(mb_strlen($text) > $from + 90 ? '…' : '');
    }

    /**
     * Ігри за популярністю каталогу і фільми за переглядами на сайті.
     *
     * @return list<array{kind: string, title: string, hint: string, href: string}>
     */
    public function popular(): array
    {
        if (! app(Plugins::class)->on('popular_search')) {
            return [];
        }
        $hits = [];
        if ($this->modules->enabled('games')) {
            Game::query()->published()->orderByDesc('popularity')->orderBy('name')->limit(4)->get()
                ->each(function (Game $game) use (&$hits) {
                    $hits[] = ['kind' => 'game', 'title' => $game->name, 'hint' => 'Гра', 'href' => '/games/'.$game->slug];
                });
        }
        if ($this->modules->enabled('cinema')) {
            Movie::query()->published()->orderByDesc('views_count')->orderByDesc('id')->limit(4)->get()
                ->each(function (Movie $movie) use (&$hits) {
                    $hits[] = ['kind' => 'movie', 'title' => $movie->title, 'hint' => 'Кіно', 'href' => '/cinema/'.$movie->slug];
                });
        }

        return $hits;
    }
}
