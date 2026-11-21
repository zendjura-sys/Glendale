<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Тайм-аут (читати можна, писати ні) і виключення на час у групах та каналах,
 * фон чату: спільний від адміністраторів бесіди й особистий у кожного.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conversation_participants', function (Blueprint $table) {
            $table->timestamp('timeout_until')->nullable()->after('left_at');
            $table->timestamp('banned_until')->nullable()->after('timeout_until');
            $table->string('background', 160)->nullable()->after('banned_until');
        });
        Schema::table('conversations', function (Blueprint $table) {
            $table->string('background', 160)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('conversation_participants', function (Blueprint $table) {
            $table->dropColumn(['timeout_until', 'banned_until', 'background']);
        });
        Schema::table('conversations', function (Blueprint $table) {
            $table->dropColumn('background');
        });
    }
};
