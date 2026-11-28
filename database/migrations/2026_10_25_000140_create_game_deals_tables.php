<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Роздачі безкоштовних ігор (Epic, Steam, GOG — дані GamerPower) і список бажаного
 * зі сповіщенням про знижку.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('game_giveaways', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('external_id')->unique();
            $table->string('title', 200);
            $table->string('store', 16);
            $table->string('worth', 20)->nullable();
            $table->string('image', 500)->nullable();
            $table->text('description')->nullable();
            $table->string('url', 500);
            $table->foreignId('game_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('active')->default(true);
            $table->timestamp('published_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->timestamps();
            $table->index(['active', 'ends_at']);
        });

        Schema::create('game_wishlists', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('game_id')->constrained()->cascadeOnDelete();
            $table->decimal('target_price', 8, 2)->nullable();
            $table->decimal('notified_price', 8, 2)->nullable();
            $table->timestamp('notified_at')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'game_id']);
            $table->index('game_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('game_wishlists');
        Schema::dropIfExists('game_giveaways');
    }
};
