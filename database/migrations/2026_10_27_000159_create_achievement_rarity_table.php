<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Рідкість бейджів: скільки активних людей має кожен бейдж («є у 2% людей»).
 * Перераховується щоночі командою achievements:rarity.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('achievement_rarity', function (Blueprint $table) {
            $table->string('badge', 40)->primary();
            $table->unsignedInteger('holders');
            $table->unsignedInteger('total');
            $table->timestamp('updated_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('achievement_rarity');
    }
};
