<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Аналітика сторінок (№288): перегляди й унікальні відвідувачі по днях і звідки прийшли.
 * page_visitors — лише для підрахунку унікальних за день (хеш, без IP), чиститься за 3 дні.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('page_views', function (Blueprint $table) {
            $table->id();
            $table->string('subject_type', 20);
            $table->unsignedBigInteger('subject_id');
            $table->date('day');
            $table->unsignedInteger('views')->default(0);
            $table->unsignedInteger('uniques')->default(0);
            $table->unsignedInteger('from_inside')->default(0);
            $table->unsignedInteger('from_search')->default(0);
            $table->unsignedInteger('from_outside')->default(0);
            $table->unique(['subject_type', 'subject_id', 'day']);
        });
        Schema::create('page_visitors', function (Blueprint $table) {
            $table->string('subject_type', 20);
            $table->unsignedBigInteger('subject_id');
            $table->date('day');
            $table->string('visitor', 40);
            $table->unique(['subject_type', 'subject_id', 'day', 'visitor']);
            $table->index('day');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('page_visitors');
        Schema::dropIfExists('page_views');
    }
};
