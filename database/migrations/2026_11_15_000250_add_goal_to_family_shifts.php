<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Завдання зміни (N контрактів певної складності, бізвари) з автоматичним зарахуванням зі схвалених звітів. */
    public function up(): void
    {
        Schema::table('family_shifts', function (Blueprint $table) {
            $table->json('goal')->nullable()->after('note');
            $table->unsignedInteger('progress')->default(0)->after('goal');
            $table->timestamp('completed_at')->nullable()->after('progress');
        });
    }

    public function down(): void
    {
        Schema::table('family_shifts', function (Blueprint $table) {
            $table->dropColumn(['goal', 'progress', 'completed_at']);
        });
    }
};
