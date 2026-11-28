<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Подкасти: шоу автора, випуски, підписники.
        Schema::create('podcasts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title', 120);
            $table->text('description')->nullable();
            $table->string('cover_path')->nullable();
            $table->string('category', 24)->default('games');
            $table->unsignedInteger('subscribers_count')->default(0);
            $table->timestamps();
        });
        Schema::create('podcast_episodes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('podcast_id')->constrained()->cascadeOnDelete();
            $table->string('title', 160);
            $table->text('description')->nullable();
            $table->string('audio_path');
            $table->unsignedInteger('duration')->default(0);
            $table->unsignedInteger('plays_count')->default(0);
            $table->timestamps();
        });
        Schema::create('podcast_subscriptions', function (Blueprint $table) {
            $table->foreignId('podcast_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->nullable();
            $table->primary(['podcast_id', 'user_id']);
        });

        // GameCon+: коротке відео замість обкладинки профілю.
        Schema::table('users', function (Blueprint $table) {
            $table->string('cover_video_path')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('cover_video_path'));
        Schema::dropIfExists('podcast_subscriptions');
        Schema::dropIfExists('podcast_episodes');
        Schema::dropIfExists('podcasts');
    }
};
