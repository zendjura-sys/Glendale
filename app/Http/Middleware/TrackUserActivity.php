<?php

namespace App\Http\Middleware;

use App\Services\Analytics\ActivityMetrics;
use App\Services\Auth\AccountSecurity;
use App\Services\Engagement\Streaks;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class TrackUserActivity
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->isBanned()) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return redirect()->route('login')->withErrors([
                'email' => 'Обліковий запис заблоковано'.($user->ban_reason ? ': '.$user->ban_reason : '.'),
            ]);
        }

        $security = app(AccountSecurity::class);
        if ($user && $request->hasSession() && $security->revoked($request->session()->getId())) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return redirect()->route('login')->withErrors(['email' => 'Сесію завершено з іншого пристрою. Увійдіть знову.']);
        }

        if ($user) {
            $security->touch($request, $user);
            app(ActivityMetrics::class)->touch($user, 'web', $request);
        }

        if ($user && (! $user->last_seen_at || $user->last_seen_at->lt(now()->subMinute()))) {
            $user->forceFill(['last_seen_at' => now()])->saveQuietly();
            // Серія днів поспіль — раз на день, разом з «був у мережі».
            app(Streaks::class)->touch($user);
        }

        return $next($request);
    }
}
