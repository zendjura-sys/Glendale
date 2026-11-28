<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Довідка: «Чи допомогла стаття?» — анонімні лічильники 👍/👎 на статтю (без користувачів і IP).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('help_votes', function (Blueprint $table) {
            $table->id();
            $table->string('article', 120)->unique();
            $table->unsignedInteger('helpful')->default(0);
            $table->unsignedInteger('unhelpful')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('help_votes');
    }
};
