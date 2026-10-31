<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Історія для «Підсумків року»: що людина слухала (свої треки й Spotify) і в які дні грала в гру
 * чи на сервері. До цього зберігався лише поточний трек і сам факт «грав колись».
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('music_plays', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // Свій трек GameCon; для Spotify — null, назва й виконавець нижче.
            $table->foreignId('track_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title', 200);
            $table->string('artist', 200)->default('');
            // Обкладинка Spotify (лише перевірені адреси scdn.co); у своїх треків — із самого треку.
            $table->string('cover_url', 500)->nullable();
            $table->timestamp('played_at');
            $table->index(['user_id', 'played_at']);
        });

        Schema::create('play_days', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // game або server (PlayedPlace::GAME / PlayedPlace::SERVER).
            $table->string('kind', 10);
            $table->unsignedBigInteger('subject_id');
            $table->date('day');
            $table->primary(['user_id', 'kind', 'subject_id', 'day']);
            $table->index(['user_id', 'day']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('play_days');
        Schema::dropIfExists('music_plays');
    }
};
