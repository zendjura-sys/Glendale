<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Конфіги гравців: коди прицілів, конфіги, бінди, графіка, чутливість — до конкретної гри.
        Schema::create('game_configs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('game_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 16)->index();
            $table->string('title', 80);
            $table->text('code');
            $table->string('description', 1000)->nullable();
            $table->unsignedInteger('likes_count')->default(0);
            $table->unsignedInteger('copies_count')->default(0);
            $table->timestamps();
            $table->index(['game_id', 'likes_count']);
        });
        Schema::create('game_config_likes', function (Blueprint $table) {
            $table->foreignId('game_config_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->nullable();
            $table->primary(['game_config_id', 'user_id']);
        });

        // Планувальник ігрового вечора: організатор кличе друзів, ті голосують за час і гру.
        Schema::create('game_nights', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title', 80);
            $table->string('note', 500)->nullable();
            $table->string('status', 12)->default('planning')->index();
            $table->timestamp('starts_at')->nullable();
            $table->foreignId('game_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });
        Schema::create('game_night_members', function (Blueprint $table) {
            $table->foreignId('game_night_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('status', 12)->default('invited');
            $table->timestamps();
            $table->primary(['game_night_id', 'user_id']);
            $table->index('user_id');
        });
        Schema::create('game_night_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('game_night_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 8);
            $table->timestamp('starts_at')->nullable();
            $table->foreignId('game_id')->nullable()->constrained()->cascadeOnDelete();
        });
        Schema::create('game_night_votes', function (Blueprint $table) {
            $table->foreignId('game_night_option_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->primary(['game_night_option_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('game_night_votes');
        Schema::dropIfExists('game_night_options');
        Schema::dropIfExists('game_night_members');
        Schema::dropIfExists('game_nights');
        Schema::dropIfExists('game_config_likes');
        Schema::dropIfExists('game_configs');
    }
};
