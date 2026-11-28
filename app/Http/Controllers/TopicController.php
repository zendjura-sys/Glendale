<?php

namespace App\Http\Controllers;

use App\Models\Post;
use App\Services\Feed\Topics;
use App\Services\FriendshipService;
use App\Services\PostPresenter;
use App\Support\Plugins\Plugins;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Сторінка теми (#хештег) і підписка на неї. */
class TopicController extends Controller
{
    public function show(Request $request, string $tag, Topics $topics, PostPresenter $presenter): Response
    {
        app(Plugins::class)->ensure('topic_follows');
        $tag = Topics::normalize($tag);
        abort_unless(Topics::valid($tag), 404);
        $user = $request->user();

        $query = Post::query()->visibleTo($user, app(FriendshipService::class)->friendIds($user))
            ->where('visibility', Post::VISIBILITY_PUBLIC)
            ->whereHas('author', fn (Builder $q) => $q->whereNull('banned_at')->whereNull('frozen_at'));
        $topics->apply($query, [$tag]);
        $posts = $query->orderByDesc('id')->cursorPaginate(15)->withQueryString();

        return Inertia::render('topics/show', [
            'tag' => $tag,
            'following' => in_array($tag, $topics->of($user), true),
            'posts' => Inertia::scroll(fn () => $posts->setCollection(collect($presenter->many(new Collection($posts->items()), $user)))),
        ]);
    }

    public function toggle(Request $request, string $tag, Topics $topics): JsonResponse
    {
        app(Plugins::class)->ensure('topic_follows');

        return response()->json(['following' => $topics->toggle($request->user(), $tag), 'topics' => $topics->of($request->user())]);
    }
}
