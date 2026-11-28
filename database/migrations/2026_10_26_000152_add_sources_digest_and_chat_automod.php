<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Звідки приходять на сторінку сервера, тижневий дайджест спільноти, автомодерація групових чатів.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('server_view_sources', function (Blueprint $table) {
            $table->foreignId('gta_server_id')->constrained()->cascadeOnDelete();
            $table->date('day');
            $table->string('source', 16);
            $table->unsignedInteger('views')->default(0);
            $table->primary(['gta_server_id', 'day', 'source']);
        });

        Schema::table('communities', function (Blueprint $table) {
            $table->boolean('weekly_digest')->default(false)->after('premoderation');
        });

        Schema::table('conversations', function (Blueprint $table) {
            $table->json('automod')->nullable()->after('slow_seconds');
        });
    }

    public function down(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            $table->dropColumn('automod');
        });
        Schema::table('communities', function (Blueprint $table) {
            $table->dropColumn('weekly_digest');
        });
        Schema::dropIfExists('server_view_sources');
    }
};
