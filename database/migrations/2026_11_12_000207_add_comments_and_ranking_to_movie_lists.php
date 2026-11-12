<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Добірки кіно: режим «рейтинг» (нумерований топ) і коментарі. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('movie_lists', function (Blueprint $table) {
            $table->boolean('is_ranked')->default(false)->after('is_public');
            $table->unsignedInteger('comments_count')->default(0)->after('followers_count');
        });

        Schema::create('movie_list_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('movie_list_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('body');
            $table->timestamps();
            $table->index(['movie_list_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('movie_list_comments');
        Schema::table('movie_lists', function (Blueprint $table) {
            $table->dropColumn(['is_ranked', 'comments_count']);
        });
    }
};
