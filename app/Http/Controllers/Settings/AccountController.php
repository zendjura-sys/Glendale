<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\ApiToken;
use App\Models\Appeal;
use App\Models\Comment;
use App\Models\CommunityMember;
use App\Models\LoginEvent;
use App\Models\Message;
use App\Models\Photo;
use App\Models\Post;
use App\Models\User;
use App\Models\UserSession;
use App\Services\Auth\AccountSecurity;
use App\Services\FriendshipService;
use App\Services\Servers\ServerOAuth;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Налаштування → Акаунт: пристрої й сесії, журнал входів, свої дані, заморожування, оскарження.
 */
class AccountController extends Controller
{
    public function __construct(private readonly AccountSecurity $security) {}

    public function edit(Request $request): Response
    {
        $user = $this->user($request);
        $current = AccountSecurity::hash($request->session()->getId());
        $this->security->touch($request, $user);

        return Inertia::render('settings/account', [
            'connections' => app(ServerOAuth::class)->connections($user),
            'sessions' => array_values(UserSession::query()->where('user_id', $user->id)->latest('last_active_at')->limit(30)->get()
                ->map(fn (UserSession $s) => [
                    'id' => $s->id,
                    'device' => AccountSecurity::device($s->user_agent),
                    'ip' => $s->ip,
                    'last_active_at' => $s->last_active_at->toIso8601String(),
                    'current' => $s->session_hash === $current,
                ])->all()),
            'tokens' => array_values(ApiToken::query()->where('user_id', $user->id)->latest('last_used_at')->limit(30)->get()
                ->map(fn (ApiToken $t) => [
                    'id' => $t->id,
                    'name' => $t->name,
                    'last_used_at' => ($t->last_used_at ?? $t->created_at)?->toIso8601String(),
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
            'appealKinds' => Appeal::KINDS,
            'mute' => $user->isMuted() ? ['until' => $user->muted_until?->toIso8601String(), 'reason' => $user->mute_reason] : null,
            'hideProfanity' => (bool) $user->pref('hide_profanity', false),
        ]);
    }

    public function revokeSession(Request $request, UserSession $session): RedirectResponse
    {
        $user = $this->user($request);
        abort_unless($session->user_id === $user->id, 404);
        $this->security->revoke($user, $request->session()->getId(), [$session->id], []);
        $request->session()->regenerate();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Сесію завершено.']);

        return back();
    }

    public function revokeToken(Request $request, ApiToken $token): RedirectResponse
    {
        $user = $this->user($request);
        abort_unless($token->user_id === $user->id, 404);
        $this->security->revoke($user, $request->session()->getId(), [], [$token->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Вихід із застосунку на цьому пристрої виконано.']);

        return back();
    }

    public function disconnect(Request $request, int $client): RedirectResponse
    {
        app(ServerOAuth::class)->disconnect($this->user($request), $client);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Доступ серверу скасовано.']);

        return back();
    }

    public function revokeOthers(Request $request): RedirectResponse
    {
        $user = $this->user($request);
        $count = $this->security->revoke($user, $request->session()->getId(), null, null);
        $request->session()->regenerate();
        Inertia::flash('toast', ['type' => 'success', 'message' => $count > 0 ? 'Усі інші сесії завершено.' : 'Інших сесій немає.']);

        return back();
    }

    public function profanity(Request $request): RedirectResponse
    {
        $data = $request->validate(['hide' => ['required', 'boolean']]);
        $this->user($request)->mergePref(['hide_profanity' => (bool) $data['hide']]);

        return back();
    }

    /**
     * Усе, що людина написала й завантажила, одним JSON-файлом.
     */
    public function export(Request $request, FriendshipService $friendships): StreamedResponse
    {
        $user = $this->user($request);
        $name = 'gamecon-'.$user->username.'-'.now()->format('Y-m-d').'.json';

        return response()->streamDownload(function () use ($user, $friendships) {
            $write = fn (mixed $value) => print json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
            echo "{\n\"exported_at\": ";
            $write(now()->toIso8601String());
            echo ",\n\"profile\": ";
            $write([
                'username' => $user->username,
                'name' => $user->name,
                'email' => $user->email,
                'status' => $user->status,
                'about' => $user->about,
                'city' => $user->city,
                'country' => $user->country,
                'birthday' => $user->birthday?->toDateString(),
                'website' => $user->website,
                'avatar_url' => $user->avatar_url,
                'locale' => $user->locale,
                'created_at' => $user->created_at?->toIso8601String(),
            ]);
            echo ",\n\"friends\": ";
            $write(array_values(User::query()->whereIn('id', $friendships->friendIds($user))->pluck('username')->all()));
            echo ",\n\"communities\": ";
            $write(array_values(CommunityMember::query()->with('community')->where('user_id', $user->id)->get()
                ->map(fn (CommunityMember $m) => ['community' => $m->community->slug ?? null, 'role' => $m->role])->all()));

            $sections = [
                'posts' => [Post::query()->with('attachments')->where('author_id', $user->id), fn (Post $p) => [
                    'id' => $p->id,
                    'body' => $p->body,
                    'images' => $p->attachments->pluck('url')->all(),
                    'created_at' => $p->created_at->toIso8601String(),
                ]],
                'comments' => [Comment::query()->where('user_id', $user->id), fn (Comment $c) => [
                    'post_id' => $c->post_id,
                    'body' => $c->body,
                    'created_at' => $c->created_at->toIso8601String(),
                ]],
                'photos' => [Photo::query()->where('user_id', $user->id), fn (Photo $p) => [
                    'url' => $p->url,
                    'caption' => $p->caption,
                ]],
                'messages' => [Message::query()->where('user_id', $user->id), fn (Message $m) => [
                    'conversation_id' => $m->conversation_id,
                    'body' => $m->body,
                    'created_at' => $m->created_at->toIso8601String(),
                ]],
            ];
            foreach ($sections as $key => [$query, $map]) {
                echo ",\n\"{$key}\": [";
                $first = true;
                foreach ($query->orderBy('id')->lazyById(500) as $row) {
                    echo $first ? "\n" : ",\n";
                    $first = false;
                    $write($map($row));
                }
                echo "\n]";
            }
            echo "\n}\n";
        }, $name, ['Content-Type' => 'application/json; charset=utf-8']);
    }

    /**
     * Заморожування: сторінку ніхто не бачить, усі сесії закрито, наступний вхід розморожує.
     */
    public function freeze(Request $request): RedirectResponse
    {
        $user = $this->user($request);
        $request->validate(['password' => ['required', 'string']]);
        if (! Hash::check((string) $request->input('password'), $user->password)) {
            throw ValidationException::withMessages(['password' => 'Невірний пароль.']);
        }
        $this->security->freeze($user, null);
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return to_route('login')->with('status', 'Акаунт заморожено. Щоб повернутися, просто увійдіть знову.');
    }

    public function appeal(Request $request): RedirectResponse
    {
        $user = $this->user($request);
        $data = $request->validate([
            'kind' => ['required', Rule::in(array_keys(Appeal::KINDS))],
            'body' => ['required', 'string', 'min:10', 'max:2000'],
        ]);
        if (Appeal::query()->where('user_id', $user->id)->where('status', Appeal::PENDING)->count() >= 3) {
            throw ValidationException::withMessages(['body' => 'Дочекайтеся відповіді на попередні оскарження.']);
        }
        Appeal::query()->create(['user_id' => $user->id, 'kind' => $data['kind'], 'body' => trim($data['body'])]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Оскарження надіслано модераторам.']);

        return back();
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return $user;
    }
}
