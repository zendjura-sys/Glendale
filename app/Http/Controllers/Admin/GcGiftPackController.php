<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\GcGift;
use App\Models\GcGiftPack;
use App\Support\Shows\GiftRarities;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Адмінка: паки подарунків GameCast (назву задає адміністратор) і каталог рідкостей.
 */
class GcGiftPackController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('admin/gift-packs', [
            'packs' => GcGiftPack::query()->orderBy('position')->orderBy('id')->get()->map->toCard()->values(),
            'gifts' => GcGift::query()->orderBy('id')->get()
                ->sortBy(fn (GcGift $g) => GiftRarities::meta($g->rarity)['order'] ?? 99)
                ->values()->map->toCard()->values(),
            'rarities' => array_values(GiftRarities::catalog()),
            'defaults' => [
                'odds' => GiftRarities::defaultOdds(),
                'price' => 4900,
                'gifts_count' => 5,
                'pity_after' => 12,
            ],
            'stats' => [
                'packs' => GcGiftPack::query()->count(),
                'gifts' => GcGift::query()->count(),
                'active_packs' => GcGiftPack::query()->where('is_active', true)->count(),
            ],
        ]);
    }

    public function storePack(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:80'],
            'description' => ['nullable', 'string', 'max:280'],
            'emoji' => ['nullable', 'string', 'max:16'],
            'price' => ['required', 'integer', 'min:100', 'max:10000000'],
            'gifts_count' => ['required', 'integer', 'min:1', 'max:30'],
            'pity_after' => ['required', 'integer', 'min:0', 'max:50'],
            'odds' => ['nullable', 'array'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        GcGiftPack::query()->create([
            'name' => trim($data['name']),
            'slug' => GcGiftPack::makeSlug($data['name']),
            'description' => $data['description'] ?? null,
            'emoji' => trim((string) ($data['emoji'] ?? '🎁')) ?: '🎁',
            'price' => $data['price'],
            'gifts_count' => $data['gifts_count'],
            'pity_after' => $data['pity_after'],
            'odds' => GiftRarities::sanitizeOdds($data['odds'] ?? null),
            'is_active' => $data['is_active'] ?? true,
            'position' => (int) GcGiftPack::query()->max('position') + 1,
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Пак «'.trim($data['name']).'» створено.']);

        return back();
    }

    public function updatePack(Request $request, GcGiftPack $pack): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'min:2', 'max:80'],
            'description' => ['sometimes', 'nullable', 'string', 'max:280'],
            'emoji' => ['sometimes', 'nullable', 'string', 'max:16'],
            'price' => ['sometimes', 'integer', 'min:100', 'max:10000000'],
            'gifts_count' => ['sometimes', 'integer', 'min:1', 'max:30'],
            'pity_after' => ['sometimes', 'integer', 'min:0', 'max:50'],
            'odds' => ['sometimes', 'array'],
            'is_active' => ['sometimes', 'boolean'],
            'move' => ['sometimes', Rule::in(['up', 'down'])],
        ]);

        if (isset($data['move'])) {
            $this->move($pack, $data['move']);
            unset($data['move']);
        }
        if (array_key_exists('odds', $data)) {
            $data['odds'] = GiftRarities::sanitizeOdds($data['odds']);
        }
        if (isset($data['name'])) {
            $data['name'] = trim($data['name']);
        }
        $pack->update($data);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Пак оновлено.']);

        return back();
    }

    public function destroyPack(GcGiftPack $pack): RedirectResponse
    {
        $pack->delete();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Пак видалено.']);

        return back();
    }

    public function storeGift(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:80'],
            'emoji' => ['required', 'string', 'max:16'],
            'rarity' => ['required', Rule::in(GiftRarities::keys())],
            'flavor' => ['nullable', 'string', 'max:200'],
            'stock' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        if ($data['rarity'] === GiftRarities::UNIQUE && ! array_key_exists('stock', $data)) {
            $data['stock'] = 1;
        }
        GcGift::query()->create([
            ...$data,
            'is_active' => $data['is_active'] ?? true,
        ]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Подарунок додано в каталог.']);

        return back();
    }

    public function updateGift(Request $request, GcGift $gift): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'min:2', 'max:80'],
            'emoji' => ['sometimes', 'required', 'string', 'max:16'],
            'rarity' => ['sometimes', Rule::in(GiftRarities::keys())],
            'flavor' => ['sometimes', 'nullable', 'string', 'max:200'],
            'stock' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:100000'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        $gift->update($data);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Подарунок оновлено.']);

        return back();
    }

    public function destroyGift(GcGift $gift): RedirectResponse
    {
        $gift->delete();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Подарунок видалено.']);

        return back();
    }

    private function move(GcGiftPack $pack, string $direction): void
    {
        $ordered = GcGiftPack::query()->orderBy('position')->orderBy('id')->get()->values();
        $index = $ordered->search(fn (GcGiftPack $p) => $p->is($pack));
        if ($index === false) {
            return;
        }
        $swap = $direction === 'up' ? $index - 1 : $index + 1;
        if ($swap < 0 || $swap >= $ordered->count()) {
            return;
        }
        $a = $ordered[$index];
        $b = $ordered[$swap];
        $pos = $a->position;
        $a->update(['position' => $b->position]);
        $b->update(['position' => $pos]);
    }
}
