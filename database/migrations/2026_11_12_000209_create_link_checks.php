<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Нічна перевірка посилань і картинок: стан кожної адреси (нічого не видаляє, лише звіт). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('link_checks', function (Blueprint $table) {
            $table->id();
            $table->string('hash', 40)->unique();
            $table->string('source', 24);
            $table->unsignedBigInteger('source_id');
            $table->string('field', 24);
            $table->string('kind', 8);
            $table->text('url');
            $table->string('label', 160)->nullable();
            $table->unsignedSmallInteger('status')->nullable();
            $table->string('error', 160)->nullable();
            $table->unsignedSmallInteger('fails')->default(0);
            $table->boolean('ignored')->default(false);
            $table->timestamp('failing_since')->nullable();
            $table->timestamp('checked_at')->nullable();
            $table->timestamps();
            $table->index(['fails', 'ignored']);
            $table->index('checked_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('link_checks');
    }
};
