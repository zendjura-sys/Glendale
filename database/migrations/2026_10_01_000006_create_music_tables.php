<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tracks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title', 150);
            $table->string('artist', 150);
            $table->string('album', 150)->nullable();
            $table->string('genre', 40)->nullable();
            $table->unsignedSmallInteger('duration')->default(0);
            $table->string('path');
            $table->string('cover_path')->nullable();
            $table->string('mime', 60)->nullable();
            $table->unsignedInteger('size')->default(0);
            $table->unsignedInteger('plays_count')->default(0);
            $table->unsignedInteger('adds_count')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['artist', 'title']);
            $table->index('plays_count');
        });

        Schema::create('music_library', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('track_id')->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->nullable();

            $table->primary(['user_id', 'track_id']);
            $table->index(['user_id', 'created_at']);
        });

        Schema::create('playlists', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title', 100);
            $table->string('description', 500)->nullable();
            $table->string('cover_path')->nullable();
            $table->boolean('is_public')->default(true);
            $table->unsignedInteger('tracks_count')->default(0);
            $table->unsignedInteger('duration')->default(0);
            $table->timestamps();
        });

        Schema::create('playlist_track', function (Blueprint $table) {
            $table->id();
            $table->foreignId('playlist_id')->constrained()->cascadeOnDelete();
            $table->foreignId('track_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('position')->default(0);
            $table->timestamp('created_at')->nullable();

            $table->unique(['playlist_id', 'track_id']);
        });

        Schema::create('spotify_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('spotify_id', 64);
            $table->string('display_name')->nullable();
            $table->string('avatar_url', 500)->nullable();
            $table->string('product', 20)->nullable();
            $table->string('country', 4)->nullable();
            $table->text('access_token');
            $table->text('refresh_token')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->text('scopes')->nullable();
            $table->boolean('show_now_playing')->default(true);
            $table->timestamps();
        });

        Schema::create('music_statuses', function (Blueprint $table) {
            $table->foreignId('user_id')->primary()->constrained()->cascadeOnDelete();
            $table->string('source', 16);
            $table->foreignId('track_id')->nullable()->constrained()->nullOnDelete();
            $table->json('payload')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::table('posts', function (Blueprint $table) {
            $table->json('music')->nullable()->after('body');
        });
    }

    public function down(): void
    {
        Schema::table('posts', fn (Blueprint $table) => $table->dropColumn('music'));
        Schema::dropIfExists('music_statuses');
        Schema::dropIfExists('spotify_accounts');
        Schema::dropIfExists('playlist_track');
        Schema::dropIfExists('playlists');
        Schema::dropIfExists('music_library');
        Schema::dropIfExists('tracks');
    }
};
