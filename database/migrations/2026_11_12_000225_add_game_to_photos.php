<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Скриншоти за іграми: гра в альбому (нові фото її успадковують) і в окремого фото. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('photo_albums', function (Blueprint $table) {
            $table->foreignId('game_id')->nullable()->constrained()->nullOnDelete();
        });
        Schema::table('photos', function (Blueprint $table) {
            $table->foreignId('game_id')->nullable()->constrained()->nullOnDelete();
            $table->index(['game_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::table('photos', function (Blueprint $table) {
            $table->dropConstrainedForeignId('game_id');
        });
        Schema::table('photo_albums', function (Blueprint $table) {
            $table->dropConstrainedForeignId('game_id');
        });
    }
};
