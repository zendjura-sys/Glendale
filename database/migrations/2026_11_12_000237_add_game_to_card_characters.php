<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Персонажі ігор для колекційних карток (не лише кіно й аніме). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('card_characters', function (Blueprint $table) {
            $table->foreignId('movie_id')->nullable()->change();
            $table->foreignId('game_id')->nullable()->after('movie_id')->constrained()->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('card_characters', function (Blueprint $table) {
            $table->dropConstrainedForeignId('game_id');
        });
    }
};
