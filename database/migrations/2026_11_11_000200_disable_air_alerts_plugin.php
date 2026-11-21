<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

// Мапа тривог доробляється: вимикаємо плагін для всього сайту (увімкнути — Адмінка → Плагіни).
return new class extends Migration
{
    public function up(): void
    {
        $row = DB::table('site_settings')->where('key', 'plugins')->first();
        $plugins = $row ? (array) json_decode((string) $row->value, true) : [];
        $plugins['air_alerts'] = false;
        DB::table('site_settings')->updateOrInsert(['key' => 'plugins'], ['value' => json_encode($plugins), 'updated_at' => now(), 'created_at' => $row->created_at ?? now()]);
        Cache::forget('site.settings');
    }

    public function down(): void
    {
        // Повертати нічого: стан плагіна вирішує адміністратор.
    }
};
