<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Оцінки корисності гідів (№259): «Корисно / Не дуже»; лічильники — для сортування. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('game_guide_votes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('game_guide_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->boolean('helpful');
            $table->timestamps();
            $table->unique(['game_guide_id', 'user_id']);
        });
        Schema::table('game_guides', function (Blueprint $table) {
            $table->unsignedInteger('helpful_count')->default(0)->after('body');
            $table->unsignedInteger('unhelpful_count')->default(0)->after('helpful_count');
        });
    }

    public function down(): void
    {
        Schema::table('game_guides', function (Blueprint $table) {
            $table->dropColumn(['helpful_count', 'unhelpful_count']);
        });
        Schema::dropIfExists('game_guide_votes');
    }
};
