<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Історія ціни гри: найкраща пропозиція за день (CheapShark, долари США). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('game_price_points', function (Blueprint $table) {
            $table->foreignId('game_id')->constrained()->cascadeOnDelete();
            $table->date('day');
            $table->decimal('price', 8, 2);
            $table->decimal('retail', 8, 2)->nullable();
            $table->string('store', 40)->nullable();
            $table->primary(['game_id', 'day']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('game_price_points');
    }
};
