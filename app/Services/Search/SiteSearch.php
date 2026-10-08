<?php

namespace App\Services\Search;

use App\Models\Clan;
use App\Models\Community;
use App\Models\Family;
use App\Models\Game;
use App\Models\GtaServer;
use App\Models\Movie;
use App\Models\Track;
use App\Models\User;
use App\Support\Modules\ModuleManager;
use Illuminate\Database\Eloquent\Builder;

/**
 * Один пошук по людях, іграх, кіно, музиці, серверах, спільнотах, кланах і сім’ях.
 */
class SiteSearch
{
    public function __construct(private readonly ModuleManager $modules) {}

    /**
     * @return list<array{kind: string, title: string, hint: string, href: string}>
     */
    public function hits(string $q): array
    {
        $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $q).'%';
        $hits = [];

        User::query()->whereNull('banned_at')->where(fn (Builder $w) => $w
            ->where('username', 'like', $like)
            ->orWhere('first_name', 'like', $like)
            ->orWhere('last_name', 'like', $like)
            ->orWhere('name', 'like', $like))
            ->orderByDesc('last_seen_at')->limit(5)->get()
            ->each(function (User $user) use (&$hits) {
                $hits[] = ['kind' => 'user', 'title' => $user->name, 'hint' => '@'.$user->username, 'href' => '/'.$user->username];
            });

        if ($this->modules->enabled('communities')) {
            Community::query()->where('name', 'like', $like)->orderByDesc('members_count')->limit(3)->get()
                ->each(function (Community $community) use (&$hits) {
                    $hits[] = ['kind' => 'community', 'title' => $community->name, 'hint' => 'Спільнота', 'href' => '/c/'.$community->slug];
                });
        }
        if ($this->modules->enabled('games')) {
            Game::query()->published()->where('name', 'like', $like)->orderByDesc('popularity')->limit(3)->get()
                ->each(function (Game $game) use (&$hits) {
                    $hits[] = ['kind' => 'game', 'title' => $game->name, 'hint' => 'Гра', 'href' => '/games/'.$game->slug];
                });
        }
        if ($this->modules->enabled('cinema')) {
            Movie::query()->published()->where('title', 'like', $like)->limit(3)->get()
                ->each(function (Movie $movie) use (&$hits) {
                    $hits[] = ['kind' => 'movie', 'title' => $movie->title, 'hint' => 'Кіно', 'href' => '/cinema/'.$movie->slug];
                });
        }
        if ($this->modules->enabled('music')) {
            Track::query()->where('title', 'like', $like)->limit(3)->get()
                ->each(function (Track $track) use (&$hits) {
                    $hits[] = ['kind' => 'track', 'title' => $track->title, 'hint' => 'Музика', 'href' => '/music?q='.urlencode($track->title)];
                });
        }
        if ($this->modules->enabled('servers')) {
            GtaServer::query()->where('status', GtaServer::STATUS_PUBLISHED)->where('name', 'like', $like)->limit(3)->get()
                ->each(function (GtaServer $server) use (&$hits) {
                    $hits[] = ['kind' => 'server', 'title' => $server->name, 'hint' => 'Сервер', 'href' => '/servers/'.$server->slug];
                });
        }
        if ($this->modules->enabled('clans')) {
            Clan::query()->where('name', 'like', $like)->limit(3)->get()
                ->each(function (Clan $clan) use (&$hits) {
                    $hits[] = ['kind' => 'clan', 'title' => $clan->name, 'hint' => 'Клан', 'href' => '/clans/'.$clan->slug];
                });
        }
        if ($this->modules->enabled('families')) {
            Family::query()->where('name', 'like', $like)->limit(3)->get()
                ->each(function (Family $family) use (&$hits) {
                    $hits[] = ['kind' => 'family', 'title' => $family->name, 'hint' => 'Сім’я', 'href' => '/f/'.$family->slug];
                });
        }

        return $hits;
    }
}
