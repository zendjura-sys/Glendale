<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Учасники вже видалених сімей лишались «активними»: сайт і застосунок показували штаб сім’ї,
 * якої немає, і не давали вступити чи створити нову. Закриваємо такі членства (історія лишається); так само для кланів.
 */
return new class extends Migration
{
    public function up(): void
    {
        $deleted = DB::table('families')->whereNotNull('deleted_at')->pluck('id');
        foreach ($deleted->chunk(500) as $ids) {
            DB::table('family_members')->whereIn('family_id', $ids)->where('status', 'active')
                ->update(['status' => 'left', 'left_at' => now()]);
            DB::table('family_members')->whereIn('family_id', $ids)->where('status', 'pending')
                ->update(['status' => 'declined', 'left_at' => now()]);
        }
        // Те саме для кланів.
        $clans = DB::table('clans')->whereNotNull('deleted_at')->pluck('id');
        foreach ($clans->chunk(500) as $ids) {
            DB::table('clan_members')->whereIn('clan_id', $ids)->whereIn('status', ['active', 'pending'])->update(['status' => 'left']);
        }
    }

    public function down(): void
    {
        // Повертати людей у неіснуючі сім’ї не потрібно.
    }
};
