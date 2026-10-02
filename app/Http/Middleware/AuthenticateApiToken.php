<?php

namespace App\Http\Middleware;

use App\Models\ApiToken;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateApiToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $plain = $request->bearerToken();

        if (! is_string($plain) || $plain === '') {
            return response()->json(['message' => 'Потрібна авторизація.'], 401);
        }

        $record = ApiToken::query()->with('user')->where('token', hash('sha256', $plain))->first();
        $user = $record?->user;

        if ($record === null || $user === null) {
            return response()->json(['message' => 'Сесія закінчилась. Увійдіть знову.'], 401);
        }

        if ($user->isBanned()) {
            $record->delete();

            return response()->json([
                'message' => 'Обліковий запис заблоковано'.($user->ban_reason ? ': '.$user->ban_reason : '.'),
            ], 403);
        }

        if ($user->last_seen_at === null || $user->last_seen_at->lt(now()->subMinute())) {
            $user->forceFill(['last_seen_at' => now()])->saveQuietly();
        }

        if ($record->last_used_at === null || $record->last_used_at->lt(now()->subMinutes(5))) {
            $record->forceFill(['last_used_at' => now()])->saveQuietly();
        }

        Auth::setUser($user);

        return $next($request);
    }
}
