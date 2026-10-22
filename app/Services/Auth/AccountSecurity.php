<?php

namespace App\Services\Auth;

use App\Models\ApiToken;
use App\Models\LoginEvent;
use App\Models\User;
use App\Models\UserSession;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Str;
use Inertia\Inertia;

/** Пристрої й сесії, журнал входів, заморожування акаунта. */
class AccountSecurity
{
    /** Як часто оновлювати «востаннє активна» для сесії, секунд. */
    public const TOUCH_EVERY = 300;

    public const HISTORY = 30;

    public static function hash(string $sessionId): string
    {
        return hash('sha256', $sessionId);
    }

    /**
     * Сесію завершили з іншого пристрою?
     */
    public function revoked(string $sessionId): bool
    {
        return Cache::has('session.revoked.'.self::hash($sessionId));
    }

    public function touch(Request $request, User $user): void
    {
        if (! $request->hasSession()) {
            return;
        }
        $id = $request->session()->getId();
        $hash = self::hash($id);
        if (! Cache::add('session.seen.'.$hash, true, self::TOUCH_EVERY)) {
            return;
        }
        UserSession::query()->updateOrCreate(
            ['session_hash' => $hash],
            [
                'user_id' => $user->id,
                'handle' => $id,
                'ip' => $request->ip(),
                'user_agent' => Str::limit((string) $request->userAgent(), 250, ''),
                'last_active_at' => now(),
            ],
        );
    }

    public function forget(string $sessionId): void
    {
        $hash = self::hash($sessionId);
        UserSession::query()->where('session_hash', $hash)->delete();
        Cache::forget('session.seen.'.$hash);
    }

    /**
     * Завершує сесії користувача (усі, крім $keep) і мобільні входи з $tokenIds (null — усі).
     *
     * @param  list<int>|null  $sessionIds
     * @param  list<int>|null  $tokenIds
     */
    public function revoke(User $user, ?string $keep, ?array $sessionIds = null, ?array $tokenIds = []): int
    {
        $keepHash = $keep !== null ? self::hash($keep) : null;
        $sessions = UserSession::query()
            ->where('user_id', $user->id)
            ->when($keepHash !== null, fn ($q) => $q->where('session_hash', '!=', $keepHash))
            ->when($sessionIds !== null, fn ($q) => $q->whereIn('id', $sessionIds))
            ->get();
        $lifetime = max(60, (int) config('session.lifetime', 120) * 60);
        foreach ($sessions as $session) {
            Cache::put('session.revoked.'.$session->session_hash, true, $lifetime);
            Cache::forget('session.seen.'.$session->session_hash);
            rescue(fn () => Session::getHandler()->destroy($session->handle), report: false);
            $session->delete();
        }

        $tokens = 0;
        if ($tokenIds === null || $tokenIds !== []) {
            $tokens = ApiToken::query()
                ->where('user_id', $user->id)
                ->when($tokenIds !== null, fn ($q) => $q->whereIn('id', $tokenIds))
                ->delete();
        }

        if ($sessions->isNotEmpty()) {
            // «Запам’ятати мене» на тих пристроях теж має перестати працювати.
            $user->setRememberToken(Str::random(60));
            $user->saveQuietly();
        }

        return $sessions->count() + $tokens;
    }

    public function logLogin(User $user, string $method, bool $success, ?Request $request = null): void
    {
        $request ??= request();
        LoginEvent::query()->create([
            'user_id' => $user->id,
            'method' => $method,
            'success' => $success,
            'ip' => $request->ip(),
            'user_agent' => Str::limit((string) $request->userAgent(), 250, ''),
            'created_at' => now(),
        ]);
        if ($success && $user->frozen_at !== null) {
            $user->forceFill(['frozen_at' => null])->saveQuietly();
            if ($request->hasSession()) {
                Inertia::flash('toast', ['type' => 'success', 'message' => 'З поверненням! Акаунт розморожено.']);
            }
        }
    }

    public function freeze(User $user, ?string $keep): void
    {
        $user->forceFill(['frozen_at' => now(), 'last_seen_at' => null])->saveQuietly();
        $this->revoke($user, $keep, null, null);
    }

    /**
     * Коротка назва пристрою з User-Agent: «Chrome · Android».
     */
    public static function device(?string $agent): string
    {
        $agent = (string) $agent;
        if ($agent === '') {
            return 'Невідомий пристрій';
        }
        $browser = match (true) {
            str_contains($agent, 'GameConApp') || str_contains($agent, 'Dart/') => 'Застосунок GameCon',
            str_contains($agent, 'Edg/') => 'Edge',
            str_contains($agent, 'OPR/') || str_contains($agent, 'Opera') => 'Opera',
            str_contains($agent, 'YaBrowser') => 'Chromium',
            str_contains($agent, 'Firefox/') => 'Firefox',
            str_contains($agent, 'Chrome/') => 'Chrome',
            str_contains($agent, 'Safari/') => 'Safari',
            default => 'Браузер',
        };
        $os = match (true) {
            str_contains($agent, 'Android') => 'Android',
            str_contains($agent, 'iPhone') || str_contains($agent, 'iPad') => 'iOS',
            str_contains($agent, 'Windows') => 'Windows',
            str_contains($agent, 'Mac OS') => 'macOS',
            str_contains($agent, 'Linux') => 'Linux',
            default => null,
        };

        return $os ? $browser.' · '.$os : $browser;
    }

    /**
     * Метод входу з назви маршруту, на якому спрацював вхід.
     */
    public static function methodFromRoute(?string $route): string
    {
        return match (true) {
            $route === null => 'password',
            str_contains($route, 'two-factor') => '2fa',
            str_contains($route, 'passkey') => 'passkey',
            str_contains($route, 'google') || str_contains($route, 'firebase') => 'google',
            str_contains($route, 'register') => 'register',
            str_contains($route, 'discord') => 'discord',
            default => 'password',
        };
    }
}
