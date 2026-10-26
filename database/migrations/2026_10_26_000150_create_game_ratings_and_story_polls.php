<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Оцінки ігор від гравців GameCon (1–10, лише хто грав) і опитування в історіях.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('game_ratings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('game_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('score');
            $table->timestamps();
            $table->unique(['user_id', 'game_id']);
            $table->index('game_id');
        });

        Schema::table('stories', function (Blueprint $table) {
            $table->json('poll')->nullable()->after('caption');
        });

        Schema::create('story_poll_votes', function (Blueprint $table) {
            $table->foreignId('story_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('choice');
            $table->timestamp('created_at')->nullable();
            $table->primary(['story_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('story_poll_votes');
        Schema::table('stories', function (Blueprint $table) {
            $table->dropColumn('poll');
        });
        Schema::dropIfExists('game_ratings');
    }
};
