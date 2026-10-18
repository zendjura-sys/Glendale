<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Канал стримера (Twitch чи YouTube) і чи він зараз в ефірі.
        Schema::create('user_streams', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('platform', 12);
            $table->string('channel', 120);
            $table->boolean('is_live')->default(false);
            $table->string('title', 200)->nullable();
            $table->string('game', 120)->nullable();
            $table->unsignedInteger('viewers')->nullable();
            $table->string('video_id', 32)->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('manual_until')->nullable();
            $table->timestamp('notified_at')->nullable();
            $table->timestamp('checked_at')->nullable();
            $table->timestamps();
            $table->index(['is_live']);
            $table->index(['platform', 'checked_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_streams');
    }
};
