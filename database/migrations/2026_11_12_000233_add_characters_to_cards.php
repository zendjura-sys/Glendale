<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Колекційні картки персонажів аніме, фільмів і серіалів; єдиний ключ картки (g12 — гра, c5 — персонаж). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('card_characters', function (Blueprint $table) {
            $table->id();
            $table->foreignId('movie_id')->constrained()->cascadeOnDelete();
            $table->string('source', 12);
            $table->string('source_id', 40);
            $table->string('name', 120);
            $table->string('image_url', 500)->nullable();
            $table->string('role', 12)->default('main');
            $table->unsignedInteger('popularity')->default(0);
            $table->boolean('is_hidden')->default(false);
            $table->timestamps();
            $table->unique(['movie_id', 'source', 'source_id']);
        });
        Schema::table('user_cards', function (Blueprint $table) {
            $table->string('card_key', 24)->nullable()->after('game_id');
            $table->foreignId('game_id')->nullable()->change();
        });
        // Однаково для SQLite і MariaDB (там || — логічне АБО, тож без SQL-конкатенації).
        foreach (DB::table('user_cards')->whereNull('card_key')->orderBy('id')->lazy() as $row) {
            DB::table('user_cards')->where('id', $row->id)->update(['card_key' => 'g'.$row->game_id]);
        }
        Schema::table('user_cards', function (Blueprint $table) {
            $table->unique(['user_id', 'card_key']);
        });
    }

    public function down(): void
    {
        Schema::table('user_cards', function (Blueprint $table) {
            $table->dropUnique(['user_id', 'card_key']);
            $table->dropColumn('card_key');
        });
        Schema::dropIfExists('card_characters');
    }
};
