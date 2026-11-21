<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Швидкість сторінок у реальних людей (LCP, INP, CLS, TTFB) — без прив’язки до акаунта. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('page_vitals', function (Blueprint $table) {
            $table->id();
            $table->string('page', 80);
            $table->string('metric', 8);
            $table->float('value');
            $table->string('device', 8);
            $table->timestamp('created_at')->useCurrent();
            $table->index(['created_at', 'metric']);
            $table->index(['page', 'metric']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('page_vitals');
    }
};
