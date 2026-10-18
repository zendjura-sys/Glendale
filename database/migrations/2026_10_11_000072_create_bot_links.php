<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('telegram_id', 32)->nullable()->unique();
            $table->string('telegram_username', 64)->nullable();
        });

        // Бот GameCon у групі Telegram чи на сервері Discord, прив’язаний до сім’ї, клану чи спільноти.
        Schema::create('bot_links', function (Blueprint $table) {
            $table->id();
            $table->string('platform', 12);
            $table->string('owner_type', 16);
            $table->unsignedBigInteger('owner_id');
            $table->string('chat_id', 32)->nullable();
            $table->string('guild_id', 32)->nullable();
            $table->string('title', 120)->nullable();
            $table->boolean('post_events')->default(true);
            $table->boolean('post_reminders')->default(true);
            $table->boolean('post_posts')->default(false);
            $table->string('member_role_id', 32)->nullable();
            $table->string('leader_role_id', 32)->nullable();
            $table->timestamp('roles_synced_at')->nullable();
            $table->string('roles_error', 255)->nullable();
            $table->foreignId('linked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['platform', 'owner_type', 'owner_id']);
            $table->index(['platform', 'chat_id']);
        });

        // Одноразові коди: прив’язати групу (через startgroup / OAuth Discord) або свій Telegram.
        Schema::create('bot_link_codes', function (Blueprint $table) {
            $table->id();
            $table->char('code_hash', 64)->unique();
            $table->string('platform', 12);
            $table->string('purpose', 12);
            $table->string('owner_type', 16)->nullable();
            $table->unsignedBigInteger('owner_id')->nullable();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable();
            $table->timestamp('created_at')->nullable();
        });

        // Ролі, які видав саме GameCon: лише їх бот забирає, коли людина виходить із групи.
        Schema::create('discord_role_grants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bot_link_id')->constrained()->cascadeOnDelete();
            $table->string('discord_user_id', 32);
            $table->string('role_id', 32);
            $table->timestamp('created_at')->nullable();
            $table->unique(['bot_link_id', 'discord_user_id', 'role_id'], 'discord_role_grants_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('discord_role_grants');
        Schema::dropIfExists('bot_link_codes');
        Schema::dropIfExists('bot_links');
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['telegram_id']);
            $table->dropColumn(['telegram_id', 'telegram_username']);
        });
    }
};
