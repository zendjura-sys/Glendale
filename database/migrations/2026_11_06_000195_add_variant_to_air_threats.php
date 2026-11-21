<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Різновид цілі для значка й швидкості: shahed, jet, gerbera, fpv (БпЛА), cruise (ракета).
        Schema::table('air_threats', function (Blueprint $table) {
            $table->string('variant', 16)->nullable()->after('type');
        });
    }

    public function down(): void
    {
        Schema::table('air_threats', function (Blueprint $table) {
            $table->dropColumn('variant');
        });
    }
};
