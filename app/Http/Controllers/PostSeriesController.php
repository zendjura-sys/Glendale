<?php

namespace App\Http\Controllers;

use App\Models\Post;
use App\Models\PostSeries;
use App\Services\FriendshipService;
use App\Services\Moderation\ContentFilter;
use App\Services\PostPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/** Серії записів: автор об’єднує записи в послідовність, читачі гортають частини по порядку. */
class PostSeriesController extends Controller
{
    /** Серії автора — для вибору в меню запису. */
    public function mine(Request $request): JsonResponse
    {
        $series = PostSeries::query()->where('user_id', $request->user()->id)->withCount('posts')->latest('id')->limit(50)->get();

        return response()->json(['series' => $series->map(fn (PostSeries $s) => ['id' => $s->id, 'title' => $s->title, 'count' => (int) $s->posts_count])->values()]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'min:3', 'max:80'],
            'description' => ['nullable', 'string', 'max:500'],
        ]);
        $filter = app(ContentFilter::class);
        $filter->ensureCanPost($request->user());
        abort_if(PostSeries::query()->where('user_id', $request->user()->id)->count() >= 50, 422, 'Забагато серій — видаліть непотрібні.');
        $series = PostSeries::query()->create([
            'user_id' => $request->user()->id,
            'title' => (string) $filter->clean(trim($data['title'])),
            'description' => $filter->clean(trim((string) ($data['description'] ?? '')) ?: null),
        ]);

        return response()->json(['series' => ['id' => $series->id, 'title' => $series->title, 'count' => 0]]);
    }

    public function show(Request $request, PostSeries $series, PostPresenter $presenter, FriendshipService $friendships): Response
    {
        $viewer = $request->user();
        $posts = Post::query()->where('series_id', $series->id)
            ->visibleTo($viewer, $viewer ? $friendships->friendIds($viewer) : [])
            ->orderBy('series_position')->orderBy('id')
            ->limit(PostSeries::MAX_POSTS)->get();

        return Inertia::render('series/show', [
            'series' => [
                'id' => $series->id,
                'title' => $series->title,
                'description' => $series->description,
                'author' => $series->user?->toCard(),
                'mine' => $viewer !== null && $series->user_id === $viewer->id,
            ],
            'posts' => $presenter->many($posts, $viewer),
        ]);
    }

    /** Додати запис у серію (у кінець) або прибрати з серії (series_id = null). */
    public function attach(Request $request, Post $post): RedirectResponse
    {
        $user = $request->user();
        abort_unless($post->author_id === $user->id && ! $post->as_community, 403);
        $data = $request->validate(['series_id' => ['nullable', 'integer', Rule::exists('post_series', 'id')->where('user_id', $user->id)]]);
        $seriesId = $data['series_id'] ?? null;
        if ($seriesId === null) {
            $post->forceFill(['series_id' => null, 'series_position' => null])->save();
            Inertia::flash('toast', ['type' => 'success', 'message' => 'Запис прибрано із серії.']);

            return back();
        }
        if ($post->series_id !== (int) $seriesId) {
            $count = Post::query()->where('series_id', $seriesId)->count();
            if ($count >= PostSeries::MAX_POSTS) {
                throw ValidationException::withMessages(['series_id' => 'У серії вже '.PostSeries::MAX_POSTS.' записів.']);
            }
            $last = (int) Post::query()->where('series_id', $seriesId)->max('series_position');
            $post->forceFill(['series_id' => (int) $seriesId, 'series_position' => $last + 1])->save();
        }
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Запис додано в серію.']);

        return back();
    }

    public function destroy(Request $request, PostSeries $series): RedirectResponse
    {
        abort_unless($series->user_id === $request->user()->id, 403);
        $series->delete();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Серію видалено, записи лишилися.']);

        return to_route('feed');
    }
}
