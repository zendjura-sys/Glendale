<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('movie_user', function (Blueprint $table) {
            $table->unsignedSmallInteger('season')->nullable();
            $table->unsignedSmallInteger('episode')->nullable();
        });

        Schema::table('posts', function (Blueprint $table) {
            $table->boolean('spoiler')->default(false);
        });

        Schema::table('comments', function (Blueprint $table) {
            $table->boolean('spoiler')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('comments', function (Blueprint $table) {
            $table->dropColumn('spoiler');
        });
        Schema::table('posts', function (Blueprint $table) {
            $table->dropColumn('spoiler');
        });
        Schema::table('movie_user', function (Blueprint $table) {
            $table->dropColumn(['season', 'episode']);
        });
    }
};
