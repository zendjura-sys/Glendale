<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Заповнюється лише при реєстрації через union.gamecon.online —
            // це не посада в самій родині Monsory (та вже й так є в
            // position_key), а дані про СВОЮ спілку/родину союзника.
            $table->string('union_family_name')->nullable()->after('position_key');
            $table->string('union_role')->nullable()->after('union_family_name');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['union_family_name', 'union_role']);
        });
    }
};
