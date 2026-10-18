<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Коли провайдер перестав віддавати озвучку. Озвучка не зникає одразу: її прибирає лише повне оновлення,
 * якщо провайдер не повертав її MovieSource::RETIRE_DAYS днів поспіль.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('movie_sources', function (Blueprint $table) {
            $table->timestamp('missing_since')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('movie_sources', function (Blueprint $table) {
            $table->dropColumn('missing_since');
        });
    }
};
