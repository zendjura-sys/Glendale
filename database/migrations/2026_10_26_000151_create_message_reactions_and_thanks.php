<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Реакції на повідомлення в чатах (одна на людину) і «Подякувати» під гідами й коментарями.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('message_reactions', function (Blueprint $table) {
            $table->foreignId('message_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('emoji', 16);
            $table->timestamp('created_at')->nullable();
            $table->primary(['message_id', 'user_id']);
        });

        Schema::create('thanks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // Кому дякують — для лічильника «корисності» в профілі.
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->string('kind', 16);
            $table->unsignedBigInteger('subject_id');
            $table->timestamp('created_at')->nullable();
            $table->unique(['user_id', 'kind', 'subject_id']);
            $table->index(['kind', 'subject_id']);
            $table->index('owner_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('thanks');
        Schema::dropIfExists('message_reactions');
    }
};
