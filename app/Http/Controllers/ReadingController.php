<?php

namespace App\Http\Controllers;

use App\Models\Community;
use App\Models\CommunityMember;
use App\Models\Post;
use App\Services\Feed\KeywordAlerts;
use App\Services\FriendshipService;
use App\Services\PostPresenter;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/** «Прочитати пізніше», сповіщення за ключовими словами, привітання новачка в спільноті. */
class ReadingController extends Controller
{
    public const LATER_MAX = 200;

    public function __construct(private readonly PostPresenter $presenter, private readonly FriendshipService $friendships) {}

    public function later(Request $request): Response|JsonResponse
    {
        app(Plugins::class)->ensure('read_later');
        $user = $request->user();
        $ids = DB::table('read_later')->where('user_id', $user->id)->latest('id')->limit(self::LATER_MAX)->pluck('post_id');
        $order = $ids->flip();
        $ordered = Post::query()->whereIn('id', $ids)->visibleTo($user, $this->friendships->friendIds($user))->get()
            ->sortBy(fn (Post $post) => $order[$post->id] ?? 0)->values();
        $data = ['posts' => $this->presenter->many($ordered, $user)];

        return $request->wantsJson() ? response()->json($data) : Inertia::render('later/index', $data);
    }

    /** Додати або прибрати («Прочитано») запис зі списку. */
    public function toggleLater(Request $request, Post $post): JsonResponse
    {
        app(Plugins::class)->ensure('read_later');
        $user = $request->user();
        abort_unless(Post::query()->whereKey($post->id)->visibleTo($user, $this->friendships->friendIds($user))->exists(), 404);
        $key = ['user_id' => $user->id, 'post_id' => $post->id];
        $on = ! DB::table('read_later')->where($key)->exists();
        if ($on) {
            abort_if(DB::table('read_later')->where('user_id', $user->id)->count() >= self::LATER_MAX, 422, 'Список «Прочитати пізніше» заповнений — позначте щось прочитаним.');
            DB::table('read_later')->insert([...$key, 'created_at' => now()]);
        } else {
            DB::table('read_later')->where($key)->delete();
        }

        return response()->json(['later' => $on, 'count' => DB::table('read_later')->where('user_id', $user->id)->count()]);
    }

    public function alerts(Request $request, KeywordAlerts $alerts): Response|JsonResponse
    {
        app(Plugins::class)->ensure('keyword_alerts');
        $data = ['keywords' => $alerts->for($request->user()), 'max' => KeywordAlerts::MAX];

        return $request->wantsJson() ? response()->json($data) : Inertia::render('settings/keyword-alerts', $data);
    }

    public function addAlert(Request $request, KeywordAlerts $alerts): JsonResponse
    {
        app(Plugins::class)->ensure('keyword_alerts');
        $data = $request->validate(['keyword' => ['required', 'string', 'max:40']]);
        $alerts->add($request->user(), $data['keyword']);

        return response()->json(['keywords' => $alerts->for($request->user())]);
    }

    public function removeAlert(Request $request, KeywordAlerts $alerts): JsonResponse
    {
        $data = $request->validate(['keyword' => ['required', 'string', 'max:40']]);
        $alerts->remove($request->user(), $data['keyword']);

        return response()->json(['keywords' => $alerts->for($request->user())]);
    }

    /** Новачок закрив картку привітання. */
    public function welcomeSeen(Request $request, Community $community): JsonResponse
    {
        CommunityMember::query()->where('community_id', $community->id)->where('user_id', $request->user()->id)->update(['welcome_seen_at' => now()]);

        return response()->json(['ok' => true]);
    }
}
