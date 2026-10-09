<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('photo_tags', function (Blueprint $table) {
            $table->id();
            $table->foreignId('photo_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['photo_id', 'user_id']);
        });

        Schema::create('album_contributors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('album_id')->constrained('photo_albums')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['album_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('album_contributors');
        Schema::dropIfExists('photo_tags');
    }
};
