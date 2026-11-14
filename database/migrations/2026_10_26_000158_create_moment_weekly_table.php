<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * «Кліп тижня»: переможець кожного тижня (з понеділка за Києвом) — момент із найбільшою кількістю
 * вподобань, отриманих за цей тиждень. Запис лишається в архіві, навіть якщо кліп потім видалять.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('moment_weekly', function (Blueprint $table) {
            $table->date('week')->primary();
            $table->foreignId('moment_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedInteger('likes');
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('moment_weekly');
    }
};
