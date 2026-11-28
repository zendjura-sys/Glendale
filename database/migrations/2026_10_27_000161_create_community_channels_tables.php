<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Канали в спільнотах (як у Discord): категорії, текстові канали, «Оголошення» й голосові.
 * Текстові канали працюють на месенджері (бесіда з community_channel_id), голосові — на голосових
 * кімнатах спільноти. Приватний канал бачать лише вибрані учасники й адміністратори.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('community_channel_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('community_id')->constrained()->cascadeOnDelete();
            $table->string('name', 60);
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
            $table->index(['community_id', 'position']);
        });

        Schema::create('community_channels', function (Blueprint $table) {
            $table->id();
            $table->foreignId('community_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->nullable()->constrained('community_channel_categories')->nullOnDelete();
            $table->string('name', 60);
            $table->string('type', 16);
            $table->string('topic', 200)->nullable();
            $table->boolean('is_private')->default(false);
            $table->unsignedInteger('position')->default(0);
            $table->foreignId('conversation_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('voice_room_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
            $table->index(['community_id', 'position']);
        });

        Schema::create('community_channel_members', function (Blueprint $table) {
            $table->foreignId('community_channel_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->primary(['community_channel_id', 'user_id']);
        });

        Schema::table('conversations', function (Blueprint $table) {
            // Бесіда текстового каналу спільноти — не показується у «Повідомленнях».
            $table->unsignedBigInteger('community_channel_id')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            $table->dropIndex(['community_channel_id']);
            $table->dropColumn('community_channel_id');
        });
        Schema::dropIfExists('community_channel_members');
        Schema::dropIfExists('community_channels');
        Schema::dropIfExists('community_channel_categories');
    }
};
