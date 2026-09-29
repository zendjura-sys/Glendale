<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cinema_titles', function (Blueprint $table) {
            $table->string('kodik_sync_status', 32)->nullable()->index()->after('kodik_checked_at');
            $table->string('kodik_last_error', 64)->nullable()->after('kodik_sync_status');
        });
    }

    public function down(): void
    {
        Schema::table('cinema_titles', function (Blueprint $table) {
            $table->dropIndex(['kodik_sync_status']);
            $table->dropColumn(['kodik_sync_status', 'kodik_last_error']);
        });
    }
};
