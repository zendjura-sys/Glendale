<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Тір-листи: рівні S…D з довільними пунктами (герої, зброя, карти, ігри).
        Schema::create('tier_lists', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('game_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title', 100);
            $table->json('tiers');
            $table->boolean('is_public')->default(true);
            $table->unsignedInteger('views_count')->default(0);
            $table->timestamps();
            $table->index(['game_id', 'is_public']);
        });

        // Питання й відповіді гравців на сторінці гри.
        Schema::create('game_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('game_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title', 160);
            $table->text('body')->nullable();
            $table->unsignedInteger('answers_count')->default(0);
            $table->unsignedBigInteger('solved_answer_id')->nullable();
            $table->timestamps();
        });
        Schema::create('game_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('question_id')->constrained('game_questions')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('body');
            $table->unsignedInteger('votes_count')->default(0);
            $table->timestamps();
        });
        Schema::create('game_answer_votes', function (Blueprint $table) {
            $table->foreignId('answer_id')->constrained('game_answers')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->primary(['answer_id', 'user_id']);
        });

        // Наставники: досвідчені гравці, яким можна написати по допомогу в грі.
        Schema::create('game_mentors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('game_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('about', 300);
            $table->unsignedInteger('helped_count')->default(0);
            $table->timestamps();
            $table->unique(['game_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('game_mentors');
        Schema::dropIfExists('game_answer_votes');
        Schema::dropIfExists('game_answers');
        Schema::dropIfExists('game_questions');
        Schema::dropIfExists('tier_lists');
    }
};
