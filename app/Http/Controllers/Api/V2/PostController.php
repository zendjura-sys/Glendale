<?php

namespace App\Http\Controllers\Api\V2;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Social\Presenter;
use App\Social\Social;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Стіни, стрічка, записи, лайки, репости, коментарі. */
class PostController extends Controller
{
    private function postOr404(int $id): object
    {
        $post = DB::table('social_posts')->find($id);
        if (! $post) {
            Social::fail(404, 'Запис не знайдено');
        }

        return $post;
    }

    private function assertVisible(object $post, User $user): void
    {
        if ($post->owner_type === 'group' && ! Social::canSeeGroup($post->owner_id, $user)) {
            Social::fail(403, 'Це закрита спільнота', 'closed_group');
        }
    }

    public function wall(Request $request, string $type, int $id): JsonResponse
    {
        $type = $type === 'group' ? 'group' : 'user';
        if ($type === 'group' && ! Social::canSeeGroup($id, $request->user())) {
            Social::fail(403, 'Це закрита спільнота', 'closed_group');
        }

        $rows = DB::table('social_posts')->where('owner_type', $type)->where('owner_id', $id)
            ->where('id', '<', Social::before($request))->orderByDesc('id')->limit(Social::PAGE)->get()->all();

        return response()->json(Social::page(Presenter::posts($rows, $request->user())));
    }

    public function feed(Request $request): JsonResponse
    {
        $me = $request->user()->id;
        $query = DB::table('social_posts')->where('id', '<', Social::before($request));

        if ($request->query('tab') === 'popular') {
            // «Рекомендації»: усі відкриті записи, не лише друзів і спільнот.
            Social::visiblePosts($query, $me);
        } else {
            $query->where(function (Builder $q) use ($me) {
                $q->where(function (Builder $w) use ($me) {
                    $w->where('owner_type', 'user')->where(function (Builder $o) use ($me) {
                        $o->where('owner_id', $me)
                            ->orWhereIn('owner_id', fn ($s) => $s->select('friend_id')->from('social_friends')->where('user_id', $me))
                            ->orWhereIn('owner_id', fn ($s) => $s->select('to_id')->from('social_friend_requests')->where('from_id', $me));
                    });
                })->orWhere(function (Builder $w) use ($me) {
                    $w->where('owner_type', 'group')
                        ->whereIn('owner_id', fn ($s) => $s->select('group_id')->from('social_group_members')->where('user_id', $me));
                });
            });
        }

        $rows = $query->orderByDesc('id')->limit(Social::PAGE)->get()->all();

        return response()->json(Social::page(Presenter::posts($rows, $request->user())));
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $post = $this->postOr404($id);
        $this->assertVisible($post, $request->user());

        return response()->json(Presenter::post($post, $request->user()));
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'text' => ['nullable', 'string', 'max:10000'],
            'image' => ['nullable', ...Social::IMAGE_RULES],
            'spotify' => ['nullable', 'string', 'max:300'],
            'ownerType' => ['nullable', 'in:user,group'],
            'ownerId' => ['nullable', 'integer'],
        ]);
        $me = $request->user();

        $text = Social::str($request->input('text'), 10000);
        $spotify = Social::str($request->input('spotify'), 300);
        $spotify = Presenter::spotifyRef($spotify) ? $spotify : '';
        if ($text === '' && ! $request->hasFile('image') && $spotify === '') {
            Social::fail(400, 'Запис не може бути порожнім');
        }

        $ownerType = $request->input('ownerType') === 'group' ? 'group' : 'user';
        $ownerId = (int) ($request->input('ownerId') ?: $me->id);
        $fromGroup = false;

        if ($ownerType === 'user') {
            if (! User::query()->whereKey($ownerId)->exists()) {
                Social::fail(404, 'Користувача не знайдено');
            }
        } else {
            if (! Social::group($ownerId)) {
                Social::fail(404, 'Спільноту не знайдено');
            }
            if (! Social::isGroupAdmin($ownerId, $me->id)) {
                Social::fail(403, 'Публікувати записи можуть лише адміністратори спільноти');
            }
            $fromGroup = true;
        }

        $image = $request->hasFile('image') ? Social::storeImage($request->file('image')) : null;
        $id = DB::table('social_posts')->insertGetId([
            'author_id' => $me->id,
            'owner_type' => $ownerType,
            'owner_id' => $ownerId,
            'from_group' => $fromGroup,
            'text' => $text,
            'image_path' => $image,
            'spotify' => $spotify,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        if ($image) {
            DB::table('social_photos')->insert(['user_id' => $me->id, 'path' => $image, 'album' => 'wall', 'created_at' => now(), 'updated_at' => now()]);
        }
        if ($ownerType === 'user' && $ownerId !== $me->id) {
            Social::notify($ownerId, $me->id, 'wall_post', postId: $id, text: $text);
        }

        return response()->json(Presenter::post(DB::table('social_posts')->find($id), $me), 201);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $post = $this->postOr404($id);
        if (! Presenter::post($post, $request->user())['canDelete']) {
            Social::fail(403, 'Немає прав на видалення');
        }
        DB::table('social_posts')->where('id', $post->id)->delete();

        return response()->json(['ok' => true]);
    }

    public function like(Request $request, int $id): JsonResponse
    {
        $post = $this->postOr404($id);
        $this->assertVisible($post, $request->user());
        $inserted = DB::table('social_likes')->insertOrIgnore(['post_id' => $post->id, 'user_id' => $request->user()->id, 'created_at' => now()]);
        if ($inserted) {
            Social::notify($post->author_id, $request->user()->id, 'like', postId: $post->id);
        }

        return response()->json(Presenter::post($post, $request->user()));
    }

    public function unlike(Request $request, int $id): JsonResponse
    {
        $post = $this->postOr404($id);
        DB::table('social_likes')->where('post_id', $post->id)->where('user_id', $request->user()->id)->delete();

        return response()->json(Presenter::post($post, $request->user()));
    }

    public function likes(Request $request, int $id): JsonResponse
    {
        $post = $this->postOr404($id);
        $userIds = DB::table('social_likes')->where('post_id', $post->id)->orderByDesc('created_at')->limit(100)->pluck('user_id');
        $users = Presenter::users($userIds);

        return response()->json($userIds->map(fn ($uid) => Presenter::userShort($users[$uid] ?? null))->filter()->values());
    }

    public function repost(Request $request, int $id): JsonResponse
    {
        $me = $request->user();
        $post = $this->postOr404($id);
        $this->assertVisible($post, $me);
        // Репост репосту ділиться оригіналом, як у ВК.
        if ($post->repost_of) {
            $post = DB::table('social_posts')->find($post->repost_of) ?? $post;
        }
        if (DB::table('social_posts')->where('repost_of', $post->id)->where('author_id', $me->id)->exists()) {
            Social::fail(409, 'Ви вже поділилися цим записом');
        }

        $newId = DB::table('social_posts')->insertGetId([
            'author_id' => $me->id,
            'owner_type' => 'user',
            'owner_id' => $me->id,
            'text' => Social::str($request->input('text'), 2000),
            'repost_of' => $post->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        Social::notify($post->author_id, $me->id, 'repost', postId: $post->id);

        return response()->json(Presenter::post(DB::table('social_posts')->find($newId), $me), 201);
    }

    public function comments(Request $request, int $id): JsonResponse
    {
        $post = $this->postOr404($id);
        $this->assertVisible($post, $request->user());
        $rows = DB::table('social_comments')->where('post_id', $post->id)->orderBy('id')->limit(500)->get()->all();

        return response()->json(Presenter::comments($rows));
    }

    public function comment(Request $request, int $id): JsonResponse
    {
        $post = $this->postOr404($id);
        $this->assertVisible($post, $request->user());
        $text = Social::str($request->input('text'), 4000);
        if ($text === '') {
            Social::fail(400, 'Коментар не може бути порожнім');
        }

        $commentId = DB::table('social_comments')->insertGetId([
            'post_id' => $post->id,
            'author_id' => $request->user()->id,
            'text' => $text,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        Social::notify($post->author_id, $request->user()->id, 'comment', postId: $post->id, text: $text);

        return response()->json(Presenter::comments([DB::table('social_comments')->find($commentId)])[0], 201);
    }

    public function destroyComment(Request $request, int $id): JsonResponse
    {
        $comment = DB::table('social_comments')->find($id);
        if (! $comment) {
            Social::fail(404, 'Коментар не знайдено');
        }
        $post = DB::table('social_posts')->find($comment->post_id);
        $allowed = $comment->author_id === $request->user()->id
            || ($post && Presenter::post($post, $request->user())['canDelete']);
        if (! $allowed) {
            Social::fail(403, 'Немає прав на видалення');
        }
        DB::table('social_comments')->where('id', $comment->id)->delete();

        return response()->json(['ok' => true]);
    }
}
