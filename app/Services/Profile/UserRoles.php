<?php

namespace App\Services\Profile;

use App\Models\PaymentOrder;
use App\Models\User;
use App\Models\UserRole;
use App\Services\Achievements;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Ролі-плашки користувачів: видані вручну, видані нічною задачею (рівень, досягнення, підтримка)
 * і ті, що перевіряються одразу (GameCon+, стаж). Один об'єкт на запит: prime() вантажить ролі
 * пачкою для стрічки, of() — для однієї людини.
 */
class UserRoles
{
    private const CACHE_KEY = 'user_roles.catalog';

    /** @var Collection<int, UserRole>|null */
    private ?Collection $catalog = null;

    /** @var array<int, list<int>> user_id → id ролей із таблиці видачі */
    private array $granted = [];

    /**
     * Усі ролі (кеш на 10 хвилин; скидається при зміні в адмінці). У кеші — масиви атрибутів:
     * моделі туди класти не можна (кеш не розпаковує класи).
     *
     * @return Collection<int, UserRole>
     */
    public function catalog(): Collection
    {
        return $this->catalog ??= UserRole::hydrate(Cache::remember(
            self::CACHE_KEY,
            600,
            fn () => UserRole::query()->orderBy('priority')->orderBy('id')->get()->map(fn (UserRole $r) => $r->getAttributes())->all(),
        ))->toBase();
    }

    public static function forget(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    /**
     * @param  iterable<User|null>  $users
     */
    public function prime(iterable $users): void
    {
        $ids = collect($users)->filter()->map(fn (User $u) => $u->id)->reject(fn (int $id) => array_key_exists($id, $this->granted))->unique()->values();
        if ($ids->isEmpty()) {
            return;
        }
        $rows = $this->catalog()->isEmpty() ? collect() : DB::table('user_role_user')->whereIn('user_id', $ids)->get(['user_id', 'user_role_id']);
        foreach ($ids as $id) {
            $this->granted[$id] = [];
        }
        foreach ($rows as $row) {
            $this->granted[(int) $row->user_id][] = (int) $row->user_role_id;
        }
    }

    /**
     * Ролі людини в порядку показу.
     *
     * @return list<array{id: int, name: string, kind: string, color: string, icon: string|null, description: string|null}>
     */
    public function of(User $user): array
    {
        $catalog = $this->catalog();
        if ($catalog->isEmpty()) {
            return [];
        }
        $this->prime([$user]);
        $granted = $this->granted[$user->id] ?? [];
        $out = [];
        foreach ($catalog as $role) {
            if (! $role->activeNow()) {
                continue;
            }
            if (in_array($role->id, $granted, true) || $this->liveMatch($role, $user)) {
                $out[] = $role->toCard();
            }
        }

        return $out;
    }

    /** Правила, які видно одразу з профілю, без нічної задачі. */
    private function liveMatch(UserRole $role, User $user): bool
    {
        return match ($role->rule) {
            'plus' => $user->isPlus(),
            'account_years' => $user->created_at !== null && $user->created_at->lte(now()->subYears(max(1, (int) $role->rule_value))),
            default => false,
        };
    }

    /**
     * Нічна задача: видати й забрати автоматичні ролі (рівень, досягнення, підтримка) активним людям.
     * Видані вручну не чіпає.
     *
     * @return int скільки змін
     */
    public function sync(): int
    {
        $roles = $this->catalog()->filter(fn (UserRole $r) => in_array($r->rule, UserRole::SYNCED, true));
        if ($roles->isEmpty()) {
            return 0;
        }
        $changes = 0;
        $achievements = app(Achievements::class);
        User::query()->where('last_seen_at', '>=', now()->subDays(90))->whereNull('banned_at')
            ->chunkById(200, function (Collection $users) use ($roles, $achievements, &$changes) {
                $spent = PaymentOrder::query()->whereIn('user_id', $users->pluck('id'))->where('status', PaymentOrder::PAID)
                    ->groupBy('user_id')->selectRaw('user_id, SUM(amount) as total')->pluck('total', 'user_id');
                foreach ($users as $user) {
                    $progress = null;
                    foreach ($roles as $role) {
                        if (in_array($role->rule, ['level', 'achievement'], true)) {
                            $progress ??= $achievements->for($user);
                        }
                        $match = match ($role->rule) {
                            'level' => ($progress['level'] ?? 0) >= max(1, (int) $role->rule_value),
                            'achievement' => collect($progress['badges'] ?? [])->contains(fn (array $b) => ($b['key'] ?? null) === $role->rule_value && ($b['earned'] ?? false)),
                            'spent' => (int) ($spent[$user->id] ?? 0) >= max(1, (int) $role->rule_value) * 100,
                            default => false,
                        };
                        $changes += $this->setAuto($role, $user, $match);
                    }
                }
            });

        return $changes;
    }

    private function setAuto(UserRole $role, User $user, bool $match): int
    {
        $row = DB::table('user_role_user')->where('user_role_id', $role->id)->where('user_id', $user->id)->first();
        if ($match && $row === null) {
            DB::table('user_role_user')->insert(['user_role_id' => $role->id, 'user_id' => $user->id, 'auto' => true, 'created_at' => now(), 'updated_at' => now()]);

            return 1;
        }
        if (! $match && $row !== null && (bool) $row->auto) {
            DB::table('user_role_user')->where('id', $row->id)->delete();

            return 1;
        }

        return 0;
    }
}
