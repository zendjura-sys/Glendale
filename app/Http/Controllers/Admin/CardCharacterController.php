<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CardCharacter;
use App\Models\Movie;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/** Адмінка → Картки персонажів: що підтягнулося з Shikimori й TMDB, приховати зайве, додати вручну. */
class CardCharacterController extends Controller
{
    public function index(Request $request): Response
    {
        $q = trim((string) $request->query('q', ''));

        return Inertia::render('admin/card-characters', [
            'characters' => CardCharacter::query()->with('movie:id,title,type')
                ->when($q !== '', fn ($query) => $query->where('name', 'like', "%{$q}%"))
                ->latest('id')->paginate(40)->withQueryString()
                ->through(fn (CardCharacter $c) => [
                    'id' => $c->id, 'name' => $c->name, 'image_url' => $c->image_url, 'role' => $c->role,
                    'source' => $c->source, 'is_hidden' => $c->is_hidden, 'movie' => $c->movie?->title,
                ]),
            'movies' => Movie::query()->where('is_published', true)->orderBy('title')->limit(500)->get(['id', 'title'])
                ->map(fn (Movie $m) => ['id' => $m->id, 'title' => $m->title]),
            'q' => $q,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'movie_id' => ['required', 'integer', 'exists:movies,id'],
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'image_url' => ['nullable', 'url:https', 'max:500'],
            'role' => ['required', 'in:main,supporting'],
        ]);
        $c = CardCharacter::query()->create([...$data, 'source' => 'manual', 'source_id' => (string) Str::uuid(), 'popularity' => $data['role'] === 'main' ? 100 : 40]);
        Cache::forget('cards.catalog');
        Log::info('admin: card character added', ['admin' => $request->user()->id, 'character' => $c->id]);

        return back()->with('success', 'Персонажа додано.');
    }

    public function toggle(Request $request, CardCharacter $character): RedirectResponse
    {
        // Приховуємо, а не видаляємо: картки, які вже є в людей, лишаються в їхніх альбомах.
        $character->update(['is_hidden' => ! $character->is_hidden]);
        Cache::forget('cards.catalog');
        Log::info('admin: card character '.($character->is_hidden ? 'hidden' : 'shown'), ['admin' => $request->user()->id, 'character' => $character->id]);

        return back();
    }

    public function sync(Request $request): RedirectResponse
    {
        Artisan::call('cards:characters', ['--limit' => 20]);
        Log::info('admin: card characters sync', ['admin' => $request->user()->id]);

        return back()->with('success', trim(Artisan::output()));
    }
}
