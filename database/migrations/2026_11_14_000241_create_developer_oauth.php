<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Розробникам: застосунки сторонніх розробників і OAuth 2.1 (код авторизації + PKCE, токени з ротацією).
 * Секрети й токени зберігаємо лише як SHA-256.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('developer_apps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 60);
            $table->string('description', 300)->nullable();
            $table->string('website', 255)->nullable();
            $table->string('client_id', 40)->unique();
            $table->string('client_secret', 64)->nullable();
            // Публічний ключ (можна показувати в браузері): лише публічні дані, без людини.
            $table->string('public_key', 64)->unique();
            // Токен бота застосунку (SHA-256): дії від імені самого застосунку.
            $table->string('bot_token', 64)->nullable()->unique();
            $table->timestamp('bot_token_at')->nullable();
            // Публічний клієнт (SPA, мобільний) — без секрету, лише PKCE.
            $table->boolean('confidential')->default(true);
            $table->json('redirect_uris');
            $table->json('scopes');
            // Заблоковано адміністрацією.
            $table->timestamp('blocked_at')->nullable();
            $table->string('blocked_reason', 200)->nullable();
            $table->timestamps();
        });

        Schema::create('developer_oauth_codes', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->foreignId('developer_app_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->json('scopes');
            $table->string('redirect_uri', 500);
            $table->string('code_challenge', 128);
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable();
        });

        Schema::create('developer_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('developer_app_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('access_token', 64)->unique();
            $table->string('refresh_token', 64)->nullable()->unique();
            $table->json('scopes');
            $table->timestamp('expires_at');
            $table->timestamp('refresh_expires_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'developer_app_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('developer_tokens');
        Schema::dropIfExists('developer_oauth_codes');
        Schema::dropIfExists('developer_apps');
    }
};
