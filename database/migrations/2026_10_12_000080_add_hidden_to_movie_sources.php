<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Адмін може сховати окрему озвучку фільму; при оновленні плеєрів позначка зберігається.
        Schema::table('movie_sources', function (Blueprint $table) {
            $table->boolean('is_hidden')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('movie_sources', fn (Blueprint $table) => $table->dropColumn('is_hidden'));
    }
};
