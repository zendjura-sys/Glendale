<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Метрики для адмінки: хто був активний у який день (сайт / застосунок) і які розділи відкривав. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_active_days', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('day');
            $table->string('platform', 8);
            $table->primary(['user_id', 'day', 'platform']);
            $table->index(['day', 'platform']);
        });

        Schema::create('section_visits', function (Blueprint $table) {
            $table->date('day');
            $table->string('section', 24);
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->primary(['day', 'section', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('section_visits');
        Schema::dropIfExists('user_active_days');
    }
};
