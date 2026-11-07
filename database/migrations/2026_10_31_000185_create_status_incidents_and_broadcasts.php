<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Інциденти для сторінки статусу: команда повідомляє про збої й оновлює хід робіт.
        Schema::create('status_incidents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title', 120);
            $table->string('severity', 12)->default('minor');
            $table->string('status', 16)->default('investigating')->index();
            $table->json('updates')->nullable();
            $table->timestamp('started_at');
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
        });

        // Розсилки від адміністрації: сповіщення всім чи частині людей.
        Schema::create('broadcasts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title', 80);
            $table->string('body', 500);
            $table->string('url', 300)->nullable();
            $table->string('audience', 12);
            $table->unsignedInteger('sent_count')->default(0);
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('broadcasts');
        Schema::dropIfExists('status_incidents');
    }
};
