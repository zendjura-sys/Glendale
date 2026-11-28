<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Лайки стріму LiveCast: один на людину, лічильник у самому стрімі. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('livecast_likes', function (Blueprint $table) {
            $table->foreignId('livecast_id')->constrained('livecasts')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->nullable();
            $table->primary(['livecast_id', 'user_id']);
        });
        Schema::table('livecasts', function (Blueprint $table) {
            $table->unsignedInteger('likes_count')->default(0)->after('peak_viewers');
        });
    }

    public function down(): void
    {
        Schema::table('livecasts', function (Blueprint $table) {
            $table->dropColumn('likes_count');
        });
        Schema::dropIfExists('livecast_likes');
    }
};
