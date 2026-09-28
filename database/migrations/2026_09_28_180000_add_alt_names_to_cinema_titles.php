<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cinema_titles', function (Blueprint $table) {
            $table->json('alt_names')->nullable()->after('original_name');
        });
    }

    public function down(): void
    {
        Schema::table('cinema_titles', function (Blueprint $table) {
            $table->dropColumn('alt_names');
        });
    }
};
