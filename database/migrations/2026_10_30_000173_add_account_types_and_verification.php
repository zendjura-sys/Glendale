<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Спеціальні акаунти (стрімер, бізнес, агенція…) і верифікація 2.0 з видом позначки.
        Schema::table('users', function (Blueprint $table) {
            $table->string('account_type', 16)->default('personal')->index();
            $table->json('account_details')->nullable();
            $table->string('verification_kind', 16)->nullable();
            $table->timestamp('verified_at')->nullable();
        });

        Schema::create('verification_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 16);
            $table->string('status', 16)->default('pending')->index();
            $table->json('links')->nullable();
            $table->text('note')->nullable();
            $table->string('document_path')->nullable();
            $table->foreignId('reviewer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('reason', 500)->nullable();
            $table->timestamp('decided_at')->nullable();
            $table->timestamps();
        });

        // Склад агенції, команди чи студії: людина підтверджує, що вона там.
        Schema::create('account_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('member_id')->constrained('users')->cascadeOnDelete();
            $table->string('role', 40)->nullable();
            $table->string('status', 16)->default('pending');
            $table->timestamps();
            $table->unique(['owner_id', 'member_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('account_links');
        Schema::dropIfExists('verification_requests');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['account_type', 'account_details', 'verification_kind', 'verified_at']);
        });
    }
};
