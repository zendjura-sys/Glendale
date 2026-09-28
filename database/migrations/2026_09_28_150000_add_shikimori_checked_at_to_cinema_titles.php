<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Throttle-мітка для App\Cinema\Shikimori::attach — не частіше ніж раз на добу на тайтл. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cinema_titles', function (Blueprint $t) {
            $t->timestamp('shikimori_checked_at')->nullable()->after('shikimori_id');
        });
    }

    public function down(): void
    {
        Schema::table('cinema_titles', function (Blueprint $t) {
            $t->dropColumn('shikimori_checked_at');
        });
    }
};
