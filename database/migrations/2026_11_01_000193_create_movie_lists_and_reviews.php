<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Добірки фільмів від людей: «Найкращі хорори», «На вечір з друзями»; лайки й стеження.
        Schema::create('movie_lists', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title', 80);
            $table->string('description', 500)->nullable();
            $table->boolean('is_public')->default(true);
            $table->unsignedInteger('items_count')->default(0);
            $table->unsignedInteger('likes_count')->default(0);
            $table->unsignedInteger('followers_count')->default(0);
            $table->timestamps();
            $table->index(['is_public', 'likes_count']);
            $table->index(['user_id', 'updated_at']);
        });
        Schema::create('movie_list_items', function (Blueprint $table) {
            $table->foreignId('movie_list_id')->constrained()->cascadeOnDelete();
            $table->foreignId('movie_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('position')->default(0);
            $table->string('note', 200)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->primary(['movie_list_id', 'movie_id']);
        });
        Schema::create('movie_list_likes', function (Blueprint $table) {
            $table->foreignId('movie_list_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->primary(['movie_list_id', 'user_id']);
        });
        Schema::create('movie_list_follows', function (Blueprint $table) {
            $table->foreignId('movie_list_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->nullable();
            $table->primary(['movie_list_id', 'user_id']);
        });

        // Рецензії на фільми й серіали: оцінка, текст, позначка «спойлер».
        Schema::create('movie_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('movie_id')->constrained()->cascadeOnDelete();
            $table->text('body');
            $table->unsignedTinyInteger('score');
            $table->boolean('spoiler')->default(false);
            $table->unsignedInteger('likes_count')->default(0);
            $table->timestamps();
            $table->unique(['user_id', 'movie_id']);
            $table->index(['movie_id', 'likes_count']);
            $table->index('created_at');
        });
        Schema::create('movie_review_likes', function (Blueprint $table) {
            $table->foreignId('movie_review_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->primary(['movie_review_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('movie_review_likes');
        Schema::dropIfExists('movie_reviews');
        Schema::dropIfExists('movie_list_follows');
        Schema::dropIfExists('movie_list_likes');
        Schema::dropIfExists('movie_list_items');
        Schema::dropIfExists('movie_lists');
    }
};
