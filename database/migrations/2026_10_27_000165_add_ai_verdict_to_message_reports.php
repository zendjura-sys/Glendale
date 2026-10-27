<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Оцінка скарги від ШІ: терміновість і коротка причина — підказка модераторам у черзі. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('message_reports', function (Blueprint $table) {
            $table->json('ai_verdict')->nullable()->after('resolution');
        });
    }

    public function down(): void
    {
        Schema::table('message_reports', function (Blueprint $table) {
            $table->dropColumn('ai_verdict');
        });
    }
};
