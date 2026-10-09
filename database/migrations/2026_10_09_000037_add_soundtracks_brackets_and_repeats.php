<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('movie_soundtracks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('movie_id')->constrained()->cascadeOnDelete();
            $table->foreignId('track_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();
            $table->unique(['movie_id', 'track_id']);
        });

        Schema::table('clan_events', function (Blueprint $table) {
            $table->json('bracket')->nullable();
            $table->string('repeat', 16)->nullable();
            $table->timestamp('spawned_at')->nullable();
        });

        Schema::table('family_events', function (Blueprint $table) {
            $table->string('repeat', 16)->nullable();
            $table->timestamp('spawned_at')->nullable();
        });

        Schema::table('server_events', function (Blueprint $table) {
            $table->string('repeat', 16)->nullable();
            $table->timestamp('spawned_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('server_events', function (Blueprint $table) {
            $table->dropColumn(['repeat', 'spawned_at']);
        });
        Schema::table('family_events', function (Blueprint $table) {
            $table->dropColumn(['repeat', 'spawned_at']);
        });
        Schema::table('clan_events', function (Blueprint $table) {
            $table->dropColumn(['bracket', 'repeat', 'spawned_at']);
        });
        Schema::dropIfExists('movie_soundtracks');
    }
};
