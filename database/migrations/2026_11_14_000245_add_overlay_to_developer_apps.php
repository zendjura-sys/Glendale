<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('developer_apps', function (Blueprint $table) {
            // Вигляд оверлею GameCon SDK у грі розробника (колір, логотип, бік «краплі», вкладки…).
            $table->json('overlay')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('developer_apps', function (Blueprint $table) {
            $table->dropColumn('overlay');
        });
    }
};
