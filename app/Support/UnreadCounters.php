<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Лічильники непрочитаного, які видно з будь-якої сторінки (бейджі в
 * навігації сайту, SPA і застосунку). Через таблиці, а не класи аддонів:
 * ядро не імпортує Addons\*, а Schema::hasTable() рятує, якщо модуль
 * (Notifications, Messenger) ще не встановлено.
 */
final class UnreadCounters
{
    public static function notifications(int $userId): int
    {
        if (! Schema::hasTable('notifications')) {
            return 0;
        }

        return DB::table('notifications')->where('user_id', $userId)->whereNull('read_at')->count();
    }

    /**
     * Розмов на учасника завжди мало (сімейний чат + жменька особистих),
     * тому цикл по них — не проблема продуктивності.
     */
    public static function messages(int $userId): int
    {
        if (! Schema::hasTable('messages')) {
            return 0;
        }

        $familyId = DB::table('conversations')->where('type', 'family')->value('id');
        $directIds = DB::table('conversation_participants')->where('user_id', $userId)->pluck('conversation_id');
        $conversationIds = $directIds->when($familyId, fn ($c) => $c->push($familyId))->unique();

        if ($conversationIds->isEmpty()) {
            return 0;
        }

        $reads = DB::table('conversation_reads')
            ->where('user_id', $userId)
            ->whereIn('conversation_id', $conversationIds)
            ->pluck('last_read_message_id', 'conversation_id');

        $count = 0;
        foreach ($conversationIds as $conversationId) {
            $lastRead = $reads[$conversationId] ?? 0;
            $count += DB::table('messages')
                ->where('conversation_id', $conversationId)
                ->where('id', '>', $lastRead)
                // sender_id NULL — системне повідомлення (чат Monsory Finance);
                // у SQL "NULL != x" не істинне, тож без whereNull воно ніколи
                // не рахувалось би непрочитаним.
                ->where(fn ($q) => $q->whereNull('sender_id')->orWhere('sender_id', '!=', $userId))
                ->count();
        }

        return $count;
    }
}
