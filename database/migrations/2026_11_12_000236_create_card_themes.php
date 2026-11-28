<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Тематичні набори колекційних карток (фентезі, меха, супергерої…): картку до набору відносить ІІ. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('card_themes', function (Blueprint $table) {
            $table->string('card_key', 24)->primary();
            $table->string('theme', 40);
            $table->string('source', 8)->default('ai');
            $table->timestamps();
            $table->index('theme');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('card_themes');
    }
};
