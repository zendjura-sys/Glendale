<?php

namespace App\Http\Controllers;

use App\Models\Game;
use App\Models\User;
use App\Support\Help\HelpCatalog;
use App\Support\Modules\ModuleManager;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;

/**
 * Карта сайту для пошуковиків (/sitemap.xml): публічні сторінки, ігри й відкриті профілі.
 * Розділи за входом сюди не входять — пошуковик їх однаково не побачить. Кеш — година.
 */
class SitemapController extends Controller
{
    /** Скільки профілів у карті (обмеження одного файла sitemap — 50 000 адрес). */
    private const PROFILES = 40000;

    /** Скільки сторінок ігор у карті. */
    private const GAMES = 5000;

    public function __invoke(): Response
    {
        $xml = Cache::remember('sitemap.xml', now()->addHour(), function () {
            $urls = [
                ['loc' => url('/'), 'changefreq' => 'daily', 'priority' => '1.0'],
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

            // Каталог ігор і сторінки опублікованих ігор (якщо розділ увімкнено).
            if (app(ModuleManager::class)->enabled('games')) {
                $urls[] = ['loc' => url('/games'), 'changefreq' => 'daily', 'priority' => '0.8'];
                Game::query()->published()->orderByDesc('popularity')->limit(self::GAMES)
                    ->get(['slug', 'updated_at'])
                    ->each(function (Game $game) use (&$urls) {
                        $urls[] = ['loc' => url('/games/'.$game->slug), 'lastmod' => $game->updated_at?->toAtomString(), 'changefreq' => 'weekly', 'priority' => '0.7'];
                    });
            }

            // Лише відкриті профілі: не закриті, не заблоковані, не заморожені, з підтвердженою поштою.
            User::query()
                ->where('is_private', false)
                ->whereNull('banned_at')
                ->whereNull('frozen_at')
                ->whereNotNull('email_verified_at')
                ->whereNotNull('username')
                ->orderByDesc('updated_at')
                ->limit(self::PROFILES)
                ->get(['username', 'updated_at'])
                ->each(function (User $user) use (&$urls) {
                    $urls[] = ['loc' => url('/'.$user->username), 'lastmod' => $user->updated_at?->toAtomString(), 'changefreq' => 'weekly', 'priority' => '0.5'];
                });

            return view('seo.sitemap', ['urls' => $urls])->render();
        });

        return response($xml, 200, ['Content-Type' => 'application/xml; charset=UTF-8']);
    }
}
