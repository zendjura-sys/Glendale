<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Логотип гри (іконка застосунку з App Store / Google Play / Steam) — для значка біля ніка.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('games', function (Blueprint $table) {
            $table->string('logo_path')->nullable()->after('cover');
            $table->string('logo_source', 16)->nullable()->after('logo_path');
            $table->timestamp('logo_fetched_at')->nullable()->after('logo_source');
        });
    }

    public function down(): void
    {
        Schema::table('games', function (Blueprint $table) {
            $table->dropColumn(['logo_path', 'logo_source', 'logo_fetched_at']);
        });
    }
};
