<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Подарунки GameCon+: листівка з побажанням, оформлення й дата вручення (можна наперед — до дня народження). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plus_gifts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payer_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('recipient_id')->constrained('users')->cascadeOnDelete();
            $table->string('product', 32);
            $table->unsignedSmallInteger('days');
            $table->string('message', 200)->nullable();
            $table->string('theme', 12)->default('ice');
            $table->timestamp('deliver_at')->nullable();
            $table->foreignId('payment_id')->nullable()->constrained('plus_payments')->nullOnDelete();
            $table->string('status', 12)->default('draft'); // draft → scheduled → delivered
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('seen_at')->nullable();
            $table->timestamps();
            $table->index(['status', 'deliver_at']);
            $table->index(['recipient_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plus_gifts');
    }
};
