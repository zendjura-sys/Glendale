<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->boolean('is_draft')->default(false)->after('is_pinned');
        });

        Schema::table('comments', function (Blueprint $table) {
            $table->boolean('is_pinned')->default(false)->after('spoiler');
        });
    }

    public function down(): void
    {
        Schema::table('comments', function (Blueprint $table) {
            $table->dropColumn('is_pinned');
        });
        Schema::table('posts', function (Blueprint $table) {
            $table->dropColumn('is_draft');
        });
    }
};
