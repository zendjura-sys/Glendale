<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Подарунок номера другу (оплачує дарувальник) і передача свого купленого номера. Друг приймає або
 * відмовляється; доки пропозиція чекає, номер нікому іншому не дістанеться.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('phone_numbers', function (Blueprint $table) {
            // Кому даруємо (поки триває оплата подарунка).
            $table->foreignId('gift_to')->nullable()->after('payment_id')->constrained('users')->nullOnDelete();
        });

        Schema::create('phone_offers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('phone_number_id')->constrained()->cascadeOnDelete();
            $table->foreignId('from_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('to_user_id')->constrained('users')->cascadeOnDelete();
            // gift — куплений у подарунок; transfer — передача свого купленого номера.
            $table->string('kind', 10);
            $table->string('status', 10)->default('pending');
            $table->timestamps();
            $table->index(['to_user_id', 'status']);
            $table->index(['phone_number_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('phone_offers');
        Schema::table('phone_numbers', function (Blueprint $table) {
            $table->dropConstrainedForeignId('gift_to');
        });
    }
};
