<?php

namespace Addons\Bonuses\Support;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Міст до системи покарань Кадрового центру: штрафи, сплачені учасником
 * з рахунку (paid_via=bank), віднімаються з балансу й видно у виписці.
 * Через таблицю, а не модель MemberCenter — модуль опційний; без нього
 * (або зі старою схемою без paid_via) просто нуль.
 */
final class DisciplineFines
{
    private static ?bool $available = null;

    public static function available(): bool
    {
        return self::$available ??= Schema::hasTable('member_warnings') && Schema::hasColumn('member_warnings', 'paid_via');
    }

    public static function paidFromBank(int $userId): int
    {
        return self::available()
            ? (int) self::query($userId)->sum('amount')
            : 0;
    }

    /** Рядки виписки банку — той самий формат, що й решта транзакцій. */
    public static function statementEntries(int $userId): Collection
    {
        if (! self::available()) {
            return collect();
        }

        return self::query($userId)
            ->latest('paid_at')
            ->limit(30)
            ->get(['amount', 'rule_code', 'paid_at'])
            ->map(fn ($row) => [
                'kind' => 'fine',
                'sign' => '−',
                'amount' => (int) $row->amount,
                'label' => 'Сплата штрафу',
                'detail' => $row->rule_code ? "п. {$row->rule_code} правил родини" : null,
                'reversed' => false,
                'at' => \Illuminate\Support\Carbon::parse($row->paid_at),
            ]);
    }

    public static function hasActiveReprimand(int $userId): bool
    {
        return self::available()
            && DB::table('member_warnings')
                ->when(\App\Families\FamilyContext::id(), fn ($q, $f) => $q->where('family_id', $f))
                ->where('user_id', $userId)->where('type', 'reprimand')->where('status', 'active')
                ->exists();
    }

    private static function query(int $userId)
    {
        return DB::table('member_warnings')
            ->when(\App\Families\FamilyContext::id(), fn ($q, $f) => $q->where('family_id', $f))
            ->where('user_id', $userId)
            ->where('type', 'fine')
            ->where('status', 'paid')
            ->where('paid_via', 'bank');
    }
}
