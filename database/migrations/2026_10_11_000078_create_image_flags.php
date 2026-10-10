<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Фото, які автоперевірка вважає відвертими: чекають рішення модератора.
        Schema::create('image_flags', function (Blueprint $table) {
            $table->id();
            $table->string('kind', 16);
            $table->unsignedBigInteger('subject_id');
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('path', 255);
            $table->decimal('score', 4, 3);
            $table->string('status', 12)->default('pending');
            $table->timestamps();
            $table->unique(['kind', 'subject_id']);
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('image_flags');
    }
};
