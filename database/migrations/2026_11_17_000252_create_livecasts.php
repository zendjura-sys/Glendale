<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** LiveCast — нативні відеостріми (окремо від GameCast і status broadcasts). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('livecasts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('host_id')->constrained('users')->cascadeOnDelete();
            $table->string('title', 80);
            $table->string('category', 60)->nullable();
            $table->string('status', 16)->default('live'); // live | ended
            $table->unsignedInteger('viewers')->default(0);
            $table->unsignedInteger('peak_viewers')->default(0);
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->timestamps();
            $table->index(['status', 'started_at']);
            $table->index(['host_id', 'status']);
        });

        Schema::create('livecast_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('livecast_id')->constrained('livecasts')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('body', 280);
            $table->timestamps();
            $table->index(['livecast_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('livecast_messages');
        Schema::dropIfExists('livecasts');
    }
};
