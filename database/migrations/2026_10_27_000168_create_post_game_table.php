<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Записи з #згадкою гри (#cs2, #dota-2): для стрічки «Записи про гру» на її сторінці.
        Schema::create('post_game', function (Blueprint $table) {
            $table->foreignId('post_id')->constrained()->cascadeOnDelete();
            $table->foreignId('game_id')->constrained()->cascadeOnDelete();
            $table->primary(['post_id', 'game_id']);
            $table->index('game_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('post_game');
    }
};
