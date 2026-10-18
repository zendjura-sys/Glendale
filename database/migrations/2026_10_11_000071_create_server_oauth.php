<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Застосунок сервера: «Увійти через GameCon» на сайті чи в лаунчері проєкту.
        Schema::create('oauth_clients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gta_server_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name', 80);
            $table->string('client_id', 40)->unique();
            $table->string('secret_hash', 64);
            $table->json('redirect_uris');
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();
        });

        Schema::create('oauth_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('oauth_client_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->char('code_hash', 64)->unique();
            $table->string('redirect_uri', 500);
            $table->json('scopes');
            $table->string('code_challenge', 128)->nullable();
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable();
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('oauth_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('oauth_client_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->char('token_hash', 64)->unique();
            $table->json('scopes');
            $table->timestamp('expires_at');
            $table->timestamp('revoked_at')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'oauth_client_id']);
        });

        // Гравці, яких сервер підтвердив: нік у грі, чи зараз онлайн.
        Schema::create('server_players', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gta_server_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('nickname', 60)->nullable();
            $table->boolean('online')->default(false);
            $table->timestamp('verified_at');
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();
            $table->unique(['gta_server_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('server_players');
        Schema::dropIfExists('oauth_tokens');
        Schema::dropIfExists('oauth_codes');
        Schema::dropIfExists('oauth_clients');
    }
};
