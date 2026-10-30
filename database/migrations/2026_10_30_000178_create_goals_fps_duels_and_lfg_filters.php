<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Фільтри пошуку паті: мікрофон, мова, вік, стиль гри.
        Schema::table('party_posts', function (Blueprint $table) {
            $table->boolean('mic_required')->default(false);
            $table->string('language', 8)->nullable();
            $table->unsignedTinyInteger('age_min')->nullable();
            $table->string('style', 12)->nullable();
        });

        // Особисті цілі в грі (з прогресом).
        Schema::create('game_goals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('game_id')->constrained()->cascadeOnDelete();
            $table->string('title', 120);
            $table->unsignedInteger('target')->nullable();
            $table->unsignedInteger('progress')->default(0);
            $table->timestamp('done_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'game_id']);
        });

        // FPS від спільноти: яка залізяка скільки видає в грі.
        Schema::create('fps_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('game_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('gpu', 80);
            $table->string('cpu', 80)->nullable();
            $table->string('resolution', 12);
            $table->string('preset', 12);
            $table->unsignedSmallInteger('fps');
            $table->timestamps();
            $table->unique(['game_id', 'user_id']);
        });

        // Дуелі між гравцями: виклик → прийняв → обидва вказують переможця.
        Schema::create('duels', function (Blueprint $table) {
            $table->id();
            $table->foreignId('game_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('challenger_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('opponent_id')->constrained('users')->cascadeOnDelete();
            $table->string('terms', 160);
            $table->string('status', 12)->default('pending')->index();
            $table->foreignId('challenger_pick')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('opponent_pick')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('winner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('duels');
        Schema::dropIfExists('fps_reports');
        Schema::dropIfExists('game_goals');
        Schema::table('party_posts', function (Blueprint $table) {
            $table->dropColumn(['mic_required', 'language', 'age_min', 'style']);
        });
    }
};
