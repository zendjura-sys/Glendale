<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Бот у Discord/Telegram оголошує кімнати «Слухати разом» групи (вимикається в налаштуваннях бота).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bot_links', function (Blueprint $table) {
            $table->boolean('post_music')->default(true)->after('post_posts');
        });
    }

    public function down(): void
    {
        Schema::table('bot_links', function (Blueprint $table) {
            $table->dropColumn('post_music');
        });
    }
};
