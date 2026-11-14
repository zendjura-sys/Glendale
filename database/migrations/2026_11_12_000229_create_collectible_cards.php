<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Колекційні картки ігор: що є в людини, гаманець уламків і щоденні набори. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_cards', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('game_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('copies')->default(1);
            $table->boolean('showcase')->default(false);
            $table->timestamps();
            $table->unique(['user_id', 'game_id']);
        });
        Schema::create('card_wallets', function (Blueprint $table) {
            $table->foreignId('user_id')->primary()->constrained()->cascadeOnDelete();
            $table->unsignedInteger('shards')->default(0);
            $table->timestamp('pack_at')->nullable();
            $table->unsignedInteger('packs_opened')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('card_wallets');
        Schema::dropIfExists('user_cards');
    }
};
