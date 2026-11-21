<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Серія днів поспіль на GameCon: поточна, найкраща й останній день (за київським часом).
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedSmallInteger('streak_days')->default(0);
            $table->unsignedSmallInteger('streak_best')->default(0);
            $table->date('streak_on')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['streak_days', 'streak_best', 'streak_on']);
        });
    }
};
