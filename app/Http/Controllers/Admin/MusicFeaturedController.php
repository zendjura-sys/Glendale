<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Playlist;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Добірки редакції для вкладки «Нове»: адміністратор позначає публічні плейлисти й обирає
 * настрій чи заняття (Playlist::CATEGORIES). Без категорії — великий банер «Добірка редакції».
 */
class MusicFeaturedController extends Controller
{
    public function featured(Request $request): Response
    {
        $filters = $request->validate(['q' => ['nullable', 'string', 'max:100']]);
        $q = trim((string) ($filters['q'] ?? ''));

        $featured = Playlist::query()->where('is_featured', true)
            ->with(['user', 'tracks' => fn ($t) => $t->limit(4)])
            ->latest('updated_at')->get();

        $found = $q === '' ? collect() : Playlist::query()
            ->where('is_featured', false)
            ->where('is_public', true)
            ->where(fn (Builder $w) => ctype_digit($q)
                ? $w->whereKey((int) $q)->orWhere('title', 'like', '%'.$q.'%')
                : $w->where('title', 'like', '%'.$q.'%'))
            ->with(['user', 'tracks' => fn ($t) => $t->limit(4)])
            ->orderByDesc('tracks_count')->limit(20)->get();

        return Inertia::render('admin/music-featured', [
            'groups' => $featured->groupBy(fn (Playlist $p) => (string) $p->category)
                ->map(fn ($items, string $category) => [
                    'category' => $category === '' ? null : $category,
                    'playlists' => $items->map(fn (Playlist $p) => $this->card($p))->values()->all(),
                ])->sortBy(fn (array $g) => $g['category'] === null ? -1 : array_search($g['category'], Playlist::CATEGORIES, true))
                ->values()->all(),
            'results' => $found->map(fn (Playlist $p) => $this->card($p))->values()->all(),
            'categories' => Playlist::CATEGORIES,
            'filters' => ['q' => $q],
        ]);
    }

    /** Позначити плейлист добіркою (і вибрати категорію) або прибрати з добірок. */
    public function feature(Request $request, Playlist $playlist): RedirectResponse
    {
        $data = $request->validate([
            'is_featured' => ['required', 'boolean'],
            'category' => ['nullable', 'string', Rule::in(Playlist::CATEGORIES)],
        ]);
        $featured = (bool) $data['is_featured'];

        if ($featured && ! $playlist->is_public) {
            throw ValidationException::withMessages(['is_featured' => 'Приватний плейлист не можна додати в добірки — автор має зробити його публічним.']);
        }

        $playlist->forceFill([
            'is_featured' => $featured,
            'category' => $featured ? ($data['category'] ?? null) : null,
        ])->save();

        Log::info('music: playlist featured', [
            'playlist' => $playlist->id,
            'featured' => $featured,
            'category' => $featured ? ($data['category'] ?? null) : null,
            'by' => $request->user()?->id,
        ]);
        Inertia::flash('toast', ['type' => 'success', 'message' => $featured ? 'Плейлист у добірках.' : 'Плейлист прибрано з добірок.']);

        return back();
    }

    /**
     * @return array<string, mixed>
     */
    private function card(Playlist $playlist): array
    {
        return [
            ...$playlist->toCard(),
            'owner' => $playlist->user->toCard(),
        ];
    }
}
