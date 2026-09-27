<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Офіційний сайт проєкту — звідти сервер підтягує логотип для довідника
 * (php artisan projects:fetch-logos, запускається при деплої).
 */
return new class extends Migration
{
    private const SITES = [
        'Arizona Online' => 'https://arzgames.online',
        'Online UA' => 'https://ua-online.games',
        'Verba Online' => 'https://verba.online',
        'Quant RP' => 'https://quant5.com.ua',
        'Nexus RP' => 'https://nexus-rp.net',
    ];

    public function up(): void
    {
        Schema::table('game_projects', function (Blueprint $table) {
            $table->string('website', 190)->nullable()->after('logo_path');
        });

        foreach (self::SITES as $name => $url) {
            DB::table('game_projects')->where('name', $name)->whereNull('website')->update(['website' => $url]);
        }
    }

    public function down(): void
    {
        Schema::table('game_projects', function (Blueprint $table) {
            $table->dropColumn('website');
        });
    }
};
