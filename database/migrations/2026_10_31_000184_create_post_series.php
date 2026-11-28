<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Серії записів: автор об’єднує свої записи в послідовність («Гайд, частина 1…5»).
        Schema::create('post_series', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title', 80);
            $table->string('description', 500)->nullable();
            $table->timestamps();
        });
        Schema::table('posts', function (Blueprint $table) {
            $table->foreignId('series_id')->nullable()->after('tag')->constrained('post_series')->nullOnDelete();
            $table->unsignedSmallInteger('series_position')->nullable()->after('series_id');
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('series_id');
            $table->dropColumn('series_position');
        });
        Schema::dropIfExists('post_series');
    }
};
