<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Бани за IP (точна адреса чи підмережа CIDR) і гостей за відбитком IP; community_id — лише в цій спільноті.
        Schema::create('ip_bans', function (Blueprint $table) {
            $table->id();
            $table->string('ip', 64)->nullable();
            $table->string('ip_hash', 64)->nullable()->index();
            $table->foreignId('community_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('label', 80)->nullable();
            $table->string('reason', 200)->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // Журнал спроб, які зупинив антиспам: для статистики й розбору в адмінці.
        Schema::create('spam_blocks', function (Blueprint $table) {
            $table->id();
            $table->string('kind', 24);
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('conversation_id')->nullable()->constrained()->nullOnDelete();
            $table->string('ip_hash', 64)->nullable();
            $table->string('detail', 160)->nullable();
            $table->timestamp('created_at')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('spam_blocks');
        Schema::dropIfExists('ip_bans');
    }
};
