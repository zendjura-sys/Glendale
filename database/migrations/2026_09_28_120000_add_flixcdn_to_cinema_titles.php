<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * FlixCDN (uacdn.live) — другий балансер плеєрів, працює паралельно з
 * Kodik: окремі колонки, щоб втрата чи відмова одного джерела не чіпала
 * інше. CinemaPresenter об'єднує обидва в один список озвучок на сторінці
 * фільму (App\Cinema\PlayerSources).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cinema_titles', function (Blueprint $t) {
            $t->string('flixcdn_link')->nullable()->after('kodik_checked_at');
            $t->json('flixcdn_translations')->nullable()->after('flixcdn_link');
            $t->timestamp('flixcdn_checked_at')->nullable()->after('flixcdn_translations');
        });
    }

    public function down(): void
    {
        Schema::table('cinema_titles', function (Blueprint $t) {
            $t->dropColumn(['flixcdn_link', 'flixcdn_translations', 'flixcdn_checked_at']);
        });
    }
};
