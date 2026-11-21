<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('movies', function (Blueprint $table) {
            // announced | ongoing | released; null — визначається автоматично (рік, свіжі серії).
            $table->string('release_status', 16)->nullable()->after('episodes_count');
        });
    }

    public function down(): void
    {
        Schema::table('movies', function (Blueprint $table) {
            $table->dropColumn('release_status');
        });
    }
};
