<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Архів записів: запис зникає зі стіни й стрічки, але лишається в автора (/archive). */
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->timestamp('archived_at')->nullable()->after('publish_at');
            $table->index(['author_id', 'archived_at']);
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropIndex(['author_id', 'archived_at']);
            $table->dropColumn('archived_at');
        });
    }
};
