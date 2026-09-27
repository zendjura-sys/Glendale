<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Інструменти системи родин — для кожної родини окремо: у кожній таблиці
 * модулів з'являється family_id. Усе, що вже є (звіти, банк, покарання…),
 * належить першій родині платформи — Monsory; нова родина починає з нуля.
 *
 * Унікальності «одна строка на людину» стають «одна на людину в родині»:
 * у двох родинах (на різних серверах) одна людина має окремий профіль,
 * окремий досвід і окремі премії.
 */
return new class extends Migration
{
    private const TABLES = [
        'reports', 'bonus_payouts', 'bonus_settings', 'bank_deposits', 'bank_transfers', 'bank_cash_requests',
        'investment_achievement_tiers', 'bonus_manual_awards', 'user_investment_achievements',
        'family_events', 'activity_events', 'family_goals',
        'leave_requests', 'member_notes', 'member_profiles', 'member_warnings',
        'broadcasts', 'progression_profiles', 'xp_ledger', 'user_achievements',
        'telegram_applications', 'telegram_chats',
    ];

    /** [таблиця, стара унікальність, нова] */
    private const UNIQUES = [
        ['member_profiles', ['user_id'], ['family_id', 'user_id']],
        ['progression_profiles', ['user_id'], ['family_id', 'user_id']],
        ['user_achievements', ['user_id', 'achievement_id'], ['family_id', 'user_id', 'achievement_id']],
        ['bonus_payouts', ['user_id', 'week_start'], ['family_id', 'user_id', 'week_start']],
    ];

    public function up(): void
    {
        $monsory = DB::table('families')->where('status', 'verified')->orderBy('id')->value('id');

        foreach (self::TABLES as $table) {
            if (! Schema::hasTable($table) || Schema::hasColumn($table, 'family_id')) {
                continue;
            }
            Schema::table($table, function (Blueprint $t) {
                $t->unsignedBigInteger('family_id')->nullable()->after('id')->index();
            });
            if ($monsory) {
                DB::table($table)->update(['family_id' => $monsory]);
            }
        }

        foreach (self::UNIQUES as [$table, $old, $new]) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            Schema::table($table, function (Blueprint $t) use ($table, $old, $new) {
                // Зовнішній ключ на user_id тримається на старому унікальному
                // індексі (MySQL) — спершу окремий звичайний індекс.
                $t->index('user_id', "{$table}_user_id_family_idx");
                $t->dropUnique($old);
                $t->unique($new);
            });
        }

        // Посада — у кожній родині своя (не одна на весь сайт).
        if (! Schema::hasColumn('family_members', 'position_key')) {
            Schema::table('family_members', function (Blueprint $t) {
                $t->string('position_key', 40)->nullable()->after('role');
            });
            if ($monsory) {
                DB::statement('UPDATE family_members SET position_key = (SELECT users.position_key FROM users WHERE users.id = family_members.user_id) WHERE family_id = ?', [$monsory]);
            }
        }
    }

    public function down(): void
    {
        foreach (array_reverse(self::UNIQUES) as [$table, $old, $new]) {
            if (Schema::hasTable($table)) {
                Schema::table($table, function (Blueprint $t) use ($table, $old, $new) {
                    $t->dropUnique($new);
                    $t->unique($old);
                    $t->dropIndex("{$table}_user_id_family_idx");
                });
            }
        }
        foreach (self::TABLES as $table) {
            if (Schema::hasTable($table) && Schema::hasColumn($table, 'family_id')) {
                Schema::table($table, function (Blueprint $t) {
                    $t->dropIndex(['family_id']);
                    $t->dropColumn('family_id');
                });
            }
        }
        if (Schema::hasColumn('family_members', 'position_key')) {
            Schema::table('family_members', fn (Blueprint $t) => $t->dropColumn('position_key'));
        }
    }
};
