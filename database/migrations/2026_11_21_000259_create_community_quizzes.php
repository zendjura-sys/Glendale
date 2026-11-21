<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Живі вікторини спільнот (№225): ведучий запускає питання, учасники відповідають на час,
 * бали — за правильність і швидкість, таблиця лідерів наприкінці.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('community_quizzes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('community_id')->constrained()->cascadeOnDelete();
            $table->foreignId('host_id')->constrained('users')->cascadeOnDelete();
            $table->string('title', 120);
            $table->json('questions');
            $table->unsignedTinyInteger('seconds')->default(20);
            // draft → question → reveal → (наступне питання) … → done
            $table->string('phase', 16)->default('draft');
            $table->unsignedTinyInteger('current')->default(0);
            $table->timestamp('phase_at')->nullable();
            $table->timestamps();
            $table->index(['community_id', 'phase']);
        });
        Schema::create('community_quiz_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('community_quiz_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('question');
            $table->unsignedTinyInteger('choice');
            $table->unsignedSmallInteger('points')->default(0);
            $table->timestamps();
            $table->unique(['community_quiz_id', 'user_id', 'question'], 'cq_answer_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('community_quiz_answers');
        Schema::dropIfExists('community_quizzes');
    }
};
