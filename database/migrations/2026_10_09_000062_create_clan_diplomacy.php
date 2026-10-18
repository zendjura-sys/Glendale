<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clan_alliances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clan_id')->constrained('clans')->cascadeOnDelete();
            $table->foreignId('ally_id')->constrained('clans')->cascadeOnDelete();
            $table->string('status', 16)->default('pending');
            $table->timestamps();
            $table->unique(['clan_id', 'ally_id']);
        });

        Schema::create('clan_matches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clan_id')->constrained('clans')->cascadeOnDelete();
            $table->foreignId('opponent_id')->constrained('clans')->cascadeOnDelete();
            $table->timestamp('starts_at');
            $table->unsignedSmallInteger('score_home')->nullable();
            $table->unsignedSmallInteger('score_away')->nullable();
            $table->string('note', 200)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clan_matches');
        Schema::dropIfExists('clan_alliances');
    }
};
