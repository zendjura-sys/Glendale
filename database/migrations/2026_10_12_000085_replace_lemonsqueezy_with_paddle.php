<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Підписки тепер веде Cashier (таблиця subscriptions); період GameCon+ посилається на неї без зовнішнього ключа.
        Schema::table('plus_grants', function (Blueprint $table) {
            $table->dropForeign(['subscription_id']);
        });
        Schema::dropIfExists('plus_subscriptions');

        // Ключі й ID варіантів Lemon Squeezy більше не потрібні.
        DB::table('site_settings')->where('key', 'like', 'lemonsqueezy_%')->orWhere('key', 'like', 'ls_variant_%')->delete();
    }

    public function down(): void
    {
        Schema::create('plus_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->string('provider', 24);
            $table->string('provider_id', 64);
            $table->string('owner_type', 16);
            $table->unsignedBigInteger('owner_id');
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('product', 32);
            $table->string('status', 16);
            $table->timestamp('renews_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->string('portal_url', 500)->nullable();
            $table->timestamps();
            $table->unique(['provider', 'provider_id']);
        });
    }
};
