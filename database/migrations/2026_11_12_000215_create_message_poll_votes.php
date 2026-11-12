<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Голоси в опитуваннях групових чатів (саме опитування — у meta повідомлення типу poll). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('message_poll_votes', function (Blueprint $table) {
            $table->foreignId('message_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('option');
            $table->timestamp('created_at')->useCurrent();
            $table->primary(['message_id', 'user_id', 'option']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('message_poll_votes');
    }
};
