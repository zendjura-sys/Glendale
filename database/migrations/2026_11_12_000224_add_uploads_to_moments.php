<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Власні кліпи в «Моментах»: файл обрізається на сервері (ffmpeg) за початком і кінцем, обраними в браузері. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('moments', function (Blueprint $table) {
            $table->string('video_path', 255)->nullable();
            $table->unsignedInteger('duration_ms')->nullable();
            $table->string('status', 12)->default('ready'); // ready | processing | failed
        });
    }

    public function down(): void
    {
        Schema::table('moments', fn (Blueprint $table) => $table->dropColumn(['video_path', 'duration_ms', 'status']));
    }
};
