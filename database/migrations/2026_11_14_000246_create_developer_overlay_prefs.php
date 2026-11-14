<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Налаштування оверлею гравця для конкретної гри — синхронізуються між пристроями.
        Schema::create('developer_overlay_prefs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('developer_app_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->boolean('enabled')->default(true);
            $table->json('prefs')->nullable();
            $table->timestamps();
            $table->unique(['developer_app_id', 'user_id']);
        });
        // Чернетка вигляду й історія опублікованих версій (відкат).
        Schema::table('developer_apps', function (Blueprint $table) {
            $table->json('overlay_draft')->nullable();
            $table->json('overlay_versions')->nullable();
            $table->timestamp('overlay_published_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('developer_overlay_prefs');
        Schema::table('developer_apps', function (Blueprint $table) {
            $table->dropColumn(['overlay_draft', 'overlay_versions', 'overlay_published_at']);
        });
    }
};
