<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Календар нагород за щоденний вхід: одна відмітка на день, цикл — календарний місяць. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('login_rewards', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->char('month', 7);
            $table->unsignedTinyInteger('day');
            $table->date('claimed_on');
            $table->string('reward', 40);
            $table->timestamp('created_at')->nullable();
            $table->unique(['user_id', 'claimed_on']);
            $table->unique(['user_id', 'month', 'day']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('login_rewards');
    }
};
