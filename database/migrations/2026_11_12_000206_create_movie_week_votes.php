<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Кіно: голосування «Тайтл тижня» — один голос на людину за тиждень (ISO-тиждень, напр. 2026-W46).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('movie_week_votes', function (Blueprint $table) {
            $table->id();
            $table->string('week', 10);
            $table->foreignId('movie_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['week', 'user_id']);
            $table->index(['week', 'movie_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('movie_week_votes');
    }
};
