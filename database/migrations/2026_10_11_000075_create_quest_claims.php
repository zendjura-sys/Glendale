<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Виконані щоденні завдання: досвід іде в рівень, очки — в сезон (місяць).
        Schema::create('quest_claims', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('quest', 24);
            $table->date('day');
            $table->string('season', 7);
            $table->unsignedSmallInteger('xp');
            $table->timestamp('created_at')->nullable();
            $table->unique(['user_id', 'quest', 'day']);
            $table->index(['season', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quest_claims');
    }
};
