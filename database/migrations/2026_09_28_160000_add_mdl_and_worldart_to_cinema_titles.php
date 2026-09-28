<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ще два ідентифікатори, які Kodik приймає для точного пошуку плеєра
 * (поряд із вже наявними imdb_id і shikimori_id): mdl_id (MyDramaList —
 * для азійських дорам) і worldart_link (для аніме). Обидва — лише для
 * адмінки, вручну (автопошуку під ці джерела поки нема).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cinema_titles', function (Blueprint $t) {
            $t->unsignedInteger('mdl_id')->nullable()->after('imdb_id')->index();
            $t->string('worldart_link')->nullable()->after('mdl_id');
        });
    }

    public function down(): void
    {
        Schema::table('cinema_titles', function (Blueprint $t) {
            $t->dropColumn(['mdl_id', 'worldart_link']);
        });
    }
};
