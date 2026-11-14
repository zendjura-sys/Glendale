<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Голосування за час гри в «Пошуку паті»: автор пропонує 2–4 варіанти, люди позначають
 * «мені підходить», автор закріплює час — тоді він стає часом старту паті.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('party_time_slots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_post_id')->constrained()->cascadeOnDelete();
            $table->timestamp('starts_at');
            $table->index(['party_post_id', 'starts_at']);
        });

        Schema::create('party_time_votes', function (Blueprint $table) {
            $table->foreignId('party_time_slot_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->nullable();
            $table->primary(['party_time_slot_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('party_time_votes');
        Schema::dropIfExists('party_time_slots');
    }
};
