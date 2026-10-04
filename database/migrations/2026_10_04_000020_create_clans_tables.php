<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Клани й гільдії мультиплеєрних ігор. Які розділи працюють — обирає засновник (features).
        Schema::create('clans', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 80)->unique();
            $table->string('type', 8);
            $table->string('name', 60);
            $table->string('tag', 8);
            $table->foreignId('game_id')->constrained()->cascadeOnDelete();
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->string('description', 1000)->nullable();
            $table->text('rules')->nullable();
            $table->string('logo_path')->nullable();
            $table->json('features');
            $table->json('rank_titles')->nullable();
            $table->json('permissions')->nullable();
            $table->string('join_mode', 12)->default('request');
            $table->boolean('is_recruiting')->default(true);
            $table->string('currency', 24)->default('монет');
            $table->bigInteger('treasury')->default(0);
            $table->unsignedInteger('members_count')->default(0);
            $table->foreignId('conversation_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
            $table->index(['game_id', 'type']);
        });

        Schema::create('clan_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clan_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('rank')->default(1);
            $table->string('status', 12)->default('pending');
            $table->string('nickname', 40)->nullable();
            $table->string('note', 500)->nullable();
            $table->bigInteger('contributed')->default(0);
            $table->timestamp('joined_at')->nullable();
            $table->timestamps();
            $table->unique(['clan_id', 'user_id']);
            $table->index(['clan_id', 'status']);
        });

        Schema::create('clan_contributions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clan_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->bigInteger('amount');
            $table->string('comment', 200)->nullable();
            $table->string('status', 12)->default('pending');
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['clan_id', 'status']);
        });

        Schema::create('clan_news', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clan_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title', 120);
            $table->text('body');
            $table->boolean('is_pinned')->default(false);
            $table->timestamps();
        });

        Schema::create('clan_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clan_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title', 120);
            $table->string('description', 1000)->nullable();
            $table->timestamp('starts_at');
            $table->timestamps();
            $table->index(['clan_id', 'starts_at']);
        });

        Schema::create('clan_event_rsvps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clan_event_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unique(['clan_event_id', 'user_id']);
        });

        Schema::create('clan_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clan_id')->constrained()->cascadeOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 40);
            $table->string('text', 300);
            $table->timestamp('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clan_logs');
        Schema::dropIfExists('clan_event_rsvps');
        Schema::dropIfExists('clan_events');
        Schema::dropIfExists('clan_news');
        Schema::dropIfExists('clan_contributions');
        Schema::dropIfExists('clan_members');
        Schema::dropIfExists('clans');
    }
};
