<?php

namespace App\Services\Feed;

use App\Models\GameBacklog;
use App\Models\GameGiveaway;
use App\Models\LiveShow;
use App\Models\Movie;
use App\Models\Post;
use App\Models\Track;
use App\Models\User;
use App\Services\Cinema\AiPicks;
use App\Services\Games\Giveaways;
use App\Services\Music\MusicCatalog;
use App\Services\Shows\LiveShows;
use App\Support\Modules\ModuleManager;
use App\Support\Plugins\Plugins;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Віджети ПК і планшета біля стрічки: музика (продовжити / нове), «Що подивитися» (ШІ),
 * роздачі ігор і GameCast в ефірі. Кожен — лише якщо його розділ увімкнено.
 */
class SideWidgets
{
    /**
     * @return array<string, mixed>
     */
    public function for(User $user): array
    {
        $modules = app(ModuleManager::class);
        $plugins = app(Plugins::class);

        return [
            'continue' => $this->continue($user, $modules),
            'music' => $modules->enabled('music') ? $this->music($user) : null,
            'cinema' => $modules->enabled('cinema') ? app(AiPicks::class)->for($user) : null,
            'giveaways' => $modules->enabled('games') ? Cache::remember('widgets:giveaways', 600, fn () => app(Giveaways::class)->active(3)
                ->map(fn (GameGiveaway $g) => $g->toCard())->values()->all()) : null,
            'gamecast' => $plugins->on('live_shows') ? $this->gamecast() : null,
        ];
    }

    /**
     * «Продовжити»: на чому людина зупинилась — серія тайтлу з «Дивлюся», остання пісня,
     * гра в процесі й незавершена чернетка запису. Найсвіжіше — першим, до шести пунктів.
     *
     * @return list<array{kind: string, title: string, hint: string, href: string, image: string|null, at: string}>
     */
    public function continue(User $user, ModuleManager $modules): array
    {
        $items = [];
        if ($modules->enabled('cinema')) {
            DB::table('movie_user')->join('movies', 'movies.id', '=', 'movie_user.movie_id')
                ->where('movie_user.user_id', $user->id)->where('movie_user.status', 'watching')->where('movies.is_published', true)
                ->orderByDesc('movie_user.updated_at')->limit(3)
                ->get(['movies.id', 'movie_user.season', 'movie_user.episode', 'movie_user.updated_at'])
                ->each(function ($row) use (&$items) {
                    $movie = Movie::query()->find($row->id);
                    if (! $movie) {
                        return;
                    }
                    $hint = $row->episode ? ($row->season ? "Сезон {$row->season}, серія ".($row->episode + 1) : 'Серія '.($row->episode + 1)) : 'Продовжити перегляд';
                    $items[] = ['kind' => 'movie', 'title' => $movie->title, 'hint' => $hint, 'href' => '/cinema/'.$movie->slug, 'image' => $movie->poster, 'at' => (string) $row->updated_at];
                });
        }
        if ($modules->enabled('music')) {
            $last = DB::table('music_plays')->where('user_id', $user->id)->whereNotNull('track_id')->latest('played_at')->first(['track_id', 'played_at']);
            $track = $last ? Track::query()->find($last->track_id) : null;
            if ($track) {
                $items[] = ['kind' => 'track', 'title' => $track->title, 'hint' => $track->artist, 'href' => '/music', 'image' => $track->cover_url, 'at' => (string) $last->played_at, 'track' => app(MusicCatalog::class)->recentlyPlayed($user, 1)[0] ?? null];
            }
        }
        if ($modules->enabled('games')) {
            GameBacklog::query()->with('game')->where('user_id', $user->id)->where('status', GameBacklog::PLAYING)
                ->latest('updated_at')->limit(2)->get()
                ->each(function (GameBacklog $b) use (&$items) {
                    if ($b->game) {
                        $items[] = ['kind' => 'game', 'title' => $b->game->name, 'hint' => 'Граю зараз', 'href' => '/games/'.$b->game->slug, 'image' => $b->game->cover, 'at' => $b->updated_at->toDateTimeString()];
                    }
                });
        }
        $draft = Post::query()->where('author_id', $user->id)->where('is_draft', true)->latest('updated_at')->first();
        if ($draft) {
            $items[] = ['kind' => 'draft', 'title' => Str::limit((string) $draft->body, 60) ?: 'Чернетка', 'hint' => 'Незавершена чернетка', 'href' => '/posts/drafts', 'image' => null, 'at' => $draft->updated_at->toDateTimeString()];
        }
        usort($items, fn (array $a, array $b) => strcmp($b['at'], $a['at']));

        return array_slice($items, 0, 6);
    }

    /**
     * @return array{mode: string, tracks: list<array<string, mixed>>}
     */
    private function music(User $user): array
    {
        $catalog = app(MusicCatalog::class);
        $recent = $catalog->recentlyPlayed($user, 4);
        if ($recent !== []) {
            return ['mode' => 'recent', 'tracks' => $recent];
        }

        return ['mode' => 'new', 'tracks' => array_slice($catalog->newest($user)['latest_songs'] ?? [], 0, 4)];
    }

    /**
     * @return array{live: int, listeners: int, shows: list<array<string, mixed>>}
     */
    private function gamecast(): array
    {
        $shows = app(LiveShows::class);

        return [
            ...$shows->pulse(),
            'shows' => Cache::remember('widgets:gamecast', 30, fn () => LiveShow::query()->where('status', LiveShow::LIVE)
                ->latest('id')->limit(3)->get()->map(fn (LiveShow $s) => $shows->card($s))->values()->all()),
        ];
    }
}
