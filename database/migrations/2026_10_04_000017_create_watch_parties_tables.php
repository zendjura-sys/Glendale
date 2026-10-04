<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Спільний перегляд фільму: ведучий керує плеєром, гості синхронізуються; чат і голос поруч.
        Schema::create('watch_parties', function (Blueprint $table) {
            $table->id();
            $table->string('code', 16)->unique();
            $table->foreignId('movie_id')->constrained()->cascadeOnDelete();
            $table->foreignId('host_id')->constrained('users')->cascadeOnDelete();
            $table->string('player_key', 64)->nullable();
            $table->boolean('playing')->default(false);
            $table->double('position')->default(0);
            // Момент, до якого прив’язана позиція (мс від епохи): гості рахують, де зараз фільм.
            $table->unsignedBigInteger('state_ms')->default(0);
            $table->boolean('shared_control')->default(false);
            $table->timestamp('ended_at')->nullable();
            $table->timestamps();
        });

        Schema::create('watch_party_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('watch_party_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('last_seen_at');
            $table->unique(['watch_party_id', 'user_id']);
        });

        Schema::create('watch_party_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('watch_party_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('body', 500);
            $table->timestamp('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('watch_party_messages');
        Schema::dropIfExists('watch_party_members');
        Schema::dropIfExists('watch_parties');
    }
};
