<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Shikimori id — для аніме й дорам Kodik шукає плеєр точніше за ним, ніж
 * за назвою/роком (TMDB часто не має точного відповідника чи IMDb id для
 * азійського контенту). Поле — лише для адмінки (App\Http\Controllers\
 * Admin\CinemaAdminController), на публічних сторінках кінопорталу не
 * показується.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cinema_titles', function (Blueprint $t) {
            $t->unsignedInteger('shikimori_id')->nullable()->after('tmdb_id')->index();
        });
    }

    public function down(): void
    {
        Schema::table('cinema_titles', function (Blueprint $t) {
            $t->dropColumn('shikimori_id');
        });
    }
};
