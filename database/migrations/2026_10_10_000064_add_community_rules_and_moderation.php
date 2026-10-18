<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('communities', function (Blueprint $table) {
            $table->text('rules')->nullable();
            $table->longText('handbook')->nullable();
            $table->text('welcome')->nullable();
            $table->json('banned_words')->nullable();
            $table->json('post_tags')->nullable();
            $table->unsignedInteger('slow_mode')->default(0);
            $table->boolean('premoderation')->default(false);
        });

        Schema::table('community_members', function (Blueprint $table) {
            $table->string('title', 32)->nullable();
            $table->string('color', 12)->nullable();
        });

        Schema::table('posts', function (Blueprint $table) {
            $table->boolean('is_pending')->default(false);
            $table->string('tag', 24)->nullable();
            $table->index(['wall_type', 'wall_id', 'is_pending']);
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropIndex(['wall_type', 'wall_id', 'is_pending']);
            $table->dropColumn(['is_pending', 'tag']);
        });
        Schema::table('community_members', fn (Blueprint $table) => $table->dropColumn(['title', 'color']));
        Schema::table('communities', fn (Blueprint $table) => $table->dropColumn(['rules', 'handbook', 'welcome', 'banned_words', 'post_tags', 'slow_mode', 'premoderation']));
    }
};
