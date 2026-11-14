<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** GameCon SDK: досягнення й таблиці лідерів ігор розробників. */
    public function up(): void
    {
        Schema::create('developer_achievements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('developer_app_id')->constrained()->cascadeOnDelete();
            $table->string('key', 64);
            $table->string('title', 120);
            $table->string('description', 300)->nullable();
            $table->string('icon_url', 500)->nullable();
            $table->unsignedSmallInteger('points')->default(10);
            $table->boolean('hidden')->default(false);
            // Лише з сервера гри (за секретом застосунку) — клієнт не може відкрити сам.
            $table->boolean('server_only')->default(false);
            $table->timestamps();
            $table->unique(['developer_app_id', 'key']);
        });
        Schema::create('developer_user_achievements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('developer_achievement_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->boolean('verified')->default(false);
            $table->timestamp('unlocked_at');
            $table->unique(['developer_achievement_id', 'user_id']);
            $table->index(['user_id', 'unlocked_at']);
        });
        Schema::create('developer_scores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('developer_app_id')->constrained()->cascadeOnDelete();
            $table->string('board', 64);
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->bigInteger('score');
            $table->boolean('verified')->default(false);
            $table->timestamps();
            $table->unique(['developer_app_id', 'board', 'user_id']);
            $table->index(['developer_app_id', 'board', 'score']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('developer_scores');
        Schema::dropIfExists('developer_user_achievements');
        Schema::dropIfExists('developer_achievements');
    }
};
