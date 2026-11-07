<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Огляди гравців на сторінці гри: оцінка, «раджу / не раджу», години в грі, «корисно».
        Schema::create('game_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('game_id')->constrained()->cascadeOnDelete();
            $table->text('body');
            $table->unsignedTinyInteger('score');
            $table->boolean('recommended')->default(true);
            $table->unsignedSmallInteger('hours')->nullable();
            $table->unsignedInteger('helpful_count')->default(0);
            $table->timestamps();
            $table->unique(['user_id', 'game_id']);
            $table->index(['game_id', 'helpful_count']);
        });
        Schema::create('game_review_votes', function (Blueprint $table) {
            $table->foreignId('game_review_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->primary(['game_review_id', 'user_id']);
        });

        // «Гравець місяця» в клані: голос кожного учасника раз на місяць.
        Schema::create('clan_mvp_votes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clan_id')->constrained()->cascadeOnDelete();
            $table->char('month', 7);
            $table->foreignId('voter_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['clan_id', 'month', 'voter_id']);
            $table->index(['clan_id', 'month', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clan_mvp_votes');
        Schema::dropIfExists('game_review_votes');
        Schema::dropIfExists('game_reviews');
    }
};
