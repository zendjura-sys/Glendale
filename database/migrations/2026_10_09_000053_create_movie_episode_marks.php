<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('movie_episode_marks', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('movie_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('season');
            $table->unsignedSmallInteger('episode');
            $table->primary(['user_id', 'movie_id', 'season', 'episode']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('movie_episode_marks');
    }
};
