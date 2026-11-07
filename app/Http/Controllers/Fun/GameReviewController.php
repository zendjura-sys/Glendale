<?php

namespace App\Http\Controllers\Fun;

use App\Http\Controllers\Controller;
use App\Models\Game;
use App\Models\GameReview;
use App\Services\Games\CommunityRatings;
use App\Services\Moderation\ContentFilter;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/** Огляди гравців (сторінка гри) і стрічка трейлерів з каталогу. */
class GameReviewController extends Controller
{
    public function index(Request $request, Game $game): JsonResponse
    {
        app(Plugins::class)->ensure('game_reviews');
        $viewer = $request->user();
        $sort = $request->query('sort') === 'new' ? 'new' : 'helpful';
        $reviews = GameReview::query()->with('user')->where('game_id', $game->id)
            ->when($sort === 'helpful', fn ($q) => $q->orderByDesc('helpful_count'))
            ->orderByDesc('id')->paginate(10);
        $helpful = $viewer === null ? [] : DB::table('game_review_votes')->where('user_id', $viewer->id)
            ->whereIn('game_review_id', $reviews->pluck('id'))->pluck('game_review_id')->map(fn ($id) => (int) $id)->all();
        $all = GameReview::query()->where('game_id', $game->id);

        return response()->json([
            'reviews' => $reviews->through(fn (GameReview $r) => $r->toCard(in_array($r->id, $helpful, true), $viewer?->id)),
            'summary' => [
                'count' => (clone $all)->count(),
                'recommended' => (clone $all)->where('recommended', true)->count(),
                'average' => round((float) (clone $all)->avg('score'), 1),
            ],
            'mine' => $viewer ? GameReview::query()->where('game_id', $game->id)->where('user_id', $viewer->id)->first()?->toCard(false, $viewer->id) : null,
        ]);
    }

    public function store(Request $request, Game $game, ContentFilter $filter): JsonResponse
    {
        app(Plugins::class)->ensure('game_reviews');
        $user = $request->user();
        $data = $request->validate([
            'body' => ['required', 'string', 'min:20', 'max:5000'],
            'score' => ['required', 'integer', 'min:1', 'max:10'],
            'recommended' => ['required', 'boolean'],
            'hours' => ['nullable', 'integer', 'min:0', 'max:20000'],
        ], ['body.min' => 'Огляд — хоча б кілька речень (від 20 символів).']);
        $filter->ensureCanPost($user);
        $review = GameReview::query()->updateOrCreate(
            ['user_id' => $user->id, 'game_id' => $game->id],
            [...$data, 'body' => (string) $filter->clean(trim($data['body']))],
        );
        // Оцінка огляду — це й оцінка гравця в рейтингу GameCon.
        app(CommunityRatings::class)->rate($user, $game, (int) $data['score']);

        return response()->json(['ok' => true, 'review' => $review->load('user')->toCard(false, $user->id), 'message' => 'Огляд опубліковано.']);
    }

    public function destroy(Request $request, Game $game): JsonResponse
    {
        app(Plugins::class)->ensure('game_reviews');
        GameReview::query()->where('game_id', $game->id)->where('user_id', $request->user()->id)->delete();

        return response()->json(['ok' => true, 'message' => 'Огляд видалено.']);
    }

    public function helpful(Request $request, GameReview $review): JsonResponse
    {
        app(Plugins::class)->ensure('game_reviews');
        $user = $request->user();
        abort_if($review->user_id === $user->id, 422, 'Свій огляд не можна позначити корисним.');
        $voted = DB::table('game_review_votes')->where('game_review_id', $review->id)->where('user_id', $user->id)->exists();
        if ($voted) {
            DB::table('game_review_votes')->where('game_review_id', $review->id)->where('user_id', $user->id)->delete();
        } else {
            DB::table('game_review_votes')->insert(['game_review_id' => $review->id, 'user_id' => $user->id]);
        }
        $review->update(['helpful_count' => DB::table('game_review_votes')->where('game_review_id', $review->id)->count()]);

        return response()->json(['helpful' => ! $voted, 'helpful_count' => $review->helpful_count]);
    }

    /** Трейлери: ігри каталогу з відео, найновіші релізи першими. */
    public function trailers(Request $request): Response
    {
        app(Plugins::class)->ensure('game_trailers');
        $games = Game::query()->where('is_published', true)
            ->whereNotNull('details->videos')
            ->orderByDesc('released')->orderByDesc('popularity')
            ->paginate(24)->withQueryString();
        $games->setCollection($games->getCollection()
            ->filter(fn (Game $g) => is_array($g->details['videos'] ?? null) && ($g->details['videos'] ?? []) !== [])
            ->values()
            ->map(fn (Game $g) => [
                ...$g->toCard(),
                'videos' => array_values(array_slice((array) $g->details['videos'], 0, 3)),
            ]));

        return Inertia::render('games/trailers', ['games' => Inertia::scroll(fn () => $games)]);
    }
}
