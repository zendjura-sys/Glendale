<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Застосунок уміє сам малювати тривогу з кнопкою «Я в укритті» (з 1.1.125); старим — звичайний пуш. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('push_devices', function (Blueprint $table) {
            $table->boolean('alert_render')->default(false)->after('local_render');
        });
    }

    public function down(): void
    {
        Schema::table('push_devices', function (Blueprint $table) {
            $table->dropColumn('alert_render');
        });
    }
};
