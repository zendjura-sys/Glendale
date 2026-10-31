<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Доступ до спільноти: показ у каталозі, пароль для вступу, перегляд гостями,
 * автовступ нових людей (вмикає адмін сайту) і гостьовий чат в одному з каналів.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('communities', function (Blueprint $table) {
            $table->boolean('is_listed')->default(true)->after('privacy');
            $table->string('join_password')->nullable()->after('is_listed');
            $table->boolean('guest_view')->default(false)->after('join_password');
            $table->boolean('auto_join')->default(false)->after('guest_view');
            $table->foreignId('guest_chat_channel_id')->nullable()->after('auto_join')
                ->constrained('community_channels')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('communities', function (Blueprint $table) {
            $table->dropConstrainedForeignId('guest_chat_channel_id');
            $table->dropColumn(['is_listed', 'join_password', 'guest_view', 'auto_join']);
        });
    }
};
