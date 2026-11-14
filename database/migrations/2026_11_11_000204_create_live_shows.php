<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Шоу наживо (аудіо): ведучі на сцені, гості з питаннями на таймері, слухачі; формати 1-1, 2-2 і власний.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('live_shows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('host_id')->constrained('users')->cascadeOnDelete();
            $table->string('title', 80);
            $table->string('topic', 30)->nullable();
            // duo — 1-1, double — 2-2, custom — свій склад.
            $table->string('format', 12)->default('duo');
            $table->unsignedTinyInteger('stage_seats')->default(2);
            $table->unsignedTinyInteger('guest_seats')->default(1);
            $table->unsignedSmallInteger('question_seconds')->default(60);
            // scheduled | live | ended
            $table->string('status', 12)->default('live')->index();
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->unsignedInteger('peak_listeners')->default(0);
            $table->timestamps();
        });

        Schema::create('live_show_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('live_show_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // host | speaker | guest | listener
            $table->string('role', 10)->default('listener');
            $table->timestamp('hand_at')->nullable();
            // Гість говорить до цього часу, далі мікрофон забирається.
            $table->timestamp('mic_until')->nullable();
            $table->timestamp('seen_at')->nullable();
            $table->timestamps();
            $table->unique(['live_show_id', 'user_id']);
            $table->index(['live_show_id', 'seen_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('live_show_members');
        Schema::dropIfExists('live_shows');
    }
};
