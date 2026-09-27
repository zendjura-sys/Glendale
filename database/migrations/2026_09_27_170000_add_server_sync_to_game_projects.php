<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Автозаповнення серверів: для проєктів на RAGE MP (GTA V) список серверів,
 * їхні адреси й онлайн береться з публічного майстер-списку RAGE MP
 * (php artisan projects:sync-servers, щодесять хвилин за розкладом).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('game_projects', function (Blueprint $table) {
            $table->string('servers_source', 20)->nullable()->after('website'); // null | ragemp
            $table->timestamp('servers_synced_at')->nullable()->after('servers_source');
        });
        Schema::table('game_servers', function (Blueprint $table) {
            $table->string('address', 80)->nullable()->after('name');
            $table->unsignedInteger('players')->nullable()->after('address');
            $table->unsignedInteger('max_players')->nullable()->after('players');
            $table->timestamp('synced_at')->nullable()->after('max_players');
        });

        DB::table('game_projects')->whereIn('name', ['Quant RP', 'Nexus RP'])->update(['servers_source' => 'ragemp']);
    }

    public function down(): void
    {
        Schema::table('game_servers', function (Blueprint $table) {
            $table->dropColumn(['address', 'players', 'max_players', 'synced_at']);
        });
        Schema::table('game_projects', function (Blueprint $table) {
            $table->dropColumn(['servers_source', 'servers_synced_at']);
        });
    }
};
