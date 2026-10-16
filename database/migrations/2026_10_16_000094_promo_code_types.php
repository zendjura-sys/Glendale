<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Промокоди різних типів: дні GameCon+ одразу (як раніше), знижка на підписку (відсоток або сума, на N платежів
 * чи назавжди), знижка на перший платіж, безкоштовний період (дні чи місяці) перед першою оплатою.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('plus_codes', function (Blueprint $table) {
            // days | discount | first_payment | trial
            $table->string('type', 16)->default('days');
            $table->unsignedSmallInteger('months')->default(0);
            $table->unsignedTinyInteger('percent')->nullable();
            $table->unsignedInteger('amount_off')->nullable();
            // Скільки оплат зі знижкою; null — усі, поки діє підписка.
            $table->unsignedSmallInteger('payments')->nullable();
            // На які тарифи діє (ключі каталогу); null — усі підписки.
            $table->json('products')->nullable();
            $table->boolean('new_only')->default(false);
            $table->string('note', 120)->nullable();
            $table->unsignedSmallInteger('days')->default(0)->change();
        });

        Schema::table('plus_code_redemptions', function (Blueprint $table) {
            $table->unsignedSmallInteger('payments_left')->nullable();
            $table->unsignedSmallInteger('applied')->default(0);
            $table->string('product', 40)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('plus_code_redemptions', function (Blueprint $table) {
            $table->dropColumn(['payments_left', 'applied', 'product']);
        });
        Schema::table('plus_codes', function (Blueprint $table) {
            $table->dropColumn(['type', 'months', 'percent', 'amount_off', 'payments', 'products', 'new_only', 'note']);
        });
    }
};
