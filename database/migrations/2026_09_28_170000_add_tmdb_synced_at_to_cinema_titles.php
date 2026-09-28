<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Коли тайтл востаннє перечитували з TMDB (cinema:auto-import, для
 * серіалів, що ще тривають). Окрема колонка, а не updated_at: той
 * зачіпають і інші проходи цієї ж команди (наприклад, пошук плеєра
 * торкає created_at/updated_at при save()) — переплутати їх означало б,
 * що оновлення метаданих ніколи не спрацьовує для тайтлу, який щойно
 * зачепив якийсь інший, не пов'язаний прохід.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cinema_titles', function (Blueprint $table) {
            $table->timestamp('tmdb_synced_at')->nullable()->after('flixcdn_checked_at');
        });
    }

    public function down(): void
    {
        Schema::table('cinema_titles', function (Blueprint $table) {
            $table->dropColumn('tmdb_synced_at');
        });
    }
};
