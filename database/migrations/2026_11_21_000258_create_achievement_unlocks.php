<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Коли людина відкрила досягнення — для «Досягнень друзів» у лобі. Бейджі рахуються з активності,
 * тож старі (відкриті до цієї таблиці) записуються «тихо» й у стрічку не потрапляють.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('achievement_unlocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('badge', 40);
            $table->boolean('silent')->default(false);
            $table->timestamp('unlocked_at');
            $table->unique(['user_id', 'badge']);
            $table->index(['silent', 'unlocked_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('achievement_unlocks');
    }
};
