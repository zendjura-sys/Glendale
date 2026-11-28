<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Повільний режим коментарів на гарячих записах: інтервал між коментарями однієї людини і до коли діє. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->unsignedSmallInteger('slow_mode_seconds')->nullable();
            $table->timestamp('slow_mode_until')->nullable();
            $table->boolean('slow_mode_auto')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropColumn(['slow_mode_seconds', 'slow_mode_until', 'slow_mode_auto']);
        });
    }
};
