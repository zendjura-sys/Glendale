<?php

namespace App\Http\Controllers;

use App\Models\Podcast;
use App\Models\PodcastEpisode;
use App\Models\User;
use App\Notifications\AccountNotice;
use App\Services\ImageStorage;
use App\Services\Moderation\ContentFilter;
use App\Services\Music\AudioProbe;
use App\Support\Plugins\Plugins;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Подкасти: шоу, випуски (аудіо), підписка з повідомленням про новий випуск. */
class PodcastController extends Controller
{
    public const MAX_AUDIO_KB = 204800;

    public function index(Request $request): Response|JsonResponse
    {
        app(Plugins::class)->ensure('podcasts');
        $user = $request->user();
        $category = array_key_exists((string) $request->query('category'), Podcast::CATEGORIES) ? (string) $request->query('category') : null;
        $subscribed = DB::table('podcast_subscriptions')->where('user_id', $user->id)->pluck('podcast_id')->all();

        $props = [
            'podcasts' => Podcast::query()->with('user')->withCount('episodes')->has('episodes')
                ->when($category !== null, fn (Builder $q) => $q->where('category', $category))
                ->orderByDesc('subscribers_count')->orderByDesc('id')->limit(60)->get()
                ->map(fn (Podcast $p) => $this->card($p, in_array($p->id, $subscribed)))->values()->all(),
            'mine' => Podcast::query()->where('user_id', $user->id)->withCount('episodes')->get()->map(fn (Podcast $p) => $this->card($p, false))->values()->all(),
            'categories' => Podcast::CATEGORIES,
            'category' => $category,
        ];

        // Застосунок (міст) отримує ті самі дані як JSON.
        return $request->wantsJson() ? response()->json($props) : Inertia::render('podcasts/index', $props);
    }

    public function show(Request $request, Podcast $podcast): Response|JsonResponse
    {
        app(Plugins::class)->ensure('podcasts');
        $user = $request->user();
        $subscribed = DB::table('podcast_subscriptions')->where('podcast_id', $podcast->id)->where('user_id', $user->id)->exists();

        $props = [
            'podcast' => $this->card($podcast->load('user')->loadCount('episodes'), $subscribed),
            'episodes' => $podcast->episodes()->latest('id')->limit(100)->get()->map(fn (PodcastEpisode $e) => [
                'id' => $e->id,
                'title' => $e->title,
                'description' => $e->description,
                'url' => Storage::disk('public')->url($e->audio_path),
                'duration' => $e->duration,
                'plays' => $e->plays_count,
                'created_at' => $e->created_at->toIso8601String(),
            ])->values()->all(),
            'own' => $podcast->user_id === $user->id,
        ];

        return $request->wantsJson() ? response()->json($props) : Inertia::render('podcasts/show', $props);
    }

    public function store(Request $request, ImageStorage $images): RedirectResponse
    {
        app(Plugins::class)->ensure('podcasts');
        abort_if(Podcast::query()->where('user_id', $request->user()->id)->count() >= 3, 422, 'Можна мати до трьох подкастів.');
        $data = $request->validate([
            'title' => ['required', 'string', 'min:3', 'max:120'],
            'description' => ['nullable', 'string', 'max:2000'],
            'category' => ['required', Rule::in(array_keys(Podcast::CATEGORIES))],
            'cover' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:10240'],
        ]);
        $filter = app(ContentFilter::class);
        $podcast = Podcast::query()->create([
            'user_id' => $request->user()->id,
            'title' => (string) $filter->clean(trim($data['title'])),
            'description' => $filter->clean($data['description'] ?? null),
            'category' => $data['category'],
            'cover_path' => $request->hasFile('cover') ? $images->store($request->file('cover'), 'podcasts/covers', cover: [1000, 1000])['path'] : null,
        ]);

        return to_route('podcasts.show', $podcast);
    }

    public function storeEpisode(Request $request, Podcast $podcast, AudioProbe $probe): RedirectResponse
    {
        abort_unless($podcast->user_id === $request->user()->id, 403);
        $data = $request->validate([
            'title' => ['required', 'string', 'min:3', 'max:160'],
            'description' => ['nullable', 'string', 'max:5000'],
            'audio' => ['required', 'file', 'mimes:mp3,m4a,aac,ogg,oga,opus,wav', 'max:'.self::MAX_AUDIO_KB],
        ], ['audio.mimes' => 'Додайте аудіо: MP3, M4A, OGG, OPUS або WAV.']);
        $file = $request->file('audio');
        abort_if($file === null, 422);
        $path = $file->store('podcasts/audio/'.now()->format('Y/m'), 'public');
        abort_if($path === false, 500, 'Не вдалося зберегти аудіо.');
        $meta = $probe->probe(Storage::disk('public')->path($path));
        $filter = app(ContentFilter::class);
        $podcast->episodes()->create([
            'title' => (string) $filter->clean(trim($data['title'])),
            'description' => $filter->clean($data['description'] ?? null),
            'audio_path' => $path,
            'duration' => (int) ($meta['duration'] ?? 0),
        ]);
        // Підписникам — сповіщення про новий випуск.
        $subscribers = User::query()->whereIn('id', DB::table('podcast_subscriptions')->where('podcast_id', $podcast->id)->select('user_id'))->get();
        Notification::send($subscribers, new AccountNotice('podcast', $request->user(), 'Новий випуск «'.$podcast->title.'»', trim($data['title']), '/podcasts/'.$podcast->id));
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Випуск опубліковано.']);

        return back();
    }

    public function destroyEpisode(Request $request, Podcast $podcast, PodcastEpisode $episode): RedirectResponse
    {
        abort_unless($podcast->user_id === $request->user()->id && $episode->podcast_id === $podcast->id, 403);
        Storage::disk('public')->delete($episode->audio_path);
        $episode->delete();

        return back();
    }

    public function subscribe(Request $request, Podcast $podcast): JsonResponse
    {
        app(Plugins::class)->ensure('podcasts');
        $key = ['podcast_id' => $podcast->id, 'user_id' => $request->user()->id];
        $on = ! DB::table('podcast_subscriptions')->where($key)->exists();
        $on ? DB::table('podcast_subscriptions')->insert([...$key, 'created_at' => now()]) : DB::table('podcast_subscriptions')->where($key)->delete();
        $podcast->forceFill(['subscribers_count' => DB::table('podcast_subscriptions')->where('podcast_id', $podcast->id)->count()])->save();

        return response()->json(['subscribed' => $on, 'subscribers' => $podcast->subscribers_count]);
    }

    /** Прослуховування (раз на випуск на годину від людини). */
    public function play(Request $request, Podcast $podcast, PodcastEpisode $episode): JsonResponse
    {
        abort_unless($episode->podcast_id === $podcast->id, 404);
        if (cache()->add("podcast-play:{$episode->id}:{$request->user()->id}", true, now()->addHour())) {
            $episode->increment('plays_count');
        }

        return response()->json(['ok' => true]);
    }

    /**
     * @return array<string, mixed>
     */
    private function card(Podcast $podcast, bool $subscribed): array
    {
        return [
            'id' => $podcast->id,
            'title' => $podcast->title,
            'description' => $podcast->description,
            'cover_url' => $podcast->cover_url,
            'category' => Podcast::CATEGORIES[$podcast->category] ?? $podcast->category,
            'author' => $podcast->user?->toCard(),
            'episodes' => (int) ($podcast->episodes_count ?? 0),
            'subscribers' => $podcast->subscribers_count,
            'subscribed' => $subscribed,
        ];
    }
}
