<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Один сайт — усе пов'язане: запис у стрічці може містити фільм із
 * кінопорталу (поділитися, рецензія), а в родини є власна стіна
 * (owner_type = family), яку бачать лише її учасники.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('social_posts', function (Blueprint $table) {
            $table->foreignId('cinema_title_id')->nullable()->after('spotify')->constrained('cinema_titles')->nullOnDelete();
        });
        // «Друг радить подивитись» — сповіщення веде на сторінку фільму.
        Schema::table('social_notifications', function (Blueprint $table) {
            $table->foreignId('cinema_title_id')->nullable()->constrained('cinema_titles')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('social_notifications', function (Blueprint $table) {
            $table->dropConstrainedForeignId('cinema_title_id');
        });
        Schema::table('social_posts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('cinema_title_id');
        });
    }
};
