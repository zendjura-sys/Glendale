<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('push_devices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // Вихід із застосунку видаляє токен API — разом з ним зникає й пристрій.
            $table->foreignId('api_token_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('token', 512)->unique();
            $table->string('platform', 16)->default('android');
            $table->timestamp('last_used_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('push_devices');
    }
};
