<?php

namespace App\Services\Accounts;

use App\Models\User;
use App\Support\Plugins\Plugins;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Перемикач акаунтів на пристрої. У зашифрованому cookie — пари «акаунт → випадковий токен»,
 * у базі — лише хеш токена. Новий акаунт додається звичайним входом (з 2FA, якщо є),
 * тож перемикач нічого не обходить; вийти з акаунта на пристрої — прибрати його зі списку.
 */
class AccountSwitcher
{
    public const COOKIE = 'gc_accounts';

    public const MAX = 5;

    /** Позначка в сесії: людина пішла додавати ще один акаунт. */
    public const ADDING = 'gc_adding_account';

    /**
     * @return array<int, string> user_id => токен
     */
    public function stored(Request $request): array
    {
        $cookie = $request->cookie(self::COOKIE);
        $raw = is_string($cookie) ? json_decode($cookie, true) : [];
        $pairs = [];
        foreach (is_array($raw) ? $raw : [] as $id => $token) {
            if (is_numeric($id) && is_string($token) && strlen($token) === 40) {
                $pairs[(int) $id] = $token;
            }
        }

        return array_slice($pairs, 0, self::MAX, true);
    }

    /**
     * Збережені акаунти з дійсними токенами.
     *
     * @return list<array<string, mixed>>
     */
    public function accounts(Request $request): array
    {
        $current = $request->user();
        $valid = $this->valid($this->stored($request));
        $users = User::query()->whereIn('id', array_keys($valid))->get()->keyBy('id');

        $list = [];
        foreach (array_keys($valid) as $id) {
            $user = $users->get($id);
            if ($user !== null && $user->banned_at === null) {
                $list[] = [...$user->toCard(), 'current' => $current?->id === $user->id];
            }
        }

        return $list;
    }

    /** Запамʼятати акаунт на цьому пристрої (після звичайного входу). */
    public function remember(Request $request, User $user): void
    {
        if (! app(Plugins::class)->on('account_switcher')) {
            return;
        }
        $pairs = $this->valid($this->stored($request));
        if (isset($pairs[$user->id])) {
            return;
        }
        if (count($pairs) >= self::MAX) {
            return;
        }
        $token = Str::random(40);
        DB::table('device_account_tokens')->insert(['user_id' => $user->id, 'token_hash' => hash('sha256', $token), 'created_at' => now(), 'updated_at' => now()]);
        $pairs[$user->id] = $token;
        $this->queue($pairs);
    }

    /** Перейти в інший збережений акаунт. */
    public function switchTo(Request $request, int $id): bool
    {
        $pairs = $this->valid($this->stored($request));
        $user = isset($pairs[$id]) ? User::query()->find($id) : null;
        if ($user === null || $user->banned_at !== null) {
            return false;
        }
        DB::table('device_account_tokens')->where('token_hash', hash('sha256', $pairs[$id]))->update(['last_used_at' => now()]);
        $from = $request->user()?->id;
        Auth::guard('web')->login($user);
        $request->session()->regenerate();
        Log::info('account switch', ['from' => $from, 'to' => $user->id, 'ip' => $request->ip()]);

        return true;
    }

    /** Прибрати акаунт з пристрою (токен стає недійсним). */
    public function forget(Request $request, int $id): void
    {
        $pairs = $this->stored($request);
        if (isset($pairs[$id])) {
            DB::table('device_account_tokens')->where('token_hash', hash('sha256', $pairs[$id]))->delete();
            unset($pairs[$id]);
        }
        $this->queue($pairs);
    }

    /**
     * Лише пари, чий токен ще є в базі й належить цьому акаунту.
     *
     * @param  array<int, string>  $pairs
     * @return array<int, string>
     */
    private function valid(array $pairs): array
    {
        if ($pairs === []) {
            return [];
        }
        $known = DB::table('device_account_tokens')->whereIn('token_hash', array_map(fn (string $t) => hash('sha256', $t), $pairs))
            ->pluck('user_id', 'token_hash')->all();

        return array_filter($pairs, fn (string $token, int $id) => (int) ($known[hash('sha256', $token)] ?? 0) === $id, ARRAY_FILTER_USE_BOTH);
    }

    /**
     * @param  array<int, string>  $pairs
     */
    private function queue(array $pairs): void
    {
        Cookie::queue(self::COOKIE, (string) json_encode((object) $pairs), 60 * 24 * 180, null, null, null, true, false, 'lax');
    }
}
