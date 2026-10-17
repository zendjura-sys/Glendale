<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Стилі сайту (Адмінка → Дизайн): CSS-файли, що перевизначають змінні теми поверх стандартного вигляду.
 * Активний — щонайбільше один, він підключається на всіх сторінках сайту.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('site_themes', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 60)->unique();
            $table->string('name', 80);
            $table->string('description', 300)->nullable();
            $table->string('author', 80)->nullable();
            // Файл на диску public; ім’я містить хеш вмісту, тож нова версія — нова адреса (без старого кешу).
            $table->string('path');
            $table->string('hash', 64);
            $table->unsignedInteger('size');
            $table->unsignedSmallInteger('version')->default(1);
            $table->boolean('is_active')->default(false)->index();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('site_themes');
    }
};
