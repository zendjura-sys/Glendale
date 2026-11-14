<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Статус з емодзі й таймером: «🎮 У рейді до 23:00». Після status_until статус ховається.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('status_emoji', 16)->nullable()->after('status');
            $table->timestamp('status_until')->nullable()->after('status_emoji');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['status_emoji', 'status_until']);
        });
    }
};
