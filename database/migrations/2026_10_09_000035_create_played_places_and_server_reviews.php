<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('played_places', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 16);
            $table->unsignedBigInteger('subject_id');
            $table->timestamps();
            $table->unique(['user_id', 'kind', 'subject_id']);
        });

        Schema::create('server_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('gta_server_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('stars');
            $table->string('body', 500);
            $table->timestamps();
            $table->unique(['user_id', 'gta_server_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('server_reviews');
        Schema::dropIfExists('played_places');
    }
};
