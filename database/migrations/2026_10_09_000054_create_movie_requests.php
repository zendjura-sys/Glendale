<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('movie_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title', 160);
            $table->unsignedSmallInteger('year')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'title']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('movie_requests');
    }
};
