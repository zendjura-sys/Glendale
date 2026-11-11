<?php

namespace App\Http\Controllers;

use App\Models\Clan;
use App\Models\Community;
use App\Models\Game;
use App\Models\GtaServer;
use App\Models\Movie;
use App\Models\User;
use App\Support\Help\HelpCatalog;
use App\Support\Modules\ModuleManager;
use App\Support\Plugins\Plugins;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;

/**
 * Карта сайту для пошуковиків: /sitemap.xml — індекс, /sitemaps/{частина}.xml — сторінки, ігри, кіно, сервери,
 * клани, спільноти й відкриті профілі.
 * Розділи за входом сюди не входять — пошуковик їх однаково не побачить. Кеш — година.
 */
class SitemapController extends Controller
{
    /** Скільки профілів у карті (обмеження одного файла sitemap — 50 000 адрес). */
    private const PROFILES = 40000;

    /** Скільки сторінок ігор у карті. */
    private const GAMES = 5000;

    /** Частини карти сайту: кожна — окремий файл (до 50 000 адрес у кожному). */
    private const PARTS = ['pages', 'games', 'cinema', 'servers', 'clans', 'communities', 'profiles'];

    /** Скільки тайтлів кіно, серверів і кланів у карті. */
    private const TITLES = 20000;

    /** /sitemap.xml — індекс частин (лише ті, де є адреси). */
    public function __invoke(): Response
    {
        $xml = Cache::remember('sitemap.index', now()->addHour(), function () {
            $parts = array_values(array_filter(self::PARTS, fn (string $part) => $this->urls($part) !== []));

            return view('seo.sitemap-index', ['parts' => array_map(fn (string $part) => [
                'loc' => url('/sitemaps/'.$part.'.xml'),
                'lastmod' => now()->startOfHour()->toAtomString(),
            ], $parts)])->render();
        });

        return response($xml, 200, ['Content-Type' => 'application/xml; charset=UTF-8']);
    }

    /** /sitemaps/{part}.xml — одна частина. */
    public function part(string $part): Response
    {
        abort_unless(in_array($part, self::PARTS, true), 404);
        $xml = Cache::remember('sitemap.'.$part, now()->addHour(), fn () => view('seo.sitemap', ['urls' => $this->urls($part)])->render());

        return response($xml, 200, ['Content-Type' => 'application/xml; charset=UTF-8']);
    }

    /**
     * @return list<array{loc: string, lastmod?: string|null, changefreq: string, priority: string}>
     */
    private function urls(string $part): array
    {
        return Cache::remember('sitemap.urls.'.$part, now()->addHour(), fn () => match ($part) {
            'pages' => $this->pages(),
            'games' => $this->games(),
            'cinema' => $this->cinema(),
            'servers' => $this->servers(),
            'clans' => $this->clans(),
            'communities' => $this->communities(),
            'profiles' => $this->profiles(),
        });
    }

    /** @return list<array<string, string|null>> */
    private function pages(): array
    {
        $urls = [
            ['loc' => url('/'), 'changefreq' => 'daily', 'priority' => '1.0'],
            ['loc' => url('/app'), 'changefreq' => 'weekly', 'priority' => '0.8'],
            ['loc' => url('/register'), 'changefreq' => 'monthly', 'priority' => '0.6'],
            ['loc' => url('/login'), 'changefreq' => 'monthly', 'priority' => '0.4'],
            ['loc' => url('/pricing'), 'changefreq' => 'weekly', 'priority' => '0.6'],
            ['loc' => url('/contacts'), 'changefreq' => 'monthly', 'priority' => '0.5'],
            ['loc' => url('/terms'), 'changefreq' => 'yearly', 'priority' => '0.3'],
            ['loc' => url('/privacy'), 'changefreq' => 'yearly', 'priority' => '0.3'],
            ['loc' => url('/child-safety'), 'changefreq' => 'yearly', 'priority' => '0.3'],
            ['loc' => url('/refund-policy'), 'changefreq' => 'yearly', 'priority' => '0.3'],
        ];
        // Довідка: головна, розділи й статті (лише розділи з увімкненими модулями).
        $urls[] = ['loc' => url('/help'), 'lastmod' => HelpCatalog::UPDATED, 'changefreq' => 'weekly', 'priority' => '0.7'];
        foreach (app(HelpCatalog::class)->categories() as $category) {
            $urls[] = ['loc' => url('/help/'.$category['slug']), 'lastmod' => HelpCatalog::UPDATED, 'changefreq' => 'monthly', 'priority' => '0.5'];
            foreach ($category['articles'] as $article) {
                $urls[] = ['loc' => url('/help/'.$category['slug'].'/'.$article['slug']), 'lastmod' => HelpCatalog::UPDATED, 'changefreq' => 'monthly', 'priority' => '0.5'];
            }
        }

        return $urls;
    }

    /** @return list<array<string, string|null>> */
    private function games(): array
    {
        if (! app(ModuleManager::class)->enabled('games')) {
            return [];
        }
        $urls = [['loc' => url('/games'), 'changefreq' => 'daily', 'priority' => '0.8']];
        Game::query()->published()->orderByDesc('popularity')->limit(self::GAMES)->get(['slug', 'updated_at'])
            ->each(function (Game $game) use (&$urls) {
                $urls[] = ['loc' => url('/games/'.$game->slug), 'lastmod' => $game->updated_at?->toAtomString(), 'changefreq' => 'weekly', 'priority' => '0.7'];
            });

        return $urls;
    }

    /**
     * Опубліковані тайтли кіно (сторінка відкрита гостям як картка).
     *
     * @return list<array<string, string|null>>
     */
    private function cinema(): array
    {
        if (! app(ModuleManager::class)->enabled('cinema')) {
            return [];
        }

        return Movie::query()->published()->orderByDesc('updated_at')->limit(self::TITLES)->get(['slug', 'updated_at'])
            ->map(fn (Movie $movie) => ['loc' => url('/cinema/'.$movie->slug), 'lastmod' => $movie->updated_at?->toAtomString(), 'changefreq' => 'weekly', 'priority' => '0.6'])
            ->values()->all();
    }

    /** @return list<array<string, string|null>> */
    private function servers(): array
    {
        if (! app(ModuleManager::class)->enabled('servers')) {
            return [];
        }

        return GtaServer::query()->published()->orderBy('position')->limit(self::TITLES)->get(['slug', 'updated_at'])
            ->map(fn (GtaServer $server) => ['loc' => url('/servers/'.$server->slug), 'lastmod' => $server->updated_at?->toAtomString(), 'changefreq' => 'daily', 'priority' => '0.7'])
            ->values()->all();
    }

    /**
     * Клани з учасниками (порожні — не варті індексу).
     *
     * @return list<array<string, string|null>>
     */
    private function clans(): array
    {
        if (! app(ModuleManager::class)->enabled('clans')) {
            return [];
        }

        return Clan::query()->where('members_count', '>', 0)->orderByDesc('members_count')->limit(self::TITLES)->get(['slug', 'updated_at'])
            ->map(fn (Clan $clan) => ['loc' => url('/clans/'.$clan->slug), 'lastmod' => $clan->updated_at?->toAtomString(), 'changefreq' => 'weekly', 'priority' => '0.5'])
            ->values()->all();
    }

    /**
     * Каталог спільнот і сторінки тих, що дозволили перегляд гостям (відкриті й показані в каталозі).
     *
     * @return list<array<string, string|null>>
     */
    private function communities(): array
    {
        if (! app(ModuleManager::class)->enabled('communities')) {
            return [];
        }
        $urls = [['loc' => url('/communities'), 'changefreq' => 'daily', 'priority' => '0.7']];
        if (app(Plugins::class)->on('community_access')) {
            Community::query()->where('guest_view', true)->where('is_listed', true)->where('privacy', Community::PRIVACY_OPEN)
                ->orderByDesc('members_count')->limit(self::GAMES)->get(['slug', 'updated_at'])
                ->each(function (Community $community) use (&$urls) {
                    $urls[] = ['loc' => url('/c/'.$community->slug.'/guest'), 'lastmod' => $community->updated_at?->toAtomString(), 'changefreq' => 'daily', 'priority' => '0.6'];
                });
        }

        return $urls;
    }

    /**
     * Лише відкриті профілі: не закриті, не заблоковані, не заморожені, з підтвердженою поштою.
     *
     * @return list<array<string, string|null>>
     */
    private function profiles(): array
    {
        return User::query()
            ->where('is_private', false)
            ->whereNull('banned_at')
            ->whereNull('frozen_at')
            ->whereNotNull('email_verified_at')
            ->whereNotNull('username')
            ->orderByDesc('updated_at')
            ->limit(self::PROFILES)
            ->get(['username', 'updated_at'])
            ->map(fn (User $user) => ['loc' => url('/'.$user->username), 'lastmod' => $user->updated_at?->toAtomString(), 'changefreq' => 'weekly', 'priority' => '0.5'])
            ->values()->all();
    }
}
