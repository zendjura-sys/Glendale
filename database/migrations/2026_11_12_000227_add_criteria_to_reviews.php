<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Оцінки за критеріями в оглядах ігор і рецензіях кіно: сюжет, графіка/візуал, звук, геймплей/акторська гра (1–10). */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['game_reviews', 'movie_reviews'] as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->json('criteria')->nullable();
            });
        }
    }

    public function down(): void
    {
        foreach (['game_reviews', 'movie_reviews'] as $name) {
            Schema::table($name, fn (Blueprint $table) => $table->dropColumn('criteria'));
        }
    }
};
