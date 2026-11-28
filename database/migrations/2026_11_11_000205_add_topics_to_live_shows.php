<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Подкасти наживо: до 5 #тем на кімнату (популярні потрапляють у тренди). Стара колонка topic — перша тема.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('live_shows', function (Blueprint $table) {
            $table->json('topics')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('live_shows', function (Blueprint $table) {
            $table->dropColumn('topics');
        });
    }
};
