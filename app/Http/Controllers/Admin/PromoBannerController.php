<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PromoBanner;
use App\Models\PromoBannerVariant;
use App\Services\Growth\BannerTests;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Адмінка → Банери: A/B-тести (варіанти, ваги, CTR, упевненість), запуск, зупинка й переможець. Усе в журнал. */
class PromoBannerController extends Controller
{
    public function index(BannerTests $tests): Response
    {
        return Inertia::render('admin/banners', [
            'banners' => PromoBanner::query()->with('variants')->latest('id')->limit(50)->get()->map(fn (PromoBanner $b) => [
                'id' => $b->id,
                'name' => $b->name,
                'placement' => $b->placement,
                'status' => $b->status,
                'winner_id' => $b->winner_id,
                'created_at' => $b->created_at->toIso8601String(),
                'variants' => $tests->stats($b),
            ]),
            'placements' => PromoBanner::PLACEMENTS,
            'tones' => PromoBannerVariant::TONES,
        ]);
    }

    public function store(Request $request, BannerTests $tests): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:80'],
            'placement' => ['required', Rule::in(array_keys(PromoBanner::PLACEMENTS))],
            'variants' => ['required', 'array', 'min:1', 'max:4'],
            'variants.*.title' => ['required', 'string', 'min:3', 'max:80'],
            'variants.*.text' => ['nullable', 'string', 'max:200'],
            'variants.*.cta' => ['required', 'string', 'min:2', 'max:30'],
            'variants.*.url' => ['required', 'string', 'max:300', 'regex:#^(/[^/\s][^\s]*|/|https://[^\s]+)$#'],
            'variants.*.tone' => ['required', Rule::in(PromoBannerVariant::TONES)],
            'variants.*.weight' => ['required', 'integer', 'min:1', 'max:100'],
        ]);
        $banner = DB::transaction(function () use ($data) {
            $banner = PromoBanner::query()->create(['name' => $data['name'], 'placement' => $data['placement'], 'status' => 'draft']);
            foreach (array_values($data['variants']) as $i => $v) {
                $banner->variants()->create([...$v, 'label' => chr(65 + $i)]);
            }

            return $banner;
        });
        Log::info('admin.banner.created', ['by' => $request->user()->id, 'banner' => $banner->id, 'variants' => count($data['variants'])]);
        $tests->forget($banner->placement);

        return back()->with('success', 'Банер створено — запустіть, коли буде готово.');
    }

    public function status(Request $request, PromoBanner $banner, BannerTests $tests): RedirectResponse
    {
        $data = $request->validate(['status' => ['required', Rule::in(['running', 'stopped'])]]);
        $banner->update(['status' => $data['status'], 'starts_at' => $data['status'] === 'running' ? ($banner->starts_at ?? now()) : $banner->starts_at]);
        Log::info('admin.banner.status', ['by' => $request->user()->id, 'banner' => $banner->id, 'status' => $data['status']]);
        $tests->forget($banner->placement);

        return back();
    }

    /** Оголосити переможця: далі всі бачать лише його, тест зупинено. */
    public function winner(Request $request, PromoBanner $banner, PromoBannerVariant $variant, BannerTests $tests): RedirectResponse
    {
        abort_unless($variant->promo_banner_id === $banner->id, 404);
        $banner->update(['winner_id' => $variant->id]);
        Log::info('admin.banner.winner', ['by' => $request->user()->id, 'banner' => $banner->id, 'variant' => $variant->id, 'label' => $variant->label]);
        $tests->forget($banner->placement);

        return back()->with('success', 'Варіант '.$variant->label.' тепер бачать усі.');
    }

    public function destroy(Request $request, PromoBanner $banner, BannerTests $tests): RedirectResponse
    {
        Log::info('admin.banner.deleted', ['by' => $request->user()->id, 'banner' => $banner->id, 'name' => $banner->name]);
        $banner->delete();
        $tests->forget($banner->placement);

        return back();
    }
}
