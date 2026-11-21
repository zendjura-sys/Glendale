<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Спільна підписка GameCon+ на 5 акаунтів (№215): власник платить, до 4 друзів отримують
 * GameCon+ (окремий період plus_grants «household_member» до кінця періоду власника).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plus_household_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('member_id')->constrained('users')->cascadeOnDelete();
            $table->string('status', 12)->default('invited');
            $table->foreignId('plus_grant_id')->nullable()->constrained('plus_grants')->nullOnDelete();
            $table->timestamps();
            $table->unique(['owner_id', 'member_id']);
            $table->index(['member_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plus_household_members');
    }
};
