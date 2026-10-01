<?php

namespace App\Http\Controllers;

use App\Models\Post;
use App\Models\User;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Inertia\Response;

class WelcomeController extends Controller
{
    public function __invoke(Request $request, SiteSettings $settings): Response|RedirectResponse
    {
        if ($request->user()) {
            return to_route('feed');
        }

        $data = Cache::remember('welcome.stats', now()->addMinutes(5), fn () => [
            'stats' => [
                'users' => User::query()->whereNull('banned_at')->count(),
                'online' => User::query()->where('last_seen_at', '>=', now()->subMinutes(5))->count(),
                'posts' => Post::query()->count(),
            ],
            'members' => User::query()
                ->whereNull('banned_at')
                ->whereNotNull('avatar_path')
                ->latest('last_seen_at')
                ->limit(12)
                ->get()
                ->map->toCard()
                ->all(),
        ]);

        return Inertia::render('welcome', [
            ...$data,
            'canRegister' => (bool) $settings->get('registration_open'),
            'tagline' => $settings->get('tagline'),
        ]);
    }
}
