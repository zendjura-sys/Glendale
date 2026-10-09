<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // IGDB — основне джерело каталогу: режими гри для фільтрів, альтернативні назви для пошуку
        // й повна картка гри (опис, скриншоти, трейлери, розробники, рейтинги, мультиплеєр тощо).
        Schema::table('games', function (Blueprint $table) {
            $table->unsignedBigInteger('igdb_id')->nullable()->unique()->after('rawg_id');
            $table->json('modes')->nullable()->after('genres');
            $table->text('aliases')->nullable()->after('name');
            $table->json('details')->nullable()->after('links');
        });
    }

    public function down(): void
    {
        Schema::table('games', function (Blueprint $table) {
            $table->dropUnique(['igdb_id']);
            $table->dropColumn(['igdb_id', 'modes', 'aliases', 'details']);
        });
    }
};
