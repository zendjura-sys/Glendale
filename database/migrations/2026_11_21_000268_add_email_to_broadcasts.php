<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Новини GameCon на пошту (№284): розсилка може йти ще й листом — тим, хто погодився. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('broadcasts', function (Blueprint $table) {
            $table->boolean('email')->default(false)->after('filters');
            $table->unsignedInteger('emailed_count')->default(0)->after('sent_count');
        });
    }

    public function down(): void
    {
        Schema::table('broadcasts', function (Blueprint $table) {
            $table->dropColumn(['email', 'emailed_count']);
        });
    }
};
