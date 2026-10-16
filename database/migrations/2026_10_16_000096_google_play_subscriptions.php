<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Підписки GameCon+ з Google Play Billing (застосунок). Стару таблицю провайдерів прибрала міграція Paddle,
 * тож створюємо наново: provider_id — sha256 токена покупки, сам токен — для повторних перевірок.
 * Період доступу — plus_grants.subscription_id (без зовнішнього ключа, як і раніше).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plus_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->string('provider', 24);
            $table->string('provider_id', 64);
            $table->string('owner_type', 16);
            $table->unsignedBigInteger('owner_id');
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('product', 64);
            $table->string('base_plan', 64)->nullable();
            // active | grace | on_hold | paused | canceled | expired | pending
            $table->string('status', 24);
            $table->timestamp('renews_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->text('purchase_token')->nullable();
            $table->string('order_id', 64)->nullable();
            $table->boolean('auto_renew')->default(false);
            $table->boolean('is_test')->default(false);
            $table->timestamp('acknowledged_at')->nullable();
            $table->timestamp('checked_at')->nullable();
            $table->timestamps();
            $table->unique(['provider', 'provider_id']);
            $table->index(['owner_type', 'owner_id']);
            $table->index(['status', 'renews_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plus_subscriptions');
    }
};
