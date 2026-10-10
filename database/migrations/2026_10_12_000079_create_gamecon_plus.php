<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // GameCon+: статус кешується в plus_until; джерело правди — plus_grants.
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('plus_until')->nullable();
            $table->json('plus_style')->nullable();
        });
        Schema::table('families', function (Blueprint $table) {
            $table->timestamp('plus_until')->nullable();
            $table->json('plus_style')->nullable();
        });
        Schema::table('sticker_packs', function (Blueprint $table) {
            $table->boolean('is_plus')->default(false);
        });
        Schema::table('party_posts', function (Blueprint $table) {
            $table->timestamp('bumped_until')->nullable();
        });

        // Підписки платіжного провайдера (Lemon Squeezy): власник — людина або сім'я.
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
            $table->index(['owner_type', 'owner_id']);
        });

        // Періоди GameCon+: підписка, подарунок, промокод або видача адміністратором.
        Schema::create('plus_grants', function (Blueprint $table) {
            $table->id();
            $table->string('owner_type', 16);
            $table->unsignedBigInteger('owner_id');
            $table->string('source', 16);
            $table->foreignId('subscription_id')->nullable()->constrained('plus_subscriptions')->cascadeOnDelete();
            $table->unsignedBigInteger('payment_id')->nullable();
            $table->foreignId('by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('note', 160)->nullable();
            $table->timestamp('starts_at');
            $table->timestamp('ends_at');
            $table->timestamps();
            $table->index(['owner_type', 'owner_id', 'ends_at']);
        });

        Schema::create('plus_payments', function (Blueprint $table) {
            $table->id();
            $table->string('provider', 24);
            $table->string('provider_id', 64);
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('product', 32);
            $table->string('target_type', 16)->nullable();
            $table->unsignedBigInteger('target_id')->nullable();
            $table->unsignedInteger('amount');
            $table->string('currency', 8);
            $table->string('status', 12);
            $table->string('receipt_url', 500)->nullable();
            $table->timestamps();
            $table->unique(['provider', 'provider_id']);
            $table->index(['user_id', 'created_at']);
        });

        Schema::create('plus_codes', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique();
            $table->unsignedSmallInteger('days');
            $table->unsignedInteger('max_uses')->default(1);
            $table->unsignedInteger('uses')->default(0);
            $table->timestamp('expires_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('plus_code_redemptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('plus_code_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['plus_code_id', 'user_id']);
        });

        // Платне просування серверів: місце в топі, виділена картка, банер.
        Schema::create('server_promotions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gta_server_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 12);
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedBigInteger('payment_id')->nullable();
            $table->timestamp('starts_at');
            $table->timestamp('ends_at');
            $table->timestamps();
            $table->index(['kind', 'ends_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('server_promotions');
        Schema::dropIfExists('plus_code_redemptions');
        Schema::dropIfExists('plus_codes');
        Schema::dropIfExists('plus_payments');
        Schema::dropIfExists('plus_grants');
        Schema::dropIfExists('plus_subscriptions');
        Schema::table('party_posts', fn (Blueprint $table) => $table->dropColumn('bumped_until'));
        Schema::table('sticker_packs', fn (Blueprint $table) => $table->dropColumn('is_plus'));
        Schema::table('families', fn (Blueprint $table) => $table->dropColumn(['plus_until', 'plus_style']));
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn(['plus_until', 'plus_style']));
    }
};
