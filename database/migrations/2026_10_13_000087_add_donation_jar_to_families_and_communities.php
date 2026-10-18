<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Банка Monobank для донатів сім’ї чи спільноті (лише сайт). */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['families', 'communities'] as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->string('donation_jar', 200)->nullable();
                $table->string('donation_note', 200)->nullable();
            });
        }
    }

    public function down(): void
    {
        foreach (['families', 'communities'] as $name) {
            Schema::table($name, fn (Blueprint $table) => $table->dropColumn(['donation_jar', 'donation_note']));
        }
    }
};
