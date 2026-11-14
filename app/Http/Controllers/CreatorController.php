<?php

namespace App\Http\Controllers;

use App\Services\Profile\AuthorStats;
use App\Services\SecretAchievements;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Статистика автора, піксельний аватар і пасхалки секретних досягнень. */
class CreatorController extends Controller
{
    public function stats(Request $request, AuthorStats $stats): JsonResponse
    {
        app(Plugins::class)->ensure('author_stats');

        return response()->json($stats->for($request->user()));
    }

    /** Редактор піксельного аватара (малюється в браузері, зберігається звичайним завантаженням аватара). */
    public function pixel(): Response
    {
        app(Plugins::class)->ensure('pixel_avatar');

        return Inertia::render('settings/pixel-avatar');
    }

    /** Пасхалку знайдено в браузері: відкрити секретне досягнення. */
    public function secret(Request $request, string $key, SecretAchievements $secrets): JsonResponse
    {
        abort_unless(in_array($key, SecretAchievements::CLIENT, true), 404);

        return response()->json(['unlocked' => $secrets->unlock($request->user(), $key)]);
    }
}
