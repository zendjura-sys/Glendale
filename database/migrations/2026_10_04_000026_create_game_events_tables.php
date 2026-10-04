<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Події ігор: шоукейси й трансляції (IGDB), виходи ігор, офіційні події від GameCon.
        Schema::create('game_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title', 160);
            $table->string('type', 20);
            $table->string('description', 1000)->nullable();
            $table->timestamp('starts_at');
            $table->timestamp('ends_at')->nullable();
            $table->boolean('all_day')->default(false);
            $table->string('url', 500)->nullable();
            $table->string('image', 500)->nullable();
            $table->string('source', 16)->default('manual');
            $table->string('external_id', 64)->nullable();
            $table->timestamp('reminded_at')->nullable();
            $table->timestamps();
            $table->unique(['source', 'external_id']);
            $table->index('starts_at');
        });

        Schema::create('game_event_game', function (Blueprint $table) {
            $table->foreignId('game_event_id')->constrained()->cascadeOnDelete();
            $table->foreignId('game_id')->constrained()->cascadeOnDelete();
            $table->primary(['game_event_id', 'game_id']);
        });

        Schema::create('game_event_rsvps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('game_event_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('status', 10);
            $table->unique(['game_event_id', 'user_id']);
        });

        // Події серверів, підтягнуті із запланованих подій Discord-сервера проєкту.
        Schema::table('server_events', function (Blueprint $table) {
            $table->string('source', 16)->default('manual');
            $table->string('external_id', 64)->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->string('url', 500)->nullable();
            $table->unique(['source', 'external_id']);
        });
        Schema::table('gta_servers', function (Blueprint $table) {
            $table->string('discord_guild_id', 24)->nullable();
            $table->timestamp('discord_events_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('gta_servers', fn (Blueprint $table) => $table->dropColumn(['discord_guild_id', 'discord_events_at']));
        Schema::table('server_events', function (Blueprint $table) {
            $table->dropUnique(['source', 'external_id']);
            $table->dropColumn(['source', 'external_id', 'ends_at', 'url']);
        });
        Schema::dropIfExists('game_event_rsvps');
        Schema::dropIfExists('game_event_game');
        Schema::dropIfExists('game_events');
    }
};
