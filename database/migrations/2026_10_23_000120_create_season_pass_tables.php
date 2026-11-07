<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Сезонний пропуск: тема, очки за рівні й нагороди місяця (задає адміністратор).
        Schema::create('seasons', function (Blueprint $table) {
            $table->id();
            $table->string('key', 7)->unique();
            $table->string('title', 80);
            $table->string('theme', 24)->default('neon');
            $table->json('levels')->nullable();
            $table->json('rewards')->nullable();
            $table->timestamps();
        });

        // Отримані нагороди: одна на рівень і доріжку.
        Schema::create('season_pass_claims', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('season', 7);
            $table->unsignedTinyInteger('level');
            $table->string('track', 8);
            $table->string('type', 16);
            $table->string('value', 64);
            $table->unsignedSmallInteger('xp')->default(0);
            $table->timestamp('created_at')->nullable();
            $table->unique(['user_id', 'season', 'level', 'track']);
        });

        // Інвентар косметики людини.
        Schema::create('user_cosmetics', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type', 16);
            $table->string('value', 64);
            $table->string('source', 32)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->unique(['user_id', 'type', 'value']);
        });

        // Вдягнута косметика: {frame, name, badge, header} → ключі з інвентаря.
        Schema::table('users', function (Blueprint $table) {
            $table->json('cosmetics')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('cosmetics');
        });
        Schema::dropIfExists('user_cosmetics');
        Schema::dropIfExists('season_pass_claims');
        Schema::dropIfExists('seasons');
    }
};
