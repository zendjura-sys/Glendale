<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Пошук озвучок Kodik тепер іде за всіма ID (Кінопошук, Shikimori, IMDb): плеєри, оновлені до цього
 * оновлення, перечитуються при першому відкритті тайтлу (RefreshMoviePlayers::due).
 */
return new class extends Migration
{
    public function up(): void
    {
        $now = now();
        // Пишемо напряму: під час міграцій кеш (Redis) може бути ще недоступний.
        DB::table('site_settings')->updateOrInsert(
            ['key' => 'cinema_players_refetch_at'],
            ['value' => json_encode($now->toIso8601String()), 'updated_at' => $now, 'created_at' => $now],
        );
        try {
            Cache::forget('site.settings'); // SiteSettings::CACHE_KEY
        } catch (Throwable) {
            // Кеш налаштувань оновиться сам.
        }
    }

    public function down(): void {}
};
