<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Обговорення: теми й відповіді до будь-чого на GameCon (фільм, серіал, аніме, гра, сервер,
 * сім’я, клан, спільнота, стаття) і загальні теми за категоріями.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('discussions', function (Blueprint $table) {
            $table->id();
            // Предмет обговорення: movie / game / server / family / clan / community / article; null — загальна тема.
            $table->string('subject_type', 24)->nullable();
            $table->unsignedBigInteger('subject_id')->nullable();
            // Категорія загального розділу: general, cinema, series, anime, games, music, tech.
            $table->string('category', 24)->default('general');
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title', 160);
            $table->text('body')->nullable();
            $table->boolean('spoiler')->default(false);
            $table->boolean('is_pinned')->default(false);
            $table->boolean('is_locked')->default(false);
            $table->unsignedInteger('replies_count')->default(0);
            $table->unsignedInteger('likes_count')->default(0);
            $table->unsignedInteger('views_count')->default(0);
            $table->timestamp('last_reply_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['subject_type', 'subject_id', 'last_reply_at']);
            $table->index(['category', 'last_reply_at']);
        });

        Schema::create('discussion_replies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('discussion_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('discussion_replies')->nullOnDelete();
            $table->text('body');
            $table->boolean('spoiler')->default(false);
            $table->unsignedInteger('likes_count')->default(0);
            $table->timestamps();
            $table->softDeletes();
            $table->index(['discussion_id', 'id']);
        });

        Schema::create('discussion_likes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // Вподобайка теми (reply_id = null) чи відповіді.
            $table->foreignId('discussion_id')->constrained()->cascadeOnDelete();
            $table->foreignId('reply_id')->nullable()->constrained('discussion_replies')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['user_id', 'discussion_id', 'reply_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('discussion_likes');
        Schema::dropIfExists('discussion_replies');
        Schema::dropIfExists('discussions');
    }
};
