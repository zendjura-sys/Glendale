<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Спільне прослуховування: один трек синхронно в усіх, спільна черга; ведучий керує плеєром.
        Schema::create('listen_parties', function (Blueprint $table) {
            $table->id();
            $table->string('code', 16)->unique();
            $table->foreignId('host_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('track_id')->nullable()->constrained()->nullOnDelete();
            // Черга: [{track_id, by}] — додає будь-хто з учасників.
            $table->json('queue')->nullable();
            $table->boolean('playing')->default(false);
            $table->double('position')->default(0);
            // Момент, до якого прив’язана позиція (мс від епохи): слухачі рахують, де зараз трек.
            $table->unsignedBigInteger('state_ms')->default(0);
            $table->boolean('shared_control')->default(false);
            $table->timestamp('ended_at')->nullable();
            $table->timestamps();
        });

        Schema::create('listen_party_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('listen_party_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('last_seen_at');
            $table->unique(['listen_party_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('listen_party_members');
        Schema::dropIfExists('listen_parties');
    }
};
