<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conversation_participants', function (Blueprint $table) {
            $table->timestamp('pinned_at')->nullable()->after('is_muted');
            $table->string('folder', 24)->nullable()->after('pinned_at');
        });

        Schema::table('messages', function (Blueprint $table) {
            $table->timestamp('publish_at')->nullable()->after('edited_at');
            $table->timestamp('expires_at')->nullable()->after('publish_at');
        });
    }

    public function down(): void
    {
        Schema::table('conversation_participants', function (Blueprint $table) {
            $table->dropColumn(['pinned_at', 'folder']);
        });

        Schema::table('messages', function (Blueprint $table) {
            $table->dropColumn(['publish_at', 'expires_at']);
        });
    }
};
