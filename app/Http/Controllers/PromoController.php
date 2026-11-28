<?php

namespace App\Http\Controllers;

use App\Models\PromoBannerVariant;
use App\Services\Growth\BannerTests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/** Банери для людей: показ (з A/B-варіантом), перехід із підрахунком кліку й «закрити». */
class PromoController extends Controller
{
    public function show(Request $request, string $placement, BannerTests $tests): JsonResponse
    {
        return response()->json(['banner' => $tests->for($request->user(), $placement)]);
    }

    public function click(Request $request, PromoBannerVariant $variant): RedirectResponse
    {
        $user = $request->user();
        if (Cache::add("promo:click:{$variant->id}:{$user->id}", 1, now()->addDay())) {
            $variant->increment('clicks');
        }
        $url = $variant->url;
        // Лише свої сторінки або https — без javascript: та подібного.
        abort_unless(str_starts_with($url, '/') && ! str_starts_with($url, '//') || str_starts_with($url, 'https://'), 404);

        return str_starts_with($url, '/') ? redirect($url) : redirect()->away($url);
    }

    public function dismiss(Request $request, int $banner): JsonResponse
    {
        $user = $request->user();
        $list = array_values(array_unique([...array_map('intval', (array) $user->pref('dismissed_banners', [])), $banner]));
        $user->mergePref(['dismissed_banners' => array_slice($list, -50)]);

        return response()->json(['ok' => true]);
    }
}
