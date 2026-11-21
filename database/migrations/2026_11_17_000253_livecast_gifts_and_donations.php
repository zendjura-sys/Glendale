<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** LiveCast: подарунки в чаті й лінки донат-майданчиків на стрімі. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('livecasts', function (Blueprint $table) {
            $table->json('donations')->nullable()->after('category');
        });

        Schema::table('livecast_messages', function (Blueprint $table) {
            $table->string('kind', 16)->default('chat')->after('user_id'); // chat | gift
            $table->string('gift_key', 32)->nullable()->after('kind');
        });
    }

    public function down(): void
    {
        Schema::table('livecast_messages', function (Blueprint $table) {
            $table->dropColumn(['kind', 'gift_key']);
        });
        Schema::table('livecasts', function (Blueprint $table) {
            $table->dropColumn('donations');
        });
    }
};
