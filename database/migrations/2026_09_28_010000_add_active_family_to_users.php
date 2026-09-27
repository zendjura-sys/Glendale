<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Активна родина людини (перемикач «Моя родина» в меню): у якій родині
 * зараз відкриваються її звіти, банк, цілі… Зберігається в профілі, а не
 * в сесії — однаково на сайті, в соцмережі (API) і в застосунку.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedBigInteger('active_family_id')->nullable()->after('position_key');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('active_family_id');
        });
    }
};
