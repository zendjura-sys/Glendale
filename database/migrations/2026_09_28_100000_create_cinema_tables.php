<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Кінопортал — частина ядра: каталог фільмів і серіалів (імпорт із TMDB),
 * люди й ролі, сезони й серії, трейлери, плеєр Kodik, оцінки й рецензії,
 * «Хочу подивитись» і прогрес перегляду (продовжити з того ж місця).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cinema_genres', function (Blueprint $t) {
            $t->id();
            $t->unsignedInteger('tmdb_id')->nullable()->unique();
            $t->string('name', 80);
            $t->string('slug', 80)->unique();
        });

        Schema::create('cinema_titles', function (Blueprint $t) {
            $t->id();
            $t->unsignedInteger('tmdb_id')->nullable();
            $t->string('type', 10); // movie | series
            // Розділ вітрини: movie, series, anime, dorama, cartoon (мультфільми), toon (мультсеріали).
            $t->string('category', 12)->default('movie')->index();
            $t->string('name', 255);
            $t->string('original_name', 255)->nullable();
            $t->unsignedSmallInteger('year')->nullable();
            $t->date('release_date')->nullable();
            $t->unsignedSmallInteger('runtime')->nullable();
            $t->text('overview')->nullable();
            $t->string('tagline', 255)->nullable();
            $t->string('poster_path')->nullable();
            $t->string('backdrop_path')->nullable();
            $t->decimal('vote_average', 3, 1)->default(0);
            $t->unsignedInteger('vote_count')->default(0);
            $t->float('popularity')->default(0);
            $t->string('imdb_id', 20)->nullable()->index();
            $t->string('original_language', 8)->nullable();
            $t->json('countries')->nullable();
            $t->string('status', 40)->nullable();
            $t->unsignedSmallInteger('seasons_count')->nullable();
            $t->unsignedSmallInteger('episodes_count')->nullable();
            $t->string('trailer_key', 40)->nullable();
            $t->string('kodik_link')->nullable();
            $t->json('kodik_translations')->nullable();
            $t->timestamp('kodik_checked_at')->nullable();
            $t->boolean('is_published')->default(true);
            $t->boolean('is_featured')->default(false);
            $t->decimal('local_rating', 3, 1)->nullable();
            $t->unsignedInteger('local_rating_count')->default(0);
            $t->timestamps();
            $t->unique(['tmdb_id', 'type']);
            $t->index(['type', 'is_published', 'popularity']);
        });

        Schema::create('cinema_title_genre', function (Blueprint $t) {
            $t->foreignId('title_id')->constrained('cinema_titles')->cascadeOnDelete();
            $t->foreignId('genre_id')->constrained('cinema_genres')->cascadeOnDelete();
            $t->primary(['title_id', 'genre_id']);
        });

        Schema::create('cinema_people', function (Blueprint $t) {
            $t->id();
            $t->unsignedInteger('tmdb_id')->nullable()->unique();
            $t->string('name', 255);
            $t->string('profile_path')->nullable();
            $t->text('biography')->nullable();
            $t->date('birthday')->nullable();
            $t->date('deathday')->nullable();
            $t->string('place_of_birth')->nullable();
            $t->string('known_for', 60)->nullable();
            $t->float('popularity')->default(0);
            $t->timestamp('details_loaded_at')->nullable();
            $t->timestamps();
        });

        Schema::create('cinema_credits', function (Blueprint $t) {
            $t->id();
            $t->foreignId('title_id')->constrained('cinema_titles')->cascadeOnDelete();
            $t->foreignId('person_id')->constrained('cinema_people')->cascadeOnDelete();
            $t->string('job', 20); // cast | director | writer | creator | producer
            $t->string('character')->nullable();
            $t->unsignedSmallInteger('position')->default(0);
            $t->index(['title_id', 'job', 'position']);
        });

        Schema::create('cinema_seasons', function (Blueprint $t) {
            $t->id();
            $t->foreignId('title_id')->constrained('cinema_titles')->cascadeOnDelete();
            $t->unsignedSmallInteger('number');
            $t->string('name')->nullable();
            $t->text('overview')->nullable();
            $t->string('poster_path')->nullable();
            $t->date('air_date')->nullable();
            $t->unsignedSmallInteger('episodes_count')->default(0);
            $t->timestamp('episodes_loaded_at')->nullable();
            $t->unique(['title_id', 'number']);
        });

        Schema::create('cinema_episodes', function (Blueprint $t) {
            $t->id();
            $t->foreignId('season_id')->constrained('cinema_seasons')->cascadeOnDelete();
            $t->foreignId('title_id')->constrained('cinema_titles')->cascadeOnDelete();
            $t->unsignedSmallInteger('number');
            $t->string('name')->nullable();
            $t->text('overview')->nullable();
            $t->string('still_path')->nullable();
            $t->date('air_date')->nullable();
            $t->unsignedSmallInteger('runtime')->nullable();
            $t->unique(['season_id', 'number']);
        });

        Schema::create('cinema_videos', function (Blueprint $t) {
            $t->id();
            $t->foreignId('title_id')->constrained('cinema_titles')->cascadeOnDelete();
            $t->string('provider', 20)->default('youtube');
            $t->string('key', 60);
            $t->string('name')->nullable();
            $t->string('type', 30)->nullable();
            $t->string('language', 8)->nullable();
        });

        Schema::create('cinema_reviews', function (Blueprint $t) {
            $t->id();
            $t->foreignId('title_id')->constrained('cinema_titles')->cascadeOnDelete();
            $t->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $t->unsignedTinyInteger('rating');
            $t->text('body')->nullable();
            $t->timestamps();
            $t->unique(['title_id', 'user_id']);
        });

        Schema::create('cinema_watchlist', function (Blueprint $t) {
            $t->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $t->foreignId('title_id')->constrained('cinema_titles')->cascadeOnDelete();
            $t->timestamp('created_at')->nullable();
            $t->primary(['user_id', 'title_id']);
        });

        Schema::create('cinema_progress', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $t->foreignId('title_id')->constrained('cinema_titles')->cascadeOnDelete();
            $t->unsignedSmallInteger('season')->nullable();
            $t->unsignedSmallInteger('episode')->nullable();
            $t->unsignedInteger('position')->default(0);
            $t->unsignedInteger('duration')->nullable();
            $t->timestamp('updated_at')->nullable();
            $t->unique(['user_id', 'title_id']);
        });

        // Право на керування кінопорталом (імпорт, ключі API, публікація).
        if (Schema::hasTable('permissions')) {
            $now = now();
            DB::table('permissions')->insertOrIgnore(['name' => 'cinema.manage', 'guard_name' => 'web', 'created_at' => $now, 'updated_at' => $now]);
            $permission = DB::table('permissions')->where('name', 'cinema.manage')->value('id');
            $admin = DB::table('roles')->where('name', 'admin')->value('id');
            if ($permission && $admin) {
                DB::table('role_has_permissions')->insertOrIgnore(['permission_id' => $permission, 'role_id' => $admin]);
            }
            app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();
        }
    }

    public function down(): void
    {
        foreach (['cinema_progress', 'cinema_watchlist', 'cinema_reviews', 'cinema_videos', 'cinema_episodes', 'cinema_seasons', 'cinema_credits', 'cinema_people', 'cinema_title_genre', 'cinema_titles', 'cinema_genres'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
