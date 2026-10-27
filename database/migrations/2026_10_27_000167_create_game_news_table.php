<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Новини й патчноути ігор зі Steam (ISteamNews): gid — ідентифікатор новини в Steam.
        Schema::create('game_news', function (Blueprint $table) {
            $table->id();
            $table->foreignId('game_id')->constrained()->cascadeOnDelete();
            $table->string('gid', 40)->unique();
            $table->string('title', 255);
            $table->string('url', 500);
            $table->text('excerpt')->nullable();
            $table->boolean('is_patch')->default(false);
            $table->timestamp('published_at')->index();
            $table->timestamps();
            $table->index(['game_id', 'published_at']);
        });

        Schema::table('games', function (Blueprint $table) {
            $table->timestamp('news_checked_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('games', function (Blueprint $table) {
            $table->dropColumn('news_checked_at');
        });
        Schema::dropIfExists('game_news');
    }
};
