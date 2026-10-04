<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Скарги на повідомлення в чатах: розбирає модерація; у чаті сім’ї — ще й керівництво сім’ї.
        Schema::create('message_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('message_id')->constrained()->cascadeOnDelete();
            $table->foreignId('reporter_id')->constrained('users')->cascadeOnDelete();
            $table->string('reason', 12);
            $table->string('comment', 300)->nullable();
            $table->string('status', 10)->default('pending')->index();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('resolution', 20)->nullable();
            $table->timestamps();
            $table->unique(['message_id', 'reporter_id']);
        });

        // Тимчасовий мут на всьому сайті (повідомлення, записи, коментарі).
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('muted_until')->nullable();
            $table->string('mute_reason', 200)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn(['muted_until', 'mute_reason']));
        Schema::dropIfExists('message_reports');
    }
};
