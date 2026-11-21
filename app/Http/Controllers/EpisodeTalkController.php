<?php

namespace App\Http\Controllers;

use App\Models\Movie;
use App\Models\User;
use App\Services\Moderation\ContentFilter;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Оцінки й обговорення серій (№271). Без спойлерів: якщо людина ще не відмітила серію
 * переглянутою, тексти коментарів не віддаються зовсім (лише кількість) — поки не відкриє
 * сама (reveal) або не відмітить серію.
 */
class EpisodeTalkController extends Controller
{
    public function show(Request $request, Movie $movie, int $season, int $episode): JsonResponse
    {
        app(Plugins::class)->ensure('episode_talk');
        abort_unless($movie->is_published || $request->user()->isStaff(), 404);

        return response()->json($this->state($movie, $request->user(), $season, $episode, $request->boolean('reveal')));
    }

    public function rate(Request $request, Movie $movie, int $season, int $episode): JsonResponse
    {
        app(Plugins::class)->ensure('episode_talk');
        abort_unless($movie->is_published, 404);
        $data = $request->validate(['score' => ['required', 'integer', 'min:1', 'max:5']]);
        DB::table('episode_ratings')->updateOrInsert(
            ['movie_id' => $movie->id, 'season' => $season, 'episode' => $episode, 'user_id' => $request->user()->id],
            ['score' => (int) $data['score'], 'updated_at' => now(), 'created_at' => now()],
        );

        return response()->json($this->state($movie, $request->user(), $season, $episode, true));
    }

    public function comment(Request $request, Movie $movie, int $season, int $episode): JsonResponse
    {
        app(Plugins::class)->ensure('episode_talk');
        abort_unless($movie->is_published, 404);
        $data = $request->validate(['body' => ['required', 'string', 'min:2', 'max:1000']]);
        DB::table('episode_comments')->insert([
            'movie_id' => $movie->id, 'season' => $season, 'episode' => $episode, 'user_id' => $request->user()->id,
            'body' => app(ContentFilter::class)->clean(trim($data['body'])), 'created_at' => now(), 'updated_at' => now(),
        ]);

        return response()->json($this->state($movie, $request->user(), $season, $episode, true));
    }

    public function destroy(Request $request, Movie $movie, int $season, int $episode, int $comment): JsonResponse
    {
        app(Plugins::class)->ensure('episode_talk');
        $row = DB::table('episode_comments')->where('id', $comment)->where('movie_id', $movie->id)->first();
        abort_if($row === null, 404);
        $user = $request->user();
        abort_unless((int) $row->user_id === $user->id || $user->isStaff(), 403);
        DB::table('episode_comments')->where('id', $comment)->delete();
        if ((int) $row->user_id !== $user->id) {
            Log::info('cinema: episode comment removed by staff', ['comment' => $comment, 'by' => $user->id]);
        }

        return response()->json($this->state($movie, $user, $season, $episode, true));
    }

    /**
     * @return array<string, mixed>
     */
    private function state(Movie $movie, User $viewer, int $season, int $episode, bool $reveal): array
    {
        $ratings = DB::table('episode_ratings')->where('movie_id', $movie->id)->where('season', $season)->where('episode', $episode);
        $seen = DB::table('movie_episode_marks')->where('user_id', $viewer->id)->where('movie_id', $movie->id)
            ->where('season', $season)->where('episode', $episode)->exists();
        $count = DB::table('episode_comments')->where('movie_id', $movie->id)->where('season', $season)->where('episode', $episode)->count();
        $open = $seen || $reveal;
        $comments = [];
        if ($open) {
            $rows = DB::table('episode_comments')->where('movie_id', $movie->id)->where('season', $season)->where('episode', $episode)
                ->orderByDesc('id')->limit(50)->get();
            $users = User::query()->whereIn('id', $rows->pluck('user_id')->all())->get()->keyBy('id');
            foreach ($rows as $row) {
                $author = $users->get($row->user_id);
                if ($author !== null) {
                    $comments[] = [
                        'id' => (int) $row->id,
                        'body' => (string) $row->body,
                        'user' => $author->toCard(),
                        'created_at' => (string) $row->created_at,
                        'mine' => $author->id === $viewer->id || $viewer->isStaff(),
                    ];
                }
            }
        }

        return [
            'season' => $season,
            'episode' => $episode,
            'avg' => ($avg = (clone $ratings)->avg('score')) !== null ? round((float) $avg, 1) : null,
            'votes' => (clone $ratings)->count(),
            'mine' => ($mine = (clone $ratings)->where('user_id', $viewer->id)->value('score')) !== null ? (int) $mine : null,
            'seen' => $seen,
            'count' => $count,
            // null — приховано від спойлерів (людина ще не бачила серію).
            'comments' => $open ? $comments : null,
        ];
    }
}
