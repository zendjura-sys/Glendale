<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Моменти: кліпи з YouTube, Twitch і Medal за посиланням.
        Schema::create('moments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('game_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('gta_server_id')->nullable()->constrained()->nullOnDelete();
            $table->string('provider', 12);
            $table->string('external_id', 120);
            $table->string('url', 500);
            $table->string('embed_url', 500)->nullable();
            $table->string('title', 140);
            $table->string('thumbnail', 500)->nullable();
            $table->unsignedInteger('likes_count')->default(0);
            $table->timestamps();
            $table->unique(['provider', 'external_id']);
            $table->index(['created_at']);
            $table->index(['game_id', 'created_at']);
        });

        Schema::create('moment_likes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('moment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->nullable();
            $table->unique(['moment_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('moment_likes');
        Schema::dropIfExists('moments');
    }
};
