<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Аналітика для власника сервера: перегляди сторінки й переходи за день.
        Schema::create('server_stats', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gta_server_id')->constrained()->cascadeOnDelete();
            $table->date('day');
            $table->unsignedInteger('views')->default(0);
            $table->unsignedInteger('connect')->default(0);
            $table->unsignedInteger('discord')->default(0);
            $table->unsignedInteger('website')->default(0);
            $table->unsignedInteger('telegram')->default(0);
            $table->unique(['gta_server_id', 'day']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('server_stats');
    }
};
