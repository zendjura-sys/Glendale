<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** «Не цікаво» в рекомендаціях кіно: такі тайтли більше не пропонуються. */
    public function up(): void
    {
        Schema::create('movie_dismissals', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('movie_id')->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->nullable();
            $table->primary(['user_id', 'movie_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('movie_dismissals');
    }
};
