<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Автопостинг у Discord (вебхук) і Telegram (канал, куди додано бота GameCon).
        Schema::create('crosspost_targets', function (Blueprint $table) {
            $table->id();
            $table->string('owner_type', 16);
            $table->unsignedBigInteger('owner_id');
            $table->string('platform', 16);
            $table->text('target');
            $table->string('label', 120)->nullable();
            $table->json('events');
            $table->boolean('enabled')->default(true);
            $table->string('last_error', 200)->nullable();
            $table->timestamp('last_sent_at')->nullable();
            $table->timestamps();
            $table->index(['owner_type', 'owner_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crosspost_targets');
    }
};
