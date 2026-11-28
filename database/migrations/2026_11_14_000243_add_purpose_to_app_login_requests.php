<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Куди людина входить (сайт розробника через OAuth) — показується в застосунку при підтвердженні. */
    public function up(): void
    {
        Schema::table('app_login_requests', function (Blueprint $table) {
            $table->string('purpose', 160)->nullable()->after('login_hint');
        });
    }

    public function down(): void
    {
        Schema::table('app_login_requests', function (Blueprint $table) {
            $table->dropColumn('purpose');
        });
    }
};
