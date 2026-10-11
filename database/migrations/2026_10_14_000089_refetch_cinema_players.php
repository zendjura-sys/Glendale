<?php

use App\Support\Settings\SiteSettings;
use Illuminate\Database\Migrations\Migration;

/**
 * Пошук озвучок Kodik тепер іде за всіма ID (Кінопошук, Shikimori, IMDb): плеєри, оновлені до цього
 * оновлення, перечитуються при першому відкритті тайтлу (RefreshMoviePlayers::due).
 */
return new class extends Migration
{
    public function up(): void
    {
        app(SiteSettings::class)->put(['cinema_players_refetch_at' => now()->toIso8601String()]);
    }

    public function down(): void {}
};
