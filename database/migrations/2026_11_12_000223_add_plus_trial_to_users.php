<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Пробний період GameCon+: один раз на акаунт (коли взяли й чи нагадали про кінець). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('plus_trial_at')->nullable();
            $table->timestamp('plus_trial_reminded_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn(['plus_trial_at', 'plus_trial_reminded_at']));
    }
};
