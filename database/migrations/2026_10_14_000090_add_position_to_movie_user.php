<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Де глядач зупинився: секунда серії й обрана озвучка (плеєр застосунку продовжує з цього місця). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('movie_user', function (Blueprint $table) {
            $table->unsignedInteger('position')->nullable();
            $table->string('player_key', 60)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('movie_user', function (Blueprint $table) {
            $table->dropColumn(['position', 'player_key']);
        });
    }
};
