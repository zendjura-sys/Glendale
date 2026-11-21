<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Відкрите опитування: видно, хто як голосував (за замовчуванням — анонімне).
        Schema::table('polls', function (Blueprint $table) {
            $table->boolean('is_anonymous')->default(true)->after('question');
        });

        Schema::create('keyword_alerts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('keyword', 40);
            $table->timestamp('created_at')->nullable();
            $table->unique(['user_id', 'keyword']);
        });

        Schema::create('read_later', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('post_id')->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->nullable();
            $table->unique(['user_id', 'post_id']);
        });

        // Картка привітання новачку на сторінці спільноти — поки не закриє.
        Schema::table('community_members', function (Blueprint $table) {
            $table->timestamp('welcome_seen_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('community_members', fn (Blueprint $table) => $table->dropColumn('welcome_seen_at'));
        Schema::dropIfExists('read_later');
        Schema::dropIfExists('keyword_alerts');
        Schema::table('polls', fn (Blueprint $table) => $table->dropColumn('is_anonymous'));
    }
};
