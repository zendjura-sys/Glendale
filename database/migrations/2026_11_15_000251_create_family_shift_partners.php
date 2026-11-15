<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Напарники зміни: хто взяв зміну першим — бригадир, він схвалює напарників.
     * Завдання зміни кожен виконує сам: прогрес і зарахування — окремо в кожного напарника.
     */
    public function up(): void
    {
        Schema::create('family_shift_partners', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shift_id')->constrained('family_shifts')->cascadeOnDelete();
            $table->foreignId('member_id')->constrained('family_members')->cascadeOnDelete();
            $table->string('status', 16)->default('pending');
            $table->timestamp('approved_at')->nullable();
            $table->unsignedInteger('progress')->default(0);
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->unique(['shift_id', 'member_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('family_shift_partners');
    }
};
