<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Анкета вступу до закритої спільноти: питання — у спільноти, відповіді — у заявки.
        Schema::table('communities', function (Blueprint $table) {
            $table->json('join_questions')->nullable();
        });
        Schema::table('community_members', function (Blueprint $table) {
            $table->json('answers')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('community_members', fn (Blueprint $table) => $table->dropColumn('answers'));
        Schema::table('communities', fn (Blueprint $table) => $table->dropColumn('join_questions'));
    }
};
