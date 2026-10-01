<?php

namespace App\Services\Auth;

use App\Models\ApiToken;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class ApiTokens
{
    public function issue(User $user, string $name = 'android'): string
    {
        $plain = Str::random(64);

        ApiToken::query()->create([
            'user_id' => $user->id,
            'name' => Str::limit($name, 40, ''),
            'token' => hash('sha256', $plain),
        ]);

        return $plain;
    }

    public function revoke(User $user, string $plain): void
    {
        ApiToken::query()->where('user_id', $user->id)->where('token', hash('sha256', $plain))->delete();
    }

    public function handoff(User $user): string
    {
        $code = Str::random(48);
        Cache::put($this->handoffKey($code), $user->id, now()->addMinutes(2));

        return $code;
    }

    public function takeHandoff(string $code): ?User
    {
        $id = Cache::pull($this->handoffKey($code));

        return $this->userFromCache($id);
    }

    public function ticket(User $user): string
    {
        $ticket = Str::random(48);
        Cache::put($this->ticketKey($ticket), $user->id, now()->addMinutes(5));

        return $ticket;
    }

    public function userFromTicket(string $ticket): ?User
    {
        return $this->userFromCache(Cache::get($this->ticketKey($ticket)));
    }

    public function forgetTicket(string $ticket): void
    {
        Cache::forget($this->ticketKey($ticket));
    }

    private function handoffKey(string $code): string
    {
        return 'app.handoff.'.$code;
    }

    private function ticketKey(string $ticket): string
    {
        return 'app.2fa.'.$ticket;
    }

    private function userFromCache(mixed $id): ?User
    {
        if (! is_int($id) && ! (is_string($id) && ctype_digit($id))) {
            return null;
        }

        return User::query()->find((int) $id);
    }
}
