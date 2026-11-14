<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Музика в стилі Apple Music: радіостанції, добірки редакції й настрої, звукові дані треку
 * (кодек, частота, розрядність — для значків Lossless / Hi-Res Lossless) і копія для потоку,
 * якщо оригінал браузери не відтворюють.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('radio_stations', function (Blueprint $table) {
            $table->id();
            $table->string('name', 80);
            $table->string('slug', 90)->unique();
            $table->string('tagline', 160)->nullable();
            // Адреса потоку (лише https), сторінка станції й логотип.
            $table->string('stream_url', 500);
            $table->string('homepage', 300)->nullable();
            $table->string('logo_path')->nullable();
            $table->string('genre', 40)->nullable();
            $table->string('country', 2)->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();
            $table->index(['is_active', 'position']);
        });

        Schema::table('playlists', function (Blueprint $table) {
            // Добірка редакції: показується в «Новому»; category — настрій чи заняття (energy, chill…).
            $table->boolean('is_featured')->default(false)->after('is_public');
            $table->string('category', 20)->nullable()->after('is_featured');
            $table->index(['is_featured', 'category']);
        });

        Schema::table('music_library', function (Blueprint $table) {
            // Зірочка «Улюблене» (як у плеєрі Apple Music): трек у медіатеці й позначений улюбленим.
            $table->boolean('is_favorite')->default(false)->after('track_id');
        });

        Schema::table('tracks', function (Blueprint $table) {
            $table->unsignedSmallInteger('year')->nullable()->after('genre');
            $table->unsignedSmallInteger('track_no')->nullable()->after('year');
            $table->string('codec', 20)->nullable()->after('mime');
            $table->unsignedInteger('sample_rate')->nullable()->after('codec');
            $table->unsignedTinyInteger('bit_depth')->nullable()->after('sample_rate');
            $table->unsignedInteger('bitrate')->nullable()->after('bit_depth');
            $table->unsignedTinyInteger('channels')->nullable()->after('bitrate');
            // lossy, lossless (до 48 кГц / 24 біт) або hires (понад 48 кГц).
            $table->string('quality', 10)->nullable()->after('channels');
            // Копія для відтворення в браузері (AAC), якщо оригінал не грає скрізь; null — грає оригінал.
            $table->string('stream_path')->nullable()->after('path');
            // Трек ще обробляється (перекодування) — у списках не показується.
            $table->boolean('processing')->default(false)->after('stream_path');
            $table->index(['album', 'artist']);
            $table->index('genre');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::table('tracks', function (Blueprint $table) {
            $table->dropIndex(['album', 'artist']);
            $table->dropIndex(['genre']);
            $table->dropIndex(['created_at']);
            $table->dropColumn(['year', 'track_no', 'codec', 'sample_rate', 'bit_depth', 'bitrate', 'channels', 'quality', 'stream_path', 'processing']);
        });
        Schema::table('music_library', function (Blueprint $table) {
            $table->dropColumn('is_favorite');
        });
        Schema::table('playlists', function (Blueprint $table) {
            $table->dropIndex(['is_featured', 'category']);
            $table->dropColumn(['is_featured', 'category']);
        });
        Schema::dropIfExists('radio_stations');
    }
};
