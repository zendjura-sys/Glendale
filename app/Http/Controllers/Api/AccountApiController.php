<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApiToken;
use App\Models\Appeal;
use App\Models\Feedback;
use App\Models\LoginEvent;
use App\Models\User;
use App\Models\UserReport;
use App\Models\UserSession;
use App\Services\Auth\AccountSecurity;
use App\Services\Moderation\PeopleModeration;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** Застосунок: пристрої й сесії, журнал входів, заморожування, оскарження, скарги й відгуки. */
class AccountApiController extends Controller
{
    public function __construct(private readonly AccountSecurity $security) {}

    public function show(Request $request): JsonResponse
    {
        $user = $this->user($request);
        $current = $request->attributes->get('api_token_id');

        return response()->json([
            'sessions' => array_values(UserSession::query()->where('user_id', $user->id)->latest('last_active_at')->limit(30)->get()
                ->map(fn (UserSession $s) => [
                    'id' => $s->id,
                    'device' => AccountSecurity::device($s->user_agent),
                    'ip' => $s->ip,
                    'last_active_at' => $s->last_active_at->toIso8601String(),
                ])->all()),
            'tokens' => array_values(ApiToken::query()->where('user_id', $user->id)->latest('last_used_at')->limit(30)->get()
                ->map(fn (ApiToken $t) => [
                    'id' => $t->id,
                    'name' => $t->name,
                    'last_used_at' => ($t->last_used_at ?? $t->created_at)?->toIso8601String(),
                    'current' => $t->id === $current,
                ])->all()),
            'logins' => array_values(LoginEvent::query()->where('user_id', $user->id)->latest('id')->limit(AccountSecurity::HISTORY)->get()
                ->map(fn (LoginEvent $e) => [
                    'id' => $e->id,
                    'method' => $e->method,
                    'success' => $e->success,
                    'device' => AccountSecurity::device($e->user_agent),
                    'ip' => $e->ip,
                    'at' => $e->created_at->toIso8601String(),
                ])->all()),
            'appeals' => array_values(Appeal::query()->where('user_id', $user->id)->latest('id')->limit(10)->get()
                ->map(fn (Appeal $a) => [
                    'id' => $a->id,
                    'kind' => $a->kind,
                    'body' => $a->body,
                    'status' => $a->status,
                    'reply' => $a->reply,
                    'created_at' => $a->created_at->toIso8601String(),
                ])->all()),
            'appeal_kinds' => array_diff_key(Appeal::KINDS, ['ban' => true]),
            'mute' => $user->isMuted() ? ['until' => $user->muted_until?->toIso8601String(), 'reason' => $user->mute_reason] : null,
            'hide_profanity' => (bool) $user->pref('hide_profanity', false),
            'report_reasons' => UserReport::REASONS,
            'feedback_kinds' => Feedback::KINDS,
        ]);
    }

    public function revokeSession(Request $request, UserSession $session): JsonResponse
    {
        $user = $this->user($request);
        abort_unless($session->user_id === $user->id, 404);
        $this->security->revoke($user, null, [$session->id], []);

        return response()->json(['ok' => true]);
    }

    public function revokeToken(Request $request, ApiToken $token): JsonResponse
    {
        $user = $this->user($request);
        abort_unless($token->user_id === $user->id, 404);
        abort_if($token->id === $request->attributes->get('api_token_id'), 422, 'Це поточний пристрій — просто вийдіть з акаунта.');
        $token->delete();

        return response()->json(['ok' => true]);
    }

    /** Завершити всі сесії сайту й входи в застосунок, крім цього пристрою. */
    public function revokeOthers(Request $request): JsonResponse
    {
        $user = $this->user($request);
        $current = $request->attributes->get('api_token_id');
        $count = $this->security->revoke($user, null, null, []);
        $count += ApiToken::query()->where('user_id', $user->id)->whereKeyNot($current)->delete();

        return response()->json(['ok' => true, 'count' => $count]);
    }

    public function profanity(Request $request): JsonResponse
    {
        $data = $request->validate(['hide' => ['required', 'boolean']]);
        $this->user($request)->mergePref(['hide_profanity' => (bool) $data['hide']]);

        return response()->json(['ok' => true]);
    }

    public function freeze(Request $request): JsonResponse
    {
        $user = $this->user($request);
        $data = $request->validate(['password' => ['required', 'string']]);
        if (! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['password' => 'Невірний пароль.']);
        }
        $this->security->freeze($user, null);

        return response()->json(['ok' => true]);
    }

    public function appeal(Request $request): JsonResponse
    {
        $user = $this->user($request);
        $data = $request->validate([
            'kind' => ['required', Rule::in(['mute', 'content', 'other'])],
            'body' => ['required', 'string', 'min:10', 'max:2000'],
        ]);
        if (Appeal::query()->where('user_id', $user->id)->where('status', Appeal::PENDING)->count() >= 3) {
            throw ValidationException::withMessages(['body' => 'Дочекайтеся відповіді на попередні оскарження.']);
        }
        Appeal::query()->create(['user_id' => $user->id, 'kind' => $data['kind'], 'body' => trim($data['body'])]);

        return response()->json(['ok' => true], 201);
    }

    public function report(Request $request, User $target, PeopleModeration $moderation): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['required', Rule::in(array_keys(UserReport::REASONS))],
            'comment' => ['nullable', 'string', 'max:1000'],
        ]);
        $moderation->report($this->user($request), $target, $data['reason'], $data['comment'] ?? null);

        return response()->json(['ok' => true], 201);
    }

    public function feedback(Request $request): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', Rule::in(array_keys(Feedback::KINDS))],
            'body' => ['required', 'string', 'min:5', 'max:3000'],
            'screen' => ['nullable', 'string', 'max:120'],
        ]);
        Feedback::query()->create([
            'user_id' => $this->user($request)->id,
            'kind' => $data['kind'],
            'body' => trim($data['body']),
            'url' => isset($data['screen']) ? 'app:'.$data['screen'] : 'app',
        ]);

        return response()->json(['ok' => true], 201);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return $user;
    }
}
