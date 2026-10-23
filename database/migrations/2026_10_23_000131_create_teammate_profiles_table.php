<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Підбір тиммейтів: анкета гравця (ігри, мови, час гри, рівень, мікрофон) і «Шукаю зараз».
 * У підборі бачать лише тих, хто заповнив анкету й не сховав її.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('teammate_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->json('games')->nullable();
            $table->json('languages')->nullable();
            $table->json('times')->nullable();
            $table->string('skill', 12)->nullable();
            $table->string('platform', 12)->nullable();
            $table->boolean('mic')->default(false);
            $table->string('note', 140)->nullable();
            $table->boolean('visible')->default(true);
            $table->timestamp('looking_until')->nullable();
            $table->timestamps();
            $table->index(['visible', 'looking_until']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('teammate_profiles');
    }
};
