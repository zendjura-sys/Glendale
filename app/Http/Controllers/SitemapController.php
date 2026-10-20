<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;

/**
 * Карта сайту для пошуковиків (/sitemap.xml): публічні сторінки й відкриті профілі.
 * Розділи за входом сюди не входять — пошуковик їх однаково не побачить. Кеш — година.
 */
class SitemapController extends Controller
{
    /** Скільки профілів у карті (обмеження одного файла sitemap — 50 000 адрес). */
    private const PROFILES = 45000;

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
                ['loc' => url('/refund-policy'), 'changefreq' => 'yearly', 'priority' => '0.3'],
            ];

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
