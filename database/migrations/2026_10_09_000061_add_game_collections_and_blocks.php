<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('games', function (Blueprint $table) {
            $table->json('collections')->nullable();
        });

        Schema::create('user_steam_apps', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('app_id', 20);
            $table->primary(['user_id', 'app_id']);
        });

        Schema::create('family_blocks', function (Blueprint $table) {
            $table->foreignId('family_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->nullable();
            $table->primary(['family_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('family_blocks');
        Schema::dropIfExists('user_steam_apps');
        Schema::table('games', function (Blueprint $table) {
            $table->dropColumn('collections');
        });
    }
};
