<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** «Підходить для…»: слухачі позначають настрій треку (рейд, катка, чіл…) — з цього збираються плейлисти під настрій. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('track_moods', function (Blueprint $table) {
            $table->id();
            $table->foreignId('track_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('mood', 12);
            $table->timestamp('created_at')->nullable();
            $table->unique(['track_id', 'user_id', 'mood']);
            $table->index(['mood', 'track_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('track_moods');
    }
};
