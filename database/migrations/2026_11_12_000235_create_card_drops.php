<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Картки, зароблені переглядом і грою: чекають, поки людина відкриє (можна докласти кристали).
 * ІІ-ранг персонажа — окремо від рангу за популярністю.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('card_drops', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('ref', 80);
            $table->string('source', 12);
            $table->string('title', 160);
            $table->foreignId('movie_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('game_id')->nullable()->constrained()->nullOnDelete();
            $table->string('card_key', 24)->nullable();
            $table->timestamp('opened_at')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'ref']);
            $table->index(['user_id', 'opened_at']);
        });
        Schema::table('card_characters', function (Blueprint $table) {
            $table->string('ai_rank', 4)->nullable()->after('popularity');
            $table->string('ai_reason', 200)->nullable()->after('ai_rank');
            $table->string('manual_rank', 4)->nullable()->after('ai_reason');
        });
    }

    public function down(): void
    {
        Schema::table('card_characters', function (Blueprint $table) {
            $table->dropColumn(['ai_rank', 'ai_reason', 'manual_rank']);
        });
        Schema::dropIfExists('card_drops');
    }
};
