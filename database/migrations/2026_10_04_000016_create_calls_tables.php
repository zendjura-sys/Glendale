<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Дзвінки в бесідах (особисті й групові); звук іде через LiveKit, тут — хто дзвонить, хто відповів і скільки тривало.
        Schema::create('calls', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('started_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 16)->default('ringing');
            $table->timestamp('answered_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->timestamps();
            $table->index(['conversation_id', 'status']);
        });

        Schema::create('call_participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('call_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('state', 16)->default('invited');
            $table->timestamp('joined_at')->nullable();
            $table->timestamp('left_at')->nullable();
            $table->unique(['call_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('call_participants');
        Schema::dropIfExists('calls');
    }
};
