<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Оцінки й обговорення окремих серій (№271). Без спойлерів: коментарі до серії, яку людина
 * ще не відмітила переглянутою, приховано, доки сама не відкриє.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('episode_ratings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('movie_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('season');
            $table->unsignedSmallInteger('episode');
            $table->unsignedTinyInteger('score');
            $table->timestamps();
            $table->unique(['movie_id', 'season', 'episode', 'user_id'], 'episode_ratings_unique');
        });
        Schema::create('episode_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('movie_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('season');
            $table->unsignedSmallInteger('episode');
            $table->text('body');
            $table->timestamps();
            $table->index(['movie_id', 'season', 'episode']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('episode_comments');
        Schema::dropIfExists('episode_ratings');
    }
};
