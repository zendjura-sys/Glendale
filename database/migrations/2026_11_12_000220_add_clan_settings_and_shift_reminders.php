<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Налаштування функцій клану (MVP, сітка, нагадування…) і позначка «нагадали про зміну». */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clans', function (Blueprint $table) {
            $table->json('settings')->nullable()->after('permissions');
        });
        foreach (['family_shifts', 'clan_shifts'] as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->timestamp('reminded_at')->nullable();
            });
        }
    }

    public function down(): void
    {
        Schema::table('clans', fn (Blueprint $table) => $table->dropColumn('settings'));
        foreach (['family_shifts', 'clan_shifts'] as $name) {
            Schema::table($name, fn (Blueprint $table) => $table->dropColumn('reminded_at'));
        }
    }
};
