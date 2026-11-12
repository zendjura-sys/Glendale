<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Зміни й чергування сім’ї: хто, коли й де (склад, патруль, набір). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('family_shifts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('family_id')->constrained()->cascadeOnDelete();
            $table->string('title', 80);
            $table->string('note', 200)->nullable();
            $table->timestamp('starts_at');
            $table->timestamp('ends_at');
            $table->foreignId('member_id')->nullable()->constrained('family_members')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('family_members')->nullOnDelete();
            $table->timestamps();
            $table->index(['family_id', 'starts_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('family_shifts');
    }
};
