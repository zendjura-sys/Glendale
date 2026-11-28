<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * «Завантажити за посиланням»: черга завантажень аудіо за посиланням (пряме посилання на файл,
 * Google Диск, Dropbox, OneDrive) — стан, прогрес, помилка й готовий трек.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('track_imports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('url');
            $table->string('host', 255);
            $table->json('hints')->nullable();
            $table->string('status', 12)->default('pending');
            $table->string('error', 300)->nullable();
            $table->unsignedTinyInteger('progress')->nullable();
            $table->unsignedBigInteger('bytes')->nullable();
            $table->foreignId('track_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
            $table->index(['user_id', 'status']);
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('track_imports');
    }
};
