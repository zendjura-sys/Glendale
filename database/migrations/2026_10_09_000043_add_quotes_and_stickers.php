<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->foreignId('quoted_post_id')->nullable()->constrained('posts')->nullOnDelete();
            $table->string('sticker', 20)->nullable();
        });

        Schema::table('comments', function (Blueprint $table) {
            $table->string('sticker', 20)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('comments', function (Blueprint $table) {
            $table->dropColumn('sticker');
        });

        Schema::table('posts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('quoted_post_id');
            $table->dropColumn('sticker');
        });
    }
};
