<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Вбудовані картки в темах і відповідях: фільм, гра, сервер, трек, сім’я, клан, спільнота, стаття. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('discussions', function (Blueprint $table) {
            $table->json('embeds')->nullable()->after('body');
        });
        Schema::table('discussion_replies', function (Blueprint $table) {
            $table->json('embeds')->nullable()->after('body');
        });
    }

    public function down(): void
    {
        Schema::table('discussion_replies', fn (Blueprint $table) => $table->dropColumn('embeds'));
        Schema::table('discussions', fn (Blueprint $table) => $table->dropColumn('embeds'));
    }
};
