<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Голосові кімнати сімей і спільнот; сам звук іде через LiveKit, тут — лише список і присутні.
        Schema::create('voice_rooms', function (Blueprint $table) {
            $table->id();
            $table->string('owner_type', 16);
            $table->unsignedBigInteger('owner_id');
            $table->string('name', 60);
            $table->unsignedSmallInteger('position')->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['owner_type', 'owner_id', 'position']);
        });

        Schema::create('voice_participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('voice_room_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->boolean('muted')->default(false);
            $table->timestamp('joined_at');
            $table->unique(['voice_room_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('voice_participants');
        Schema::dropIfExists('voice_rooms');
    }
};
