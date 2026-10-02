<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('push_devices', function (Blueprint $table) {
            // Застосунок сам малює сповіщення чатів (з відповіддю з шторки) — йому шлемо лише data.
            $table->boolean('local_render')->default(false)->after('platform');
        });
    }

    public function down(): void
    {
        Schema::table('push_devices', function (Blueprint $table) {
            $table->dropColumn('local_render');
        });
    }
};
