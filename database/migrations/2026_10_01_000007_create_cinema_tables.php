<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('movies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('slug', 160)->unique();
            $table->string('type', 20)->index();
            $table->string('title', 200);
            $table->string('title_original', 200)->nullable();
            $table->unsignedSmallInteger('year')->nullable();
            $table->string('tagline', 300)->nullable();
            $table->text('description')->nullable();
            $table->string('trailer_url', 500)->nullable();
            $table->string('poster_url', 500)->nullable();
            $table->string('backdrop_url', 500)->nullable();
            $table->string('poster_path')->nullable();
            $table->string('backdrop_path')->nullable();
            $table->json('genres')->nullable();
            $table->json('countries')->nullable();
            $table->unsignedSmallInteger('duration')->nullable();
            $table->string('age_rating', 10)->nullable();
            $table->decimal('rating_kp', 3, 1)->nullable();
            $table->decimal('rating_imdb', 3, 1)->nullable();
            $table->decimal('rating_shikimori', 3, 1)->nullable();
            $table->decimal('rating_tmdb', 3, 1)->nullable();
            $table->string('kinopoisk_id', 20)->nullable()->index();
            $table->string('tmdb_id', 30)->nullable()->index();
            $table->string('imdb_id', 20)->nullable()->index();
            $table->string('shikimori_id', 20)->nullable()->index();
            $table->unsignedSmallInteger('episodes_count')->nullable();
            $table->string('origin', 20)->default('manual');
            $table->timestamp('enriched_at')->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->boolean('is_published')->default(true);
            $table->boolean('is_featured')->default(false);
            $table->boolean('comments_enabled')->default(true);
            $table->unsignedInteger('views_count')->default(0);
            $table->unsignedInteger('ratings_count')->default(0);
            $table->unsignedInteger('ratings_sum')->default(0);
            $table->unsignedInteger('watchers_count')->default(0);
            $table->unsignedInteger('comments_count')->default(0);
            $table->timestamps();
            $table->softDeletes();
            $table->index(['is_published', 'type', 'year']);
        });

        Schema::create('movie_sources', function (Blueprint $table) {
            $table->id();
            $table->foreignId('movie_id')->constrained()->cascadeOnDelete();
            $table->string('provider', 20);
            $table->string('external_id', 100);
            $table->string('translation', 150)->nullable();
            $table->string('translation_type', 20)->nullable();
            $table->string('quality', 40)->nullable();
            $table->string('link', 500);
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();
            $table->unique(['movie_id', 'provider', 'external_id']);
        });

        Schema::create('movie_user', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('movie_id')->constrained()->cascadeOnDelete();
            $table->string('status', 16)->nullable();
            $table->unsignedTinyInteger('rating')->nullable();
            $table->timestamp('watched_at')->nullable();
            $table->timestamps();
            $table->primary(['user_id', 'movie_id']);
            $table->index(['user_id', 'status', 'updated_at']);
            $table->index('movie_id');
        });

        Schema::table('comments', function (Blueprint $table) {
            $table->foreignId('movie_id')->nullable()->after('photo_id')->constrained()->cascadeOnDelete();
            $table->index(['movie_id', 'created_at']);
        });

        Schema::table('posts', function (Blueprint $table) {
            $table->foreignId('movie_id')->nullable()->after('music')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('movie_id');
        });
        Schema::table('comments', function (Blueprint $table) {
            $table->dropForeign(['movie_id']);
            $table->dropIndex(['movie_id', 'created_at']);
            $table->dropColumn('movie_id');
        });

        Schema::dropIfExists('movie_user');
        Schema::dropIfExists('movie_sources');
        Schema::dropIfExists('movies');
    }
};
