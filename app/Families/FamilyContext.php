<?php

namespace App\Families;

use App\Models\User;
use Closure;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Активна родина — у межах якої працюють інструменти системи родин
 * (звіти, банк, покарання, цілі, події, прогрес, кадри, розсилки).
 *
 * Звідки береться, по черзі:
 *  1. явно задана (фонові задачі, розклад: run($familyId, fn));
 *  2. обрана людиною: заголовок X-Family-Id (застосунок) або збережена
 *     в профілі (users.active_family_id, перемикач «Моя родина» в меню) —
 *     якщо вона там учасник або адміністратор платформи;
 *  3. перша підтверджена родина людини;
 *  4. родина за замовчуванням — найстаріша підтверджена (Monsory):
 *     для запитів без людини й старих даних.
 *
 * Значення їде й у черги: Context автоматично передається в задачі,
 * поставлені з цього запиту.
 */
final class FamilyContext
{
    private const KEY = 'family_id';

    /** @var array<int, int|null> кеш на запит: user_id → family_id */
    private static array $resolved = [];

    private static ?int $default = null;

    private static bool $defaultLoaded = false;

    public static function id(): ?int
    {
        if (Context::has(self::KEY)) {
            return Context::get(self::KEY);
        }
        $user = auth()->user();
        if ($user instanceof User) {
            return self::$resolved[$user->id] ??= self::resolveFor($user);
        }

        return self::defaultId();
    }

    public static function family(): ?object
    {
        $id = self::id();

        return $id ? DB::table('families')->find($id) : null;
    }

    /** Виконати в межах конкретної родини (розклад, черги, адмінські дії). */
    public static function run(int $familyId, Closure $callback): mixed
    {
        $had = Context::has(self::KEY);
        $previous = Context::get(self::KEY);
        Context::add(self::KEY, $familyId);
        try {
            return $callback();
        } finally {
            $had ? Context::add(self::KEY, $previous) : Context::forget(self::KEY);
        }
    }

    /**
     * Виконати для кожної підтвердженої родини окремо (розклад: тижневі
     * премії, бонуси прогресії — кожна родина рахується в своїх межах).
     */
    public static function eachVerified(Closure $callback): void
    {
        foreach (DB::table('families')->where('status', 'verified')->orderBy('id')->pluck('id') as $id) {
            self::run((int) $id, fn () => $callback((int) $id));
        }
    }

    public static function set(?int $familyId): void
    {
        $familyId === null ? Context::forget(self::KEY) : Context::add(self::KEY, $familyId);
    }

    /** Обрати активну родину (перемикач у меню). */
    public static function choose(User $user, int $familyId): bool
    {
        if (! self::canUse($user, $familyId)) {
            return false;
        }
        $user->forceFill(['active_family_id' => $familyId])->saveQuietly();
        self::$resolved[$user->id] = $familyId;

        return true;
    }

    /** Родини, де людина учасник і які підтверджені, — для перемикача. */
    public static function familiesOf(User $user): array
    {
        return DB::table('family_members as m')->join('families as f', 'f.id', '=', 'm.family_id')
            ->where('m.user_id', $user->id)->where('f.status', 'verified')
            ->orderBy('m.created_at')->orderBy('f.id')
            ->select('f.id', 'f.name', 'f.tag', 'm.role')->get()->all();
    }

    public static function role(User $user, ?int $familyId = null): ?string
    {
        $familyId ??= self::id();

        return $familyId ? DB::table('family_members')->where('family_id', $familyId)->where('user_id', $user->id)->value('role') : null;
    }

    public static function isMember(User $user, ?int $familyId = null): bool
    {
        return self::role($user, $familyId) !== null;
    }

    /** Лідер або заступник активної родини — керує її інструментами. */
    public static function isManager(User $user, ?int $familyId = null): bool
    {
        return in_array(self::role($user, $familyId), ['leader', 'deputy'], true);
    }

    public static function defaultId(): ?int
    {
        if (! self::$defaultLoaded) {
            self::$defaultLoaded = true;
            try {
                self::$default = Schema::hasTable('families')
                    ? DB::table('families')->where('status', 'verified')->orderBy('id')->value('id')
                    : null;
            } catch (\Throwable) {
                self::$default = null;
            }
        }

        return self::$default;
    }

    /** Скинути кеш процесу (тести). */
    public static function flush(): void
    {
        self::flushCache();
        Context::forget(self::KEY);
    }

    /** Кеш «хто в якій родині» — між задачами черги (воркер живе годину). */
    public static function flushCache(): void
    {
        FamilyPositions::flush();
        self::$resolved = [];
        self::$default = null;
        self::$defaultLoaded = false;
    }

    private static function resolveFor(User $user): ?int
    {
        foreach ([request()->header('X-Family-Id'), $user->active_family_id ?? null] as $wanted) {
            if ($wanted && self::canUse($user, (int) $wanted)) {
                return (int) $wanted;
            }
        }
        $own = self::familiesOf($user)[0]->id ?? null;

        return $own ? (int) $own : self::defaultId();
    }

    private static function canUse(User $user, int $familyId): bool
    {
        $family = DB::table('families')->where('id', $familyId)->first();
        if (! $family) {
            return false;
        }
        if ($user->can('families.manage')) {
            return true;
        }

        // Інструменти відкриваються після верифікації родини адміністрацією.
        return $family->status === 'verified' && self::isMember($user, $familyId);
    }
}
