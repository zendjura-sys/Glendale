<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Бэклог ігор: «хочу — граю — пройшов — кинув». Одна гра — один стан у людини.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('game_backlog', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('game_id')->constrained()->cascadeOnDelete();
            $table->string('status', 10);
            $table->timestamps();
            $table->primary(['user_id', 'game_id']);
            $table->index(['user_id', 'status', 'updated_at']);
            $table->index(['game_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('game_backlog');
    }
};
