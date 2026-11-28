<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Прогнози на матчі турнірів (№260): хто переможе. Очки рахуються з результатів матчів
 * (без грошей і без ставок): 10 за кожен влучний прогноз.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tournament_predictions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tournament_match_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tournament_entry_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['tournament_match_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tournament_predictions');
    }
};
