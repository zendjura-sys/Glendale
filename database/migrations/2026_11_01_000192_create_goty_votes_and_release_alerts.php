<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // «Гра року» спільноти: один голос людини в кожній номінації за рік.
        Schema::create('goty_votes', function (Blueprint $table) {
            $table->id();
            $table->unsignedSmallInteger('year');
            $table->string('category', 24);
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('game_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['year', 'category', 'user_id']);
            $table->index(['year', 'category', 'game_id']);
        });

        // Сповіщення в день виходу гри зі списку бажаного — один раз.
        Schema::table('game_wishlists', function (Blueprint $table) {
            $table->timestamp('release_notified_at')->nullable()->after('notified_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('goty_votes');
        Schema::table('game_wishlists', function (Blueprint $table) {
            $table->dropColumn('release_notified_at');
        });
    }
};
