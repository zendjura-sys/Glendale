<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('listen_parties', function (Blueprint $table) {
            $table->boolean('repeat')->default(false)->after('shared_control');
        });
    }

    public function down(): void
    {
        Schema::table('listen_parties', function (Blueprint $table) {
            $table->dropColumn('repeat');
        });
    }
};
