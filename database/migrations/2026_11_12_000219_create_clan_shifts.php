<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Зміни й чергування клану/гільдії (розділ «Зміни» вмикається в налаштуваннях). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clan_shifts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clan_id')->constrained()->cascadeOnDelete();
            $table->string('title', 80);
            $table->timestamp('starts_at');
            $table->timestamp('ends_at');
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['clan_id', 'starts_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clan_shifts');
    }
};
