<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Мова сервера: каталог за замовчуванням показує сервери мовою інтерфейсу людини.
        Schema::table('gta_servers', function (Blueprint $table) {
            $table->string('language', 8)->default('uk')->index();
        });
    }

    public function down(): void
    {
        Schema::table('gta_servers', function (Blueprint $table) {
            $table->dropIndex(['language']);
            $table->dropColumn('language');
        });
    }
};
