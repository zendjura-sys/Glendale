<?php

namespace App\Http\Controllers\Developer;

use App\Http\Controllers\Controller;
use App\Http\Controllers\PostController;
use App\Models\DeveloperApp;
use App\Models\DeveloperToken;
use App\Models\Post;
use App\Models\User;
use App\Models\UserBlock;
use App\Services\FriendshipService;
use App\Services\Presence\PlayingStatus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Публічний API GameCon для сторонніх застосунків: /api/developer/v1/*.
 * Доступ — лише токеном OAuth з потрібним правом; відповідає тим самим даним, що бачить людина на сайті.
 */
class DeveloperApiController extends Controller
{
    /** Хто дав доступ. Email — лише з правом email. */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        /** @var DeveloperToken $token */
        $token = $request->attributes->get('oauth_token');

        return response()->json(['data' => [
            ...$this->card($user),
            'email' => $token->can('email') ? $user->email : null,
            'email_verified' => $token->can('email') ? $user->email_verified_at !== null : null,
            'scopes' => $token->scopes,
        ]]);
    }

    /**
     * Плаский профіль у стилі OpenID Connect (sub, preferred_username, picture…) — для готових
     * OAuth-модулів форумів і CMS, які не вміють читати вкладене поле «data».
     */
    public function userinfo(Request $request): JsonResponse
    {
        $user = $request->user();
        /** @var DeveloperToken $token */
        $token = $request->attributes->get('oauth_token');
        $email = $token->can('email');

        return response()->json([
            'sub' => (string) $user->id,
            'id' => $user->id,
            'preferred_username' => $user->username,
            'username' => $user->username,
            'name' => $user->name,
            'picture' => $user->avatar_url,
            'avatar_url' => $user->avatar_url,
            'profile' => url('/u/'.$user->username),
            'email' => $email ? $user->email : null,
            'email_verified' => $email ? $user->email_verified_at !== null : null,
            // Токен для дзвіночка на сайті (embed.js data-gamecon-bell): лише з правом notifications.
            'bell_token' => $token->can('notifications') && $token->app !== null ? EmbedKitController::bellToken($user, $token->app) : null,
        ]);
    }

    /** Публічний профіль за ніком (закритий профіль — лише ім’я й аватар). */
    public function user(Request $request, string $username): JsonResponse
    {
        $user = User::query()->where('username', $username)->whereNull('banned_at')->firstOrFail();
        abort_if(UserBlock::either($request->user(), $user), 404);

        return response()->json(['data' => $user->is_private && $user->id !== $request->user()->id
            ? [...array_intersect_key($this->card($user), array_flip(['id', 'username', 'name', 'avatar_url', 'url'])), 'private' => true]
            : $this->card($user)]);
    }

    public function friends(Request $request, FriendshipService $friendships): JsonResponse
    {
        $page = User::query()->whereKey($friendships->friendIds($request->user()))->whereNull('banned_at')
            ->orderBy('id')->cursorPaginate(min(100, max(1, (int) $request->query('per_page', 50))));

        return response()->json([
            'data' => collect($page->items())->map(fn (User $u) => array_intersect_key($this->card($u), array_flip(['id', 'username', 'name', 'avatar_url', 'url', 'playing'])))->values(),
            'next_cursor' => $page->nextCursor()?->encode(),
        ]);
    }

    /** Публікації людини, що дала доступ (нові першими). */
    public function posts(Request $request): JsonResponse
    {
        $page = Post::query()->where('author_id', $request->user()->id)->visibleTo($request->user())
            ->orderByDesc('id')->cursorPaginate(min(50, max(1, (int) $request->query('per_page', 20))));

        return response()->json([
            'data' => collect($page->items())->map(fn (Post $p) => $this->post($p))->values(),
            'next_cursor' => $page->nextCursor()?->encode(),
        ]);
    }

    /** Нова публікація від імені людини: текст і видимість, через ті самі перевірки, що й на сайті. */
    public function createPost(Request $request, PostController $posts): JsonResponse
    {
        $request->validate([
            'body' => ['required', 'string', 'max:5000'],
            'visibility' => ['nullable', Rule::in(Post::VISIBILITIES)],
        ]);
        $request->merge(['visibility' => $request->input('visibility', Post::VISIBILITY_PUBLIC)]);
        $post = $posts->publish($request);

        return response()->json(['data' => $this->post($post)], 201);
    }

    /** «Граю в…» від застосунку (наприклад, лаунчер гри). */
    public function status(Request $request, PlayingStatus $status): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', Rule::in(['server', 'game'])],
            'id' => ['required', 'integer'],
            'note' => ['nullable', 'string', 'max:60'],
            'hours' => ['nullable', 'integer', Rule::in(PlayingStatus::MANUAL_HOURS)],
        ]);
        $status->manual($request->user(), $data['kind'], (int) $data['id'], $data['note'] ?? null, (int) ($data['hours'] ?? 3));

        return response()->json(['data' => ['playing' => $request->user()->fresh()?->playing()]]);
    }

    public function clearStatus(Request $request, PlayingStatus $status): JsonResponse
    {
        $status->clear($request->user());

        return response()->json(['data' => ['playing' => null]]);
    }

    /** Застосунок, від імені якого працює бот чи публічний ключ. */
    public function app(Request $request): JsonResponse
    {
        /** @var DeveloperApp $app */
        $app = $request->attributes->get('developer_app');

        return response()->json(['data' => [
            'id' => $app->id,
            'name' => $app->name,
            'client_id' => $app->client_id,
            'bot' => (bool) $request->attributes->get('developer_bot'),
            'scopes' => $app->scopes,
        ]]);
    }

    /** Публічний профіль за ключем застосунку (без людини): лише те, що бачить гість. */
    public function publicUser(string $username): JsonResponse
    {
        $user = User::query()->where('username', $username)->whereNull('banned_at')->firstOrFail();

        return response()->json(['data' => $user->is_private
            ? [...array_intersect_key($this->card($user), array_flip(['id', 'username', 'name', 'avatar_url', 'url'])), 'private' => true]
            : $this->card($user)]);
    }

    /** Публічні записи людини (видимість «усім»). */
    public function publicPosts(Request $request, string $username): JsonResponse
    {
        $user = User::query()->where('username', $username)->whereNull('banned_at')->where('is_private', false)->firstOrFail();
        $page = Post::query()->where('author_id', $user->id)->visibleTo(null)->orderByDesc('id')
            ->cursorPaginate(min(50, max(1, (int) $request->query('per_page', 20))));

        return response()->json([
            'data' => collect($page->items())->map(fn (Post $p) => $this->post($p))->values(),
            'next_cursor' => $page->nextCursor()?->encode(),
        ]);
    }

    public function notifications(Request $request): JsonResponse
    {
        return response()->json(['data' => ['unread' => $request->user()->unreadNotifications()->count()]]);
    }

    /** @return array<string, mixed> */
    private function card(User $user): array
    {
        return [
            'id' => $user->id,
            'username' => $user->username,
            'name' => $user->name,
            'avatar_url' => $user->avatar_url,
            'url' => url('/u/'.$user->username),
            'about' => $user->about,
            'city' => $user->city,
            'verified' => (bool) ($user->verified_at ?? false),
            'plus' => $user->isPlus(),
            'playing' => $user->playing(),
            'created_at' => $user->created_at?->toIso8601String(),
        ];
    }

    /** @return array<string, mixed> */
    private function post(Post $post): array
    {
        return [
            'id' => $post->id,
            'body' => $post->body,
            'visibility' => $post->visibility,
            'url' => url('/posts/'.$post->id),
            'created_at' => $post->created_at?->toIso8601String(),
            'edited_at' => $post->edited_at?->toIso8601String(),
        ];
    }
}
