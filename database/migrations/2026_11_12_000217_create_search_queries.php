<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Що шукають на сайті: запит (у нижньому регістрі) і скільки людей за день — для підказок. Без прив’язки до людини. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('search_queries', function (Blueprint $table) {
            $table->string('q', 80);
            $table->date('day');
            $table->unsignedInteger('people')->default(0);
            $table->primary(['q', 'day']);
            $table->index('day');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('search_queries');
    }
};
