<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Звернення в підтримку: людина ↔ персонал, статуси, пріоритет, відповідальний, оцінка.
        Schema::create('support_tickets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('category', 20);
            $table->string('subject', 120);
            $table->string('status', 12)->default('open');
            $table->string('priority', 10)->default('normal');
            $table->foreignId('assignee_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('url', 255)->nullable();
            $table->boolean('unread_user')->default(false);
            $table->boolean('unread_staff')->default(true);
            $table->unsignedTinyInteger('rating')->nullable();
            $table->string('rating_comment', 500)->nullable();
            $table->timestamp('last_reply_at')->nullable();
            $table->timestamp('first_response_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();
            $table->index(['status', 'priority']);
            $table->index(['user_id', 'updated_at']);
        });

        Schema::create('support_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ticket_id')->constrained('support_tickets')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->text('body');
            $table->boolean('from_staff')->default(false);
            // Внутрішня нотатка персоналу — людина її не бачить.
            $table->boolean('internal')->default(false);
            $table->json('attachments')->nullable();
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('support_messages');
        Schema::dropIfExists('support_tickets');
    }
};
