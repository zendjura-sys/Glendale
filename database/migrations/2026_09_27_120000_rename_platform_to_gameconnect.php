<?php

use App\Models\Setting;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

/**
 * Платформа перейменована: GameConnect (коротко GameCon, домен
 * gamecon.online). Monsory лишається назвою родини, а не сайту, тож
 * назву сайту з адмінки (Дизайн) міняємо лише якщо там досі Monsory.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('settings')) {
            return;
        }

        $current = (string) Setting::get('site_name');
        if ($current === '' || stripos($current, 'monsory') !== false) {
            Setting::set('site_name', 'GameConnect', 'general');
        }
    }

    public function down(): void
    {
        // Назву сайту повертають в адмінці (Дизайн), не відкатом міграції.
    }
};
