<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Пошук озвучок Kodik тепер добирає ID з відповідей Kodik (Shikimori, IMDb) — плеєри перечитуються
 * ще раз при першому відкритті тайтлу (RefreshMoviePlayers::due).
 */
return new class extends Migration
{
    public function up(): void
    {
        $now = now();
        DB::table('site_settings')->updateOrInsert(
            ['key' => 'cinema_players_refetch_at'],
            ['value' => json_encode($now->toIso8601String()), 'updated_at' => $now, 'created_at' => $now],
        );
        try {
            Cache::forget('site.settings'); // SiteSettings::CACHE_KEY
        } catch (Throwable) {
        }
    }

    public function down(): void {}
};
