<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Гілки в групах: відповіді на повідомлення окремою розмовою під ним.
        Schema::table('messages', function (Blueprint $table) {
            $table->foreignId('thread_root_id')->nullable()->after('reply_to_id')->constrained('messages')->nullOnDelete();
            $table->unsignedInteger('thread_count')->default(0)->after('thread_root_id');
            $table->timestamp('thread_last_at')->nullable()->after('thread_count');
        });

        // Кілька закріплених повідомлень у бесіді.
        Schema::create('message_pins', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('message_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
            $table->index(['conversation_id', 'created_at']);
        });

        // Особиста нотатка до бесіди (бачить лише її автор).
        Schema::table('conversation_participants', function (Blueprint $table) {
            $table->text('note')->nullable();
        });

        // Фото «на один перегляд»: хто вже відкрив.
        Schema::create('message_attachment_views', function (Blueprint $table) {
            $table->foreignId('message_attachment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('viewed_at');
            $table->primary(['message_attachment_id', 'user_id']);
        });

        // Набори стікерів спільнот: доступні учасникам спільноти.
        Schema::table('sticker_packs', function (Blueprint $table) {
            $table->foreignId('community_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('sticker_packs', function (Blueprint $table) {
            $table->dropConstrainedForeignId('community_id');
        });
        Schema::dropIfExists('message_attachment_views');
        Schema::table('conversation_participants', function (Blueprint $table) {
            $table->dropColumn('note');
        });
        Schema::dropIfExists('message_pins');
        Schema::table('messages', function (Blueprint $table) {
            $table->dropConstrainedForeignId('thread_root_id');
            $table->dropColumn(['thread_count', 'thread_last_at']);
        });
    }
};
