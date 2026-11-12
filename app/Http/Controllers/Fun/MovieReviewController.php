<?php

namespace App\Http\Controllers\Fun;

use App\Http\Controllers\Controller;
use App\Models\Movie;
use App\Models\MovieReview;
use App\Services\Cinema\CinemaService;
use App\Services\FriendshipService;
use App\Services\Moderation\ContentFilter;
use App\Support\Plugins\Plugins;
use App\Support\ReviewCriteria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/** Рецензії на фільми й серіали: на сторінці тайтлу та стрічка рецензій друзів і всіх. */
class MovieReviewController extends Controller
{
    public function index(Request $request, Movie $movie): JsonResponse
    {
        app(Plugins::class)->ensure('movie_reviews');
        abort_unless($movie->is_published, 404);
        $viewer = $request->user();
        $reviews = MovieReview::query()->with('user')->where('movie_id', $movie->id)
            ->orderByDesc('likes_count')->orderByDesc('id')->paginate(10);
        $liked = $this->liked($viewer->id, $reviews->getCollection()->pluck('id'));
        $all = MovieReview::query()->where('movie_id', $movie->id);

        return response()->json([
            'reviews' => $reviews->through(fn (MovieReview $r) => $r->toCard(in_array($r->id, $liked, true), $viewer->id)),
            'summary' => ['count' => (clone $all)->count(), 'average' => round((float) (clone $all)->avg('score'), 1), 'criteria' => ReviewCriteria::averages(clone $all, ReviewCriteria::MOVIE)],
            'mine' => MovieReview::query()->where('movie_id', $movie->id)->where('user_id', $viewer->id)->first()?->toCard(false, $viewer->id),
        ]);
    }

    public function store(Request $request, Movie $movie, ContentFilter $filter, CinemaService $cinema): JsonResponse
    {
        app(Plugins::class)->ensure('movie_reviews');
        abort_unless($movie->is_published, 404);
        $user = $request->user();
        $data = $request->validate([
            'body' => ['required', 'string', 'min:20', 'max:5000'],
            'score' => ['required', 'integer', 'min:1', 'max:10'],
            'spoiler' => ['required', 'boolean'],
            ...ReviewCriteria::rules(ReviewCriteria::MOVIE),
        ], ['body.min' => 'Рецензія — хоча б кілька речень (від 20 символів).']);
        $filter->ensureCanPost($user);
        $review = MovieReview::query()->updateOrCreate(
            ['user_id' => $user->id, 'movie_id' => $movie->id],
            [...$data, 'body' => (string) $filter->clean(trim($data['body'])), 'criteria' => ReviewCriteria::clean($data['criteria'] ?? null, ReviewCriteria::MOVIE)],
        );
        // Оцінка рецензії — це й оцінка людини в «Кіно».
        $cinema->rate($user, $movie, (int) $data['score']);

        return response()->json(['ok' => true, 'review' => $review->load('user')->toCard(false, $user->id), 'message' => 'Рецензію опубліковано.']);
    }

    public function destroy(Request $request, Movie $movie): JsonResponse
    {
        app(Plugins::class)->ensure('movie_reviews');
        MovieReview::query()->where('movie_id', $movie->id)->where('user_id', $request->user()->id)->delete();

        return response()->json(['ok' => true, 'message' => 'Рецензію видалено.']);
    }

    public function like(Request $request, MovieReview $review): JsonResponse
    {
        app(Plugins::class)->ensure('movie_reviews');
        $user = $request->user();
        abort_if($review->user_id === $user->id, 422, 'Свою рецензію не можна вподобати.');
        $query = DB::table('movie_review_likes')->where('movie_review_id', $review->id)->where('user_id', $user->id);
        $liked = ! $query->exists();
        $liked
            ? DB::table('movie_review_likes')->insert(['movie_review_id' => $review->id, 'user_id' => $user->id])
            : $query->delete();
        $review->update(['likes_count' => DB::table('movie_review_likes')->where('movie_review_id', $review->id)->count()]);

        return response()->json(['liked' => $liked, 'likes_count' => $review->likes_count]);
    }

    /** Стрічка рецензій: друзів (за замовчуванням) або всіх. */
    public function feed(Request $request, FriendshipService $friendships): Response
    {
        app(Plugins::class)->ensure('movie_reviews');
        $viewer = $request->user();
        $tab = $request->query('tab') === 'all' ? 'all' : 'friends';
        $friends = $friendships->friendIds($viewer);
        $reviews = MovieReview::query()->with(['user', 'movie'])
            ->whereHas('movie', fn ($q) => $q->where('is_published', true))
            ->when($tab === 'friends', fn ($q) => $q->whereIn('user_id', $friends))
            ->latest('id')->paginate(15)->withQueryString();
        $liked = $this->liked($viewer->id, $reviews->getCollection()->pluck('id'));

        return Inertia::render('cinema/reviews', [
            'tab' => $tab,
            'reviews' => Inertia::scroll(fn () => $reviews->through(fn (MovieReview $r) => $r->toCard(in_array($r->id, $liked, true), $viewer->id, true))),
        ]);
    }

    /**
     * @param  iterable<mixed>  $ids
     * @return list<int>
     */
    private function liked(int $userId, iterable $ids): array
    {
        return array_values(DB::table('movie_review_likes')->where('user_id', $userId)->whereIn('movie_review_id', $ids)
            ->pluck('movie_review_id')->map(fn ($id) => (int) $id)->all());
    }
}
