<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Оплата карткою через еквайринг monobank замість рахунку з балансом: замовлення (один рахунок monobank —
 * один товар), збережені картки для автопродовження, журнал вебхуків (захист від повторів).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_cards', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('provider', 16)->default('monobank');
            $table->text('token');
            $table->string('token_hash', 64)->unique();
            $table->string('masked_pan', 32);
            $table->string('payment_system', 16)->nullable();
            $table->string('country', 8)->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamps();
        });

        Schema::create('payment_orders', function (Blueprint $table) {
            $table->id();
            $table->string('code', 16)->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // purchase — людина купує на сайті; renewal — автопродовження збереженою карткою.
            $table->string('kind', 12)->default('purchase');
            $table->string('product', 40);
            $table->string('target_type', 16);
            $table->unsignedBigInteger('target_id');
            $table->boolean('renew')->default(false);
            $table->boolean('save_card')->default(false);
            $table->unsignedBigInteger('price');
            // Залишок старого балансу, зарахований у ціну (копійки); amount — скільки списати з картки.
            $table->unsignedBigInteger('credit_used')->default(0);
            $table->unsignedBigInteger('amount');
            $table->string('status', 12)->default('pending')->index();
            $table->string('method', 16)->default('card');
            $table->string('invoice_id', 64)->nullable()->unique();
            $table->string('page_url', 500)->nullable();
            $table->string('masked_pan', 32)->nullable();
            $table->string('failure', 255)->nullable();
            $table->unsignedBigInteger('refunded')->default(0);
            // Знижка за промокодом (копійки) і активація промокоду, з якої її взято.
            $table->unsignedBigInteger('discount')->default(0);
            $table->foreignId('promo_redemption_id')->nullable()->constrained('plus_code_redemptions')->nullOnDelete();
            $table->foreignId('payment_id')->nullable()->constrained('plus_payments')->nullOnDelete();
            $table->foreignId('renewal_id')->nullable()->constrained('plus_renewals')->nullOnDelete();
            $table->foreignId('card_id')->nullable()->constrained('payment_cards')->nullOnDelete();
            $table->timestamp('expires_at');
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'status']);
        });

        Schema::create('payment_webhooks', function (Blueprint $table) {
            $table->id();
            $table->string('provider', 16);
            $table->string('event_key', 128)->unique();
            $table->string('invoice_id', 64)->index();
            $table->string('status', 16);
            $table->timestamp('created_at')->nullable();
        });

        Schema::table('plus_renewals', function (Blueprint $table) {
            $table->foreignId('card_id')->nullable()->constrained('payment_cards')->nullOnDelete();
            $table->unsignedTinyInteger('attempts')->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('plus_renewals', function (Blueprint $table) {
            $table->dropConstrainedForeignId('card_id');
            $table->dropColumn('attempts');
        });
        Schema::dropIfExists('payment_webhooks');
        Schema::dropIfExists('payment_orders');
        Schema::dropIfExists('payment_cards');
    }
};
