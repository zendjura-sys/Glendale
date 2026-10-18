<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Білінг: особистий рахунок замість Paddle.
 *
 * Рахунок поповнюють донатом (код у повідомленні), з рахунку купують GameCon+, подарунки, просування
 * і автоматично продовжують GameCon+. Усі суми рахунку — у копійках.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Paddle не підтримує соцмережі — його таблиці (Cashier) і ключі більше не потрібні.
        Schema::dropIfExists('subscription_items');
        Schema::dropIfExists('subscriptions');
        Schema::dropIfExists('transactions');
        Schema::dropIfExists('customers');
        DB::table('site_settings')->where('key', 'like', 'paddle%')->delete();

        Schema::table('users', function (Blueprint $table) {
            $table->bigInteger('balance')->default(0);
        });

        // Журнал рахунку: кожна зміна балансу — один рядок (поповнення, покупка, продовження, повернення, корекція).
        Schema::create('wallet_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->bigInteger('amount');
            $table->bigInteger('balance_after');
            $table->string('type', 16);
            $table->string('description', 200);
            $table->string('product', 32)->nullable();
            $table->string('reference', 64)->nullable();
            $table->foreignId('by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['user_id', 'id']);
        });

        // Донати, отримані через API сервісу (Donatello). Невпізнані адміністратор прив’язує вручну.
        Schema::create('plus_donations', function (Blueprint $table) {
            $table->id();
            $table->string('provider', 16);
            $table->string('external_id', 64);
            $table->string('name', 120)->nullable();
            $table->string('message', 1000)->nullable();
            $table->unsignedInteger('amount');
            $table->string('currency', 8);
            $table->timestamp('donated_at')->nullable();
            $table->unsignedBigInteger('topup_id')->nullable()->index();
            $table->timestamps();
            $table->unique(['provider', 'external_id']);
        });

        // Заявка на поповнення: код, який людина вказує в повідомленні до донату.
        Schema::create('wallet_topups', function (Blueprint $table) {
            $table->id();
            $table->string('code', 16)->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('amount');
            $table->string('method', 16)->nullable();
            $table->string('status', 12)->default('pending')->index();
            $table->timestamp('claimed_at')->nullable();
            $table->string('note', 300)->nullable();
            $table->bigInteger('credited')->nullable();
            $table->foreignId('donation_id')->nullable()->constrained('plus_donations')->nullOnDelete();
            $table->foreignId('confirmed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('expires_at');
            $table->timestamps();
            $table->index(['user_id', 'status']);
        });

        // Автопродовження GameCon+ (особистого чи сім’ї) з рахунку платника.
        Schema::create('plus_renewals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('product', 32);
            $table->string('owner_type', 16);
            $table->unsignedBigInteger('owner_id');
            $table->boolean('active')->default(true);
            $table->timestamp('renewed_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->timestamps();
            $table->unique(['owner_type', 'owner_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plus_renewals');
        Schema::dropIfExists('wallet_topups');
        Schema::dropIfExists('plus_donations');
        Schema::dropIfExists('wallet_transactions');
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('balance'));
    }
};
