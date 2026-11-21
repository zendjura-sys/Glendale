<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Батьківський контроль (№227): дорослий пов’язується з підлітком за його згодою й задає
 * правила (нічна пауза, заявки в друзі лише від друзів друзів). Листування батьки не бачать.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('parent_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('parent_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('teen_id')->constrained('users')->cascadeOnDelete();
            $table->string('status', 12)->default('invited');
            $table->json('rules')->nullable();
            $table->timestamps();
            $table->unique(['parent_id', 'teen_id']);
            $table->index(['teen_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('parent_links');
    }
};
