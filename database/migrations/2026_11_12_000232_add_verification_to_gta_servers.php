<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Значок перевіреного сервера: коли й ким підтверджено, код для сайту, запит на ручну перевірку. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('gta_servers', function (Blueprint $table) {
            $table->timestamp('verified_at')->nullable()->after('owner_id');
            $table->foreignId('verified_by')->nullable()->after('verified_at')->constrained('users')->nullOnDelete();
            $table->string('verify_token', 40)->nullable()->after('verified_by');
            $table->timestamp('verify_requested_at')->nullable()->after('verify_token');
        });
    }

    public function down(): void
    {
        Schema::table('gta_servers', function (Blueprint $table) {
            $table->dropConstrainedForeignId('verified_by');
            $table->dropColumn(['verified_at', 'verify_token', 'verify_requested_at']);
        });
    }
};
