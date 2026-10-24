<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * «Увійти через застосунок GameCon»: запити браузера на вхід без пароля, які підтверджують у застосунку.
 * Рядки лишаються на 30 днів для аудиту, далі їх прибирає model:prune.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('app_login_requests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('login_hint', 255)->nullable();
            $table->char('secret_hash', 64);
            $table->char('code', 2);
            $table->string('status', 12)->default('pending');
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->char('country', 2)->nullable();
            $table->string('city', 80)->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('consumed_at')->nullable();
            $table->timestamp('expires_at');
            $table->timestamps();
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('app_login_requests');
    }
};
