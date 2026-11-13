<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Бібліотека відеофонів (Адмінка → Дизайн): окремий файл для смартфона й для ПК/планшета, обкладинка. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('video_backgrounds', function (Blueprint $table) {
            $table->id();
            $table->string('title', 60);
            $table->string('mobile_path')->nullable();
            $table->string('desktop_path')->nullable();
            $table->string('poster_path')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('position')->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('video_backgrounds');
    }
};
