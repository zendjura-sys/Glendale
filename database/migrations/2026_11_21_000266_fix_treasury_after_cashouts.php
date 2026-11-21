<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Виплата зароблених грошей учаснику раніше помилково зменшувала казну сім’ї (вона й так
 * списувалась із балансу учасника). Книгу операцій не змінюємо: повертаємо суму в казну
 * окремою операцією «Виправлення казни».
 */
return new class extends Migration
{
    public function up(): void
    {
        $rows = DB::table('family_transactions')->where('type', 'cashout_paid')->where('treasury_delta', '<', 0)
            ->groupBy('family_id')->selectRaw('family_id, SUM(treasury_delta) as total')->get();
        foreach ($rows as $row) {
            $back = -(int) $row->total;
            if ($back <= 0) {
                continue;
            }
            DB::transaction(function () use ($row, $back) {
                $treasury = (int) DB::table('families')->where('id', $row->family_id)->lockForUpdate()->value('treasury');
                $after = $treasury + $back;
                DB::table('families')->where('id', $row->family_id)->update(['treasury' => $after]);
                DB::table('family_transactions')->insert([
                    'family_id' => $row->family_id,
                    'member_id' => null,
                    'type' => 'treasury_fix',
                    'amount' => 0,
                    'balance_after' => null,
                    'treasury_delta' => $back,
                    'treasury_after' => $after,
                    'actor_id' => null,
                    'comment' => 'Виправлення: виплати із заробленого учасниками не зменшують казну',
                    'subject_type' => null,
                    'subject_id' => null,
                    'created_at' => now(),
                ]);
            });
        }
    }

    public function down(): void
    {
        // Виправлення лишається в книзі операцій; відкочувати нічого.
    }
};
