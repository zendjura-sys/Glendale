<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Турніри й челенджі серверів: сітка на вибування або таблиця результатів із підтвердженням організатора.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tournaments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gta_server_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title', 80);
            $table->text('description')->nullable();
            // bracket — сітка на вибування; challenge — найкращий результат за період.
            $table->string('kind', 12);
            // solo — гравці; family — сім’ї сервера (реєструє лідер).
            $table->string('entry', 8)->default('solo');
            $table->unsignedSmallInteger('size')->default(16);
            $table->string('metric', 40)->nullable();
            $table->boolean('lower_is_better')->default(false);
            $table->string('prize', 120)->nullable();
            $table->string('status', 12)->default('open');
            $table->timestamp('starts_at');
            $table->timestamp('ends_at')->nullable();
            $table->timestamps();
            $table->index(['gta_server_id', 'status']);
            $table->index(['status', 'starts_at']);
        });

        Schema::create('tournament_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tournament_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('family_id')->nullable()->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('seed')->nullable();
            $table->timestamps();
            $table->unique(['tournament_id', 'user_id']);
        });

        Schema::create('tournament_matches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tournament_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('round');
            $table->unsignedSmallInteger('slot');
            $table->foreignId('a_entry_id')->nullable()->constrained('tournament_entries')->nullOnDelete();
            $table->foreignId('b_entry_id')->nullable()->constrained('tournament_entries')->nullOnDelete();
            $table->foreignId('winner_entry_id')->nullable()->constrained('tournament_entries')->nullOnDelete();
            $table->string('score', 20)->nullable();
            $table->timestamps();
            $table->unique(['tournament_id', 'round', 'slot']);
        });

        Schema::create('tournament_submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tournament_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tournament_entry_id')->constrained()->cascadeOnDelete();
            $table->decimal('value', 12, 2);
            $table->string('proof_path')->nullable();
            $table->string('note', 200)->nullable();
            $table->string('status', 10)->default('pending');
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['tournament_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tournament_submissions');
        Schema::dropIfExists('tournament_matches');
        Schema::dropIfExists('tournament_entries');
        Schema::dropIfExists('tournaments');
    }
};
