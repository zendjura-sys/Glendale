<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Результати міні-ігор: щоденна вікторина й музичний квіз (найкращий за день).
        Schema::create('game_scores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 20);
            $table->date('day');
            $table->unsignedSmallInteger('score');
            $table->unsignedSmallInteger('total');
            $table->timestamps();
            $table->unique(['user_id', 'kind', 'day']);
            $table->index(['kind', 'day', 'score']);
        });

        // Ігровий щоденник: нотатки про проходження, настрій і час у грі.
        Schema::create('game_journal_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('game_id')->nullable()->constrained()->nullOnDelete();
            $table->text('body');
            $table->string('mood', 10)->default('good');
            $table->unsignedSmallInteger('minutes')->nullable();
            $table->date('played_on');
            $table->boolean('is_public')->default(false);
            $table->timestamps();
            $table->index(['user_id', 'played_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('game_journal_entries');
        Schema::dropIfExists('game_scores');
    }
};
