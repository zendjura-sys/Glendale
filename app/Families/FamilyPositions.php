<?php

namespace App\Families;

use Illuminate\Support\Facades\DB;

/**
 * Посада людини — своя в кожній родині (family_members.position_key).
 * Один запит на родину за процес: списки (рейтинг, кадри) не роблять
 * окремого запиту на кожну людину.
 */
final class FamilyPositions
{
    /** @var array<int, array<int, string|null>> family_id → [user_id → position_key] */
    private static array $maps = [];

    /** @return array<int, string|null> */
    public static function map(int $familyId): array
    {
        return self::$maps[$familyId] ??= DB::table('family_members')->where('family_id', $familyId)->pluck('position_key', 'user_id')->all();
    }

    public static function set(int $familyId, int $userId, ?string $key): void
    {
        DB::table('family_members')->where('family_id', $familyId)->where('user_id', $userId)->update(['position_key' => $key]);
        unset(self::$maps[$familyId]);
    }

    public static function flush(): void
    {
        self::$maps = [];
    }
}
