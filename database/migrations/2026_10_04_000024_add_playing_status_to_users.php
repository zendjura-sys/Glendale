<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // «Граю в…»: сервер GTA або гра з каталогу. Ставиться автоматично (Discord Rich Presence, Steam)
        // або вручну. Назва, іконка й посилання зберігаються тут, щоб картка не робила зайвих запитів.
        Schema::table('users', function (Blueprint $table) {
            $table->string('playing_kind', 8)->nullable();
            $table->unsignedBigInteger('playing_ref_id')->nullable();
            $table->string('playing_label', 160)->nullable();
            $table->string('playing_icon')->nullable();
            $table->string('playing_url', 200)->nullable();
            $table->string('playing_note', 60)->nullable();
            $table->timestamp('playing_until')->nullable();
            // Звідки статус: manual | discord | steam. Ручний не перезаписується автоматичним, поки діє.
            $table->string('playing_source', 8)->nullable();
            $table->boolean('playing_auto')->default(true);
            $table->string('steam_id', 20)->nullable()->unique();
            $table->index(['playing_kind', 'playing_ref_id', 'playing_until']);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['playing_kind', 'playing_ref_id', 'playing_until']);
            $table->dropUnique(['steam_id']);
            $table->dropColumn(['playing_kind', 'playing_ref_id', 'playing_label', 'playing_icon', 'playing_url', 'playing_note', 'playing_until', 'playing_source', 'playing_auto', 'steam_id']);
        });
    }
};
