<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Скільки серій є в озвучці (Kodik last_episode, Videoseed count) — для «Додано: N серія | озвучка». */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('movie_sources', function (Blueprint $table) {
            $table->unsignedSmallInteger('episodes')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('movie_sources', function (Blueprint $table) {
            $table->dropColumn('episodes');
        });
    }
};
