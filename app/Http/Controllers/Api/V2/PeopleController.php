<?php

namespace App\Http\Controllers\Api\V2;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Social\Presenter;
use App\Social\Social;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Профілі, друзі й заявки в друзі. */
class PeopleController extends Controller
{
    private function findUser(int $id): User
    {
        $user = User::query()->where('is_shadow', false)->find($id);
        if (! $user) {
            Social::fail(404, 'Користувача не знайдено');
        }

        return $user;
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $u = $this->findUser($id);
        $me = $request->user()->id;

        $friendsSample = User::query()
            ->whereIn('id', DB::table('social_friends')->where('user_id', $u->id)->select('friend_id'))
            ->inRandomOrder()->limit(6)->get();
        $mutual = $u->id === $me ? 0 : DB::table('social_friends as a')
            ->join('social_friends as b', 'a.friend_id', '=', 'b.friend_id')
            ->where('a.user_id', $me)->where('b.user_id', $u->id)->count();
        $photos = DB::table('social_photos')->where('user_id', $u->id)->orderByDesc('id')->limit(4)->get();
        $groups = DB::table('social_group_members as m')->join('social_groups as g', 'g.id', '=', 'm.group_id')
            ->where('m.user_id', $u->id)->orderByDesc('m.created_at')->limit(5)->select('g.*')->get()->all();

        return response()->json([
            ...Presenter::userFull($u),
            'friendship' => Social::friendship($me, $u->id),
            'counts' => [
                'friends' => DB::table('social_friends')->where('user_id', $u->id)->count(),
                'followers' => DB::table('social_friend_requests')->where('to_id', $u->id)->count(),
                'photos' => DB::table('social_photos')->where('user_id', $u->id)->count(),
                'groups' => DB::table('social_group_members')->where('user_id', $u->id)->count(),
                'posts' => DB::table('social_posts')->where('owner_type', 'user')->where('owner_id', $u->id)->count(),
                'music' => 0,
                'mutual' => $mutual,
            ],
            'friendsSample' => $friendsSample->map(fn ($f) => Presenter::userShort($f))->values(),
            'photosSample' => $photos->map(fn ($p) => ['id' => $p->id, 'url' => Social::url($p->path)])->values(),
            'groupsSample' => Presenter::groups($groups, $me),
        ]);
    }

    public function friends(Request $request, int $id): JsonResponse
    {
        $friendIds = DB::table('social_friends')->where('user_id', $id)->pluck('friend_id');
        if ($request->query('filter') === 'mutual') {
            $mine = DB::table('social_friends')->where('user_id', $request->user()->id)->pluck('friend_id');
            $friendIds = $friendIds->intersect($mine);
        }

        $items = User::query()->whereIn('id', $friendIds)->orderByDesc('last_seen_at')->get()
            ->map(fn ($u) => Presenter::userShort($u));
        if ($request->query('filter') === 'online') {
            $items = $items->filter(fn ($u) => $u['online']);
        }

        return response()->json($items->values());
    }

    public function groups(Request $request, int $id): JsonResponse
    {
        $rows = DB::table('social_group_members as m')->join('social_groups as g', 'g.id', '=', 'm.group_id')
            ->where('m.user_id', $id)->orderByDesc('m.created_at')->select('g.*')->get()->all();

        return response()->json(Presenter::groups($rows, $request->user()->id));
    }

    public function photos(Request $request, int $id): JsonResponse
    {
        $rows = DB::table('social_photos')->where('user_id', $id)->where('id', '<', Social::before($request))
            ->orderByDesc('id')->limit(Social::PAGE)->get();

        return response()->json(Social::page($rows->map(fn ($p) => Presenter::photo($p))->all()));
    }

    // ───────────── друзі ─────────────

    public function requests(Request $request): JsonResponse
    {
        $me = $request->user()->id;
        $incoming = DB::table('social_friend_requests')->where('to_id', $me)->orderByDesc('created_at')->pluck('from_id');
        $outgoing = DB::table('social_friend_requests')->where('from_id', $me)->orderByDesc('created_at')->pluck('to_id');
        $users = Presenter::users($incoming->merge($outgoing));

        return response()->json([
            'incoming' => $incoming->map(fn ($id) => Presenter::userShort($users[$id] ?? null))->filter()->values(),
            'outgoing' => $outgoing->map(fn ($id) => Presenter::userShort($users[$id] ?? null))->filter()->values(),
        ]);
    }

    public function suggestions(Request $request): JsonResponse
    {
        $me = $request->user()->id;
        // Спершу друзі друзів (за кількістю спільних), потім решта.
        $mutualSub = DB::table('social_friends as a')
            ->join('social_friends as b', 'a.friend_id', '=', 'b.friend_id')
            ->where('a.user_id', $me)->whereColumn('b.user_id', 'users.id')
            ->selectRaw('COUNT(*)');

        $rows = User::query()
            ->select('users.*')->selectSub($mutualSub, 'mutual')
            ->where('users.id', '!=', $me)
            ->where('is_shadow', false)
            ->whereNotIn('users.id', DB::table('social_friends')->where('user_id', $me)->select('friend_id'))
            ->whereNotIn('users.id', DB::table('social_friend_requests')->where('from_id', $me)->select('to_id'))
            ->whereNotIn('users.id', DB::table('social_friend_requests')->where('to_id', $me)->select('from_id'))
            ->orderByDesc('mutual')->orderByDesc('last_seen_at')
            ->limit(20)->get();

        return response()->json($rows->map(fn ($u) => [...Presenter::userShort($u), 'mutual' => (int) $u->mutual])->values());
    }

    public function add(Request $request, int $id): JsonResponse
    {
        $me = $request->user()->id;
        if ($id === $me) {
            Social::fail(404, 'Користувача не знайдено');
        }
        $this->findUser($id);

        $status = Social::friendship($me, $id);
        if ($status === 'incoming') {
            DB::transaction(function () use ($me, $id) {
                DB::table('social_friend_requests')->where('from_id', $id)->where('to_id', $me)->delete();
                DB::table('social_friends')->insertOrIgnore([
                    ['user_id' => $me, 'friend_id' => $id, 'created_at' => now()],
                    ['user_id' => $id, 'friend_id' => $me, 'created_at' => now()],
                ]);
            });
            Social::notify($id, $me, 'friend_accept');
        } elseif ($status === 'none') {
            DB::table('social_friend_requests')->insertOrIgnore(['from_id' => $me, 'to_id' => $id, 'created_at' => now()]);
            Social::notify($id, $me, 'friend_request');
        }

        return response()->json(['friendship' => Social::friendship($me, $id)]);
    }

    public function remove(Request $request, int $id): JsonResponse
    {
        $me = $request->user()->id;
        $status = Social::friendship($me, $id);

        DB::transaction(function () use ($me, $id, $status) {
            if ($status === 'friends') {
                DB::table('social_friends')
                    ->where(fn ($q) => $q->where('user_id', $me)->where('friend_id', $id))
                    ->orWhere(fn ($q) => $q->where('user_id', $id)->where('friend_id', $me))
                    ->delete();
                // Як у ВК: видалений друг лишається підписником (його заявка до вас).
                DB::table('social_friend_requests')->insertOrIgnore(['from_id' => $id, 'to_id' => $me, 'created_at' => now()]);
            } else {
                DB::table('social_friend_requests')
                    ->where(fn ($q) => $q->where('from_id', $me)->where('to_id', $id))
                    ->orWhere(fn ($q) => $q->where('from_id', $id)->where('to_id', $me))
                    ->delete();
            }
        });

        return response()->json(['friendship' => Social::friendship($me, $id)]);
    }
}
