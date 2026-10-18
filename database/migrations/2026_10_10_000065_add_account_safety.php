<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('frozen_at')->nullable();
        });

        // Відкриті сесії браузера: id сесії зберігаємо хешем, а сам id — зашифрованим, щоб завершити сесію.
        Schema::create('user_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('session_hash', 64)->unique();
            $table->text('handle');
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->timestamp('last_active_at');
            $table->timestamps();
            $table->index(['user_id', 'last_active_at']);
        });

        Schema::create('login_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('method', 16);
            $table->boolean('success');
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->timestamp('created_at');
            $table->index(['user_id', 'created_at']);
        });

        Schema::create('user_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('reporter_id')->constrained('users')->cascadeOnDelete();
            $table->string('reason', 16);
            $table->string('comment', 1000)->nullable();
            $table->string('status', 16)->default('pending');
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('resolution', 16)->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'reporter_id']);
            $table->index(['status', 'user_id']);
        });

        Schema::create('appeals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 16);
            $table->text('body');
            $table->string('status', 16)->default('pending');
            $table->text('reply')->nullable();
            $table->foreignId('handled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('appeals');
        Schema::dropIfExists('user_reports');
        Schema::dropIfExists('login_events');
        Schema::dropIfExists('user_sessions');
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('frozen_at'));
    }
};
