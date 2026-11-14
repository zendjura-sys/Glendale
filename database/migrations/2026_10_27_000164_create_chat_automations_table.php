<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Боти бесід: «Привітання» новеньких і «Автопости» за розкладом (раз, щодня, у вибрані дні тижня)
 * у групах і каналах спільнот. Пишуть від імені бота, без автора-людини.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chat_automations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 16);
            $table->string('bot_name', 40)->default('Бот');
            $table->text('body');
            $table->boolean('enabled')->default(true);
            $table->string('repeat', 16)->nullable();
            $table->string('time', 5)->nullable();
            $table->json('weekdays')->nullable();
            $table->timestamp('next_run_at')->nullable()->index();
            $table->timestamp('last_run_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['conversation_id', 'kind']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chat_automations');
    }
};
