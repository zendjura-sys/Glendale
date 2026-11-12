<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Архіви «Мої дані» (GDPR): ZIP готується у фоні, посилання діє 7 днів. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('data_exports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('status', 12)->default('pending');
            $table->string('path')->nullable();
            $table->unsignedBigInteger('size')->default(0);
            $table->string('error', 200)->nullable();
            $table->timestamp('ready_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('data_exports');
    }
};
