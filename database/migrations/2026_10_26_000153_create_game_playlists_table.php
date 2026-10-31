<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * «Музика гри»: публічні плейлисти, які гравці прив’язали до сторінки гри («Музика з GTA», «під рейд»).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('game_playlists', function (Blueprint $table) {
            $table->foreignId('game_id')->constrained()->cascadeOnDelete();
            $table->foreignId('playlist_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->nullable();
            $table->primary(['game_id', 'playlist_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('game_playlists');
    }
};
