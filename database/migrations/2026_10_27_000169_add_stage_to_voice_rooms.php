<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // «Сцена»: говорять лише спікери, решта слухає й може підняти руку.
        Schema::table('voice_rooms', function (Blueprint $table) {
            $table->boolean('is_stage')->default(false);
        });
        Schema::table('voice_participants', function (Blueprint $table) {
            $table->boolean('speaker')->default(false);
            $table->timestamp('hand_raised_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('voice_participants', function (Blueprint $table) {
            $table->dropColumn(['speaker', 'hand_raised_at']);
        });
        Schema::table('voice_rooms', function (Blueprint $table) {
            $table->dropColumn('is_stage');
        });
    }
};
