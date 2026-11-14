<?php

namespace App\Http\Controllers\Developer;

use App\Http\Controllers\Controller;
use App\Models\DeveloperApp;
use App\Models\DeveloperToken;
use App\Models\User;
use App\Notifications\AppNotice;
use App\Services\Developer\OAuthServer;
use App\Services\Developer\OverlayPrefs;
use App\Services\FriendshipService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * GameCon SDK, ігрова частина:
 *  friends/presence — друзі з онлайном і статусом у грі;
 *  invites          — запросити друга в лобі (сповіщення + push з посиланням);
 *  achievements     — досягнення й таблиці лідерів (з сервера гри — «перевірені»);
 *  notify           — сервер гри надсилає гравцеві сповіщення (з лімітом).
 * Серверні виклики (/server/*) — за client_id і client_secret конфіденційного застосунку.
 */
class SdkGameController extends Controller
{
    private const PRESENCE_TTL = 600;

    private const NOTIFY_PER_DAY = 20;

    private function app(Request $request): DeveloperApp
    {
        /** @var DeveloperToken $token */
        $token = $request->attributes->get('oauth_token');

        return $token->app;
    }

    /** Публічний конфіг для SDK при старті гри: назва, вигляд оверлею, адреси входу. Без токена. */
    public function config(string $clientId): JsonResponse
    {
        $data = Cache::remember('sdk_config:'.$clientId, 300, function () use ($clientId) {
            $app = DeveloperApp::query()->where('client_id', $clientId)->first();
            if ($app === null || $app->blocked()) {
                return null;
            }

            return [
                'name' => $app->name, 'website' => $app->website, 'overlay' => $app->overlayConfig(),
                // Готовий скрипт мовою гри: /sdk/v1/gamecon-sdk.js?lang=…
                'script' => url('/sdk/v1/gamecon-sdk.js').($app->overlayConfig()['locale'] !== 'auto' ? '?lang='.$app->overlayConfig()['locale'] : ''),
                'scopes' => $app->scopes, 'confidential' => $app->confidential,
                'endpoints' => ['authorize' => url('/oauth/authorize'), 'token' => url('/oauth/token'), 'device' => url('/oauth/device'), 'link' => url('/link'), 'api' => url('/api/developer/v1')],
            ];
        });
        abort_if($data === null, 404, 'Застосунок не знайдено.');

        return response()->json(['data' => $data])->header('Cache-Control', 'public, max-age=300');
    }

    // ───────────── Налаштування оверлею гравця (синхронізація між пристроями) ─────────────

    public function overlayPrefs(Request $request, OverlayPrefs $prefs): JsonResponse
    {
        return response()->json(['data' => $prefs->get($this->app($request), $request->user())]);
    }

    public function saveOverlayPrefs(Request $request, OverlayPrefs $prefs): JsonResponse
    {
        $data = $request->validate(['enabled' => ['sometimes', 'boolean'], 'prefs' => ['sometimes', 'array']]);

        return response()->json(['data' => $prefs->save($this->app($request), $request->user(), $data)]);
    }

    /** «Скинути до варіанта гри». */
    public function resetOverlayPrefs(Request $request, OverlayPrefs $prefs): JsonResponse
    {
        $prefs->reset($this->app($request), $request->user());

        return response()->json(['data' => $prefs->get($this->app($request), $request->user())]);
    }

    // ───────────── Друзі й присутність ─────────────

    public function friends(Request $request, FriendshipService $friendships): JsonResponse
    {
        $app = $this->app($request);
        $friends = User::query()->whereKey($friendships->friendIds($request->user()))->whereNull('banned_at')->limit(500)->get()
            ->map(fn (User $u) => [
                'id' => $u->id, 'username' => $u->username, 'name' => $u->name, 'avatar_url' => $u->avatar_url,
                'online' => $u->is_online, 'playing' => $u->playing(),
                // Статус у вашій грі (якщо друг зараз у ній).
                'presence' => Cache::get("sdk_presence:{$app->id}:{$u->id}"),
            ])
            ->sortByDesc(fn ($f) => [$f['presence'] !== null, $f['online']])->values();

        return response()->json(['data' => $friends]);
    }

    /** Статус гравця у вашій грі («В матчі · Dust2»); живе 10 хв — оновлюйте поки гравець у грі. */
    public function presence(Request $request): JsonResponse
    {
        $data = $request->validate(['status' => ['nullable', 'string', 'max:80'], 'lobby' => ['nullable', 'string', 'max:64']]);
        $key = 'sdk_presence:'.$this->app($request)->id.':'.$request->user()->id;
        if (($data['status'] ?? null) === null) {
            Cache::forget($key);
        } else {
            Cache::put($key, ['app' => $this->app($request)->name, 'status' => $data['status'], 'lobby' => $data['lobby'] ?? null, 'at' => now()->toIso8601String()], self::PRESENCE_TTL);
        }

        return response()->json(['ok' => true]);
    }

    // ───────────── Запрошення в лобі ─────────────

    public function invite(Request $request, FriendshipService $friendships): JsonResponse
    {
        $data = $request->validate([
            'username' => ['required', 'string', 'max:64'],
            'lobby' => ['required', 'string', 'max:64'],
            'url' => ['nullable', 'string', 'max:500'],
            'message' => ['nullable', 'string', 'max:120'],
        ]);
        $app = $this->app($request);
        $user = $request->user();
        $friend = User::query()->where('username', $data['username'])->whereNull('banned_at')->firstOrFail();
        abort_unless(in_array($friend->id, $friendships->friendIds($user), true), 403, 'Запрошувати можна лише друзів.');
        abort_unless(RateLimiter::attempt("sdk_invite:{$app->id}:{$user->id}:{$friend->id}", 3, fn () => true, 600), 429, 'Забагато запрошень цьому гравцю — спробуйте пізніше.');
        $url = $this->allowedUrl($app, $data['url'] ?? null) ?? ($app->website ?: url('/'));

        $friend->notify(new AppNotice(
            $app->name,
            ($user->name ?: $user->username).' кличе тебе в «'.$app->name.'»',
            $data['message'] ?? 'Лобі '.$data['lobby'],
            $url,
            'app_invite',
        ));
        Log::info('developers.sdk.invite', ['app' => $app->id, 'from' => $user->id, 'to' => $friend->id]);

        return response()->json(['ok' => true]);
    }

    /** Посилання лише на сайт застосунку чи його схему (з адрес повернення) — щоб не розсилати чужі. */
    private function allowedUrl(DeveloperApp $app, ?string $url): ?string
    {
        if ($url === null || $url === '') {
            return null;
        }
        $host = parse_url($url, PHP_URL_HOST);
        $scheme = parse_url($url, PHP_URL_SCHEME);
        $hosts = array_filter([parse_url((string) $app->website, PHP_URL_HOST), ...array_map(fn ($u) => parse_url($u, PHP_URL_HOST), $app->redirect_uris)]);
        $schemes = array_filter(array_map(fn ($u) => parse_url($u, PHP_URL_SCHEME), $app->redirect_uris), fn ($s) => ! in_array($s, ['http', 'https'], true));
        if (in_array($scheme, ['http', 'https'], true) && is_string($host) && in_array($host, $hosts, true)) {
            return $url;
        }

        return is_string($scheme) && in_array($scheme, $schemes, true) ? $url : null;
    }

    // ───────────── Досягнення й лідери ─────────────

    public function achievements(Request $request): JsonResponse
    {
        $app = $this->app($request);
        $mine = DB::table('developer_user_achievements')->where('user_id', $request->user()->id)->pluck('unlocked_at', 'developer_achievement_id');
        $list = DB::table('developer_achievements')->where('developer_app_id', $app->id)->orderBy('id')->get()
            ->map(fn ($a) => [
                'key' => $a->key, 'points' => $a->points, 'unlocked_at' => $mine[$a->id] ?? null,
                // Приховані — без назви, доки не відкриті.
                'title' => $a->hidden && ! isset($mine[$a->id]) ? null : $a->title,
                'description' => $a->hidden && ! isset($mine[$a->id]) ? null : $a->description,
                'icon_url' => $a->icon_url, 'hidden' => (bool) $a->hidden,
            ]);

        return response()->json(['data' => $list->values()]);
    }

    public function unlock(Request $request, string $key): JsonResponse
    {
        $achievement = DB::table('developer_achievements')->where('developer_app_id', $this->app($request)->id)->where('key', $key)->first();
        abort_if($achievement === null, 404, 'Досягнення не знайдено.');
        abort_if((bool) $achievement->server_only, 403, 'Це досягнення відкриває лише сервер гри.');

        return response()->json(['data' => $this->grant($achievement, $request->user()->id, false)]);
    }

    public function leaderboard(Request $request, string $board): JsonResponse
    {
        $data = $request->validate(['order' => ['nullable', Rule::in(['desc', 'asc'])], 'limit' => ['nullable', 'integer', 'min:1', 'max:100'], 'friends' => ['nullable', 'boolean']]);
        $app = $this->app($request);
        $order = $data['order'] ?? 'desc';
        $query = DB::table('developer_scores')->join('users', 'users.id', '=', 'developer_scores.user_id')
            ->where('developer_app_id', $app->id)->where('board', $board)->whereNull('users.banned_at');
        if ($request->boolean('friends')) {
            $query->whereIn('user_id', [...app(FriendshipService::class)->friendIds($request->user()), $request->user()->id]);
        }
        $rows = (clone $query)->orderBy('score', $order)->orderBy('developer_scores.updated_at')->limit((int) ($data['limit'] ?? 50))
            ->get(['users.id', 'users.username', 'users.first_name', 'users.last_name', 'developer_scores.score', 'developer_scores.verified']);
        $me = DB::table('developer_scores')->where('developer_app_id', $app->id)->where('board', $board)->where('user_id', $request->user()->id)->first();
        $myRank = $me ? (clone $query)->where('score', $order === 'desc' ? '>' : '<', $me->score)->count() + 1 : null;

        return response()->json(['data' => $rows->values()->map(fn ($r, $i) => [
            'rank' => $i + 1, 'user' => ['id' => $r->id, 'username' => $r->username, 'name' => trim($r->first_name.' '.$r->last_name) ?: $r->username],
            'score' => (int) $r->score, 'verified' => (bool) $r->verified,
        ]), 'me' => $me ? ['rank' => $myRank, 'score' => (int) $me->score] : null]);
    }

    public function submitScore(Request $request, string $board): JsonResponse
    {
        $data = $request->validate(['score' => ['required', 'integer'], 'order' => ['nullable', Rule::in(['desc', 'asc'])]]);

        return response()->json(['data' => $this->score($this->app($request), $board, $request->user()->id, (int) $data['score'], $data['order'] ?? 'desc', false)]);
    }

    // ───────────── Серверні виклики (client_id + client_secret) ─────────────

    private function server(Request $request): DeveloperApp
    {
        $header = (string) $request->header('Authorization', '');
        [$id, $secret] = str_starts_with($header, 'Basic ')
            ? array_pad(explode(':', (string) base64_decode(substr($header, 6), true), 2), 2, null)
            : [$request->input('client_id'), $request->input('client_secret')];
        $app = app(OAuthServer::class)->client(is_string($id) ? $id : null, is_string($secret) ? $secret : null);
        abort_if($app === null || ! $app->confidential, 401, 'Потрібні client_id і client_secret конфіденційного застосунку.');

        return $app;
    }

    /** Гравець, що підключив саме цей застосунок (і, за потреби, дав право $scope). */
    private function player(DeveloperApp $app, int $userId, ?string $scope = null): User
    {
        $tokens = DeveloperToken::query()->where('developer_app_id', $app->id)->where('user_id', $userId)->whereNull('revoked_at')->get();
        abort_if($tokens->isEmpty() || ($scope !== null && ! $tokens->contains(fn (DeveloperToken $t) => $t->can($scope))), 403, 'Гравець не підключив застосунок або не дав потрібного права.');

        return User::query()->whereKey($userId)->whereNull('banned_at')->firstOrFail();
    }

    public function defineAchievement(Request $request, string $key): JsonResponse
    {
        $app = $this->server($request);
        abort_unless(preg_match('/^[a-z0-9_\-.]{1,64}$/i', $key) === 1, 422, 'Ключ: до 64 символів a-z, 0-9, _-.');
        $data = $request->validate([
            'title' => ['required', 'string', 'max:120'], 'description' => ['nullable', 'string', 'max:300'],
            'icon_url' => ['nullable', 'url:https', 'max:500'], 'points' => ['nullable', 'integer', 'min:0', 'max:1000'],
            'hidden' => ['nullable', 'boolean'], 'server_only' => ['nullable', 'boolean'],
        ]);
        abort_if(DB::table('developer_achievements')->where('developer_app_id', $app->id)->count() >= 500 && ! DB::table('developer_achievements')->where('developer_app_id', $app->id)->where('key', $key)->exists(), 422, 'До 500 досягнень на застосунок.');
        DB::table('developer_achievements')->updateOrInsert(['developer_app_id' => $app->id, 'key' => $key], [
            'title' => $data['title'], 'description' => $data['description'] ?? null, 'icon_url' => $data['icon_url'] ?? null,
            'points' => (int) ($data['points'] ?? 10), 'hidden' => (bool) ($data['hidden'] ?? false), 'server_only' => (bool) ($data['server_only'] ?? false),
            'updated_at' => now(), 'created_at' => now(),
        ]);

        return response()->json(['ok' => true]);
    }

    public function serverUnlock(Request $request, string $key): JsonResponse
    {
        $app = $this->server($request);
        $data = $request->validate(['user_id' => ['required', 'integer']]);
        $achievement = DB::table('developer_achievements')->where('developer_app_id', $app->id)->where('key', $key)->first();
        abort_if($achievement === null, 404, 'Досягнення не знайдено — спершу опишіть його (PUT).');

        return response()->json(['data' => $this->grant($achievement, $this->player($app, (int) $data['user_id'])->id, true)]);
    }

    public function serverScore(Request $request, string $board): JsonResponse
    {
        $app = $this->server($request);
        $data = $request->validate(['user_id' => ['required', 'integer'], 'score' => ['required', 'integer'], 'order' => ['nullable', Rule::in(['desc', 'asc'])]]);

        return response()->json(['data' => $this->score($app, $board, $this->player($app, (int) $data['user_id'])->id, (int) $data['score'], $data['order'] ?? 'desc', true)]);
    }

    /** Сповіщення гравцеві від сервера гри: потрібне право notify, до 20 на добу на гравця. */
    public function notify(Request $request): JsonResponse
    {
        $app = $this->server($request);
        $data = $request->validate([
            'user_id' => ['required', 'integer'], 'title' => ['required', 'string', 'max:120'],
            'body' => ['nullable', 'string', 'max:300'], 'url' => ['nullable', 'string', 'max:500'],
        ]);
        $user = $this->player($app, (int) $data['user_id'], 'notify');
        abort_unless(RateLimiter::attempt("sdk_notify:{$app->id}:{$user->id}", self::NOTIFY_PER_DAY, fn () => true, 86400), 429, 'Ліміт сповіщень цьому гравцю на сьогодні вичерпано.');
        $user->notify(new AppNotice($app->name, Str::limit($data['title'], 120), $data['body'] ?? null, $this->allowedUrl($app, $data['url'] ?? null) ?? ($app->website ?: url('/notifications'))));
        Log::info('developers.sdk.notify', ['app' => $app->id, 'user' => $user->id]);

        return response()->json(['ok' => true]);
    }

    // ───────────── Спільне ─────────────

    /** @return array<string, mixed> */
    private function grant(object $achievement, int $userId, bool $verified): array
    {
        $existing = DB::table('developer_user_achievements')->where('developer_achievement_id', $achievement->id)->where('user_id', $userId)->first();
        if ($existing === null) {
            DB::table('developer_user_achievements')->insertOrIgnore(['developer_achievement_id' => $achievement->id, 'user_id' => $userId, 'verified' => $verified, 'unlocked_at' => now()]);
        } elseif ($verified && ! $existing->verified) {
            DB::table('developer_user_achievements')->where('id', $existing->id)->update(['verified' => true]);
        }

        return ['key' => $achievement->key, 'title' => $achievement->title, 'new' => $existing === null, 'verified' => $verified || (bool) ($existing->verified ?? false)];
    }

    /** Найкращий результат гравця (desc — більше краще, asc — менше, напр. час проходження). @return array<string, mixed> */
    private function score(DeveloperApp $app, string $board, int $userId, int $score, string $order, bool $verified): array
    {
        abort_unless(preg_match('/^[a-z0-9_\-.]{1,64}$/i', $board) === 1, 422, 'Назва таблиці: до 64 символів a-z, 0-9, _-.');
        $row = DB::table('developer_scores')->where('developer_app_id', $app->id)->where('board', $board)->where('user_id', $userId)->first();
        $better = $row === null || ($order === 'desc' ? $score > $row->score : $score < $row->score);
        if ($row === null) {
            DB::table('developer_scores')->insert(['developer_app_id' => $app->id, 'board' => $board, 'user_id' => $userId, 'score' => $score, 'verified' => $verified, 'created_at' => now(), 'updated_at' => now()]);
        } elseif ($better) {
            DB::table('developer_scores')->where('id', $row->id)->update(['score' => $score, 'verified' => $verified, 'updated_at' => now()]);
        }

        return ['best' => $better ? $score : (int) $row->score, 'improved' => $better];
    }
}
